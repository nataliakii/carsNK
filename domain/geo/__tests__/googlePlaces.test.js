/**
 * @jest-environment node
 */

describe("fetchPlaceAutocomplete", () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;
  let fetchPlaceAutocomplete;
  let resetGooglePlacesDeniedState;
  let normalizePlaceAutocompleteTypes;

  beforeEach(async () => {
    jest.resetModules();
    process.env.GOOGLE_MAPS_API_KEY = "test-server-key";
    ({
      fetchPlaceAutocomplete,
      resetGooglePlacesDeniedState,
      normalizePlaceAutocompleteTypes,
    } = await import("../googlePlaces"));
    resetGooglePlacesDeniedState();
  });

  afterEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = originalKey;
    if (typeof resetGooglePlacesDeniedState === "function") {
      resetGooglePlacesDeniedState();
    }
  });

  it("keeps configured:true on REQUEST_DENIED so the UI can retry after cooldown", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        status: "REQUEST_DENIED",
        error_message:
          "API keys with referer restrictions cannot be used with this API.",
      }),
    });
    global.fetch = fetchMock;

    const first = await fetchPlaceAutocomplete({
      input: "diagonal",
      country: "es",
    });
    expect(first).toMatchObject({
      ok: false,
      configured: true,
      unavailable: true,
      reason: "referer_restricted",
      predictions: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const second = await fetchPlaceAutocomplete({
      input: "diagonal 123",
      country: "es",
    });
    expect(second.configured).toBe(true);
    expect(second.unavailable).toBe(true);
    expect(second.reason).toBe("referer_restricted");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const { PLACES_DENIED_COOLDOWN_MS } = await import("../googlePlaces");
    expect(PLACES_DENIED_COOLDOWN_MS).toBe(15 * 1000);
  });

  it("calls Google again once the deny cooldown elapses", async () => {
    let now = 1_700_000_000_000;
    const dateNow = jest.spyOn(Date, "now").mockImplementation(() => now);
    try {
      const fetchMock = jest.fn(async (url) => {
        const href = String(url);
        if (href.includes("places.googleapis.com")) {
          return {
            json: async () => ({
              error: {
                status: "PERMISSION_DENIED",
                message: "Requests from referer <empty> are blocked.",
              },
            }),
          };
        }
        return {
          json: async () => ({
            status: "REQUEST_DENIED",
            error_message:
              "API keys with referer restrictions cannot be used with this API.",
          }),
        };
      });
      global.fetch = fetchMock;

      await fetchPlaceAutocomplete({ input: "offi", country: "es" });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      now += 15 * 1000 - 1;
      await fetchPlaceAutocomplete({ input: "offi", country: "es" });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      now += 2;
      fetchMock.mockImplementation(async () => ({
        json: async () => ({
          status: "OK",
          predictions: [{ place_id: "p1", description: "Office, Barcelona" }],
        }),
      }));
      const after = await fetchPlaceAutocomplete({ input: "offi", country: "es" });
      expect(after.ok).toBe(true);
      expect(after.configured).toBe(true);
      expect(after.predictions[0].placeId).toBe("p1");
    } finally {
      dateNow.mockRestore();
    }
  });

  it("returns predictions when Google answers OK", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        status: "OK",
        predictions: [
          {
            place_id: "abc",
            description: "Carrer de Diagonal, Barcelona, Spain",
            structured_formatting: {
              main_text: "Carrer de Diagonal",
              secondary_text: "Barcelona, Spain",
            },
          },
        ],
      }),
    });

    const result = await fetchPlaceAutocomplete({ input: "diagonal" });
    expect(result).toEqual({
      ok: true,
      configured: true,
      predictions: [
        {
          placeId: "abc",
          description: "Carrer de Diagonal, Barcelona, Spain",
          mainText: "Carrer de Diagonal",
          secondaryText: "Barcelona, Spain",
        },
      ],
    });
  });

  it("uses Places API (New) when that endpoint returns suggestions", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "new-1",
              text: { text: "Carrer de Diagonal, Barcelona" },
              structuredFormat: {
                mainText: { text: "Carrer de Diagonal" },
                secondaryText: { text: "Barcelona" },
              },
            },
          },
        ],
      }),
    });

    const result = await fetchPlaceAutocomplete({ input: "diagonal" });
    expect(result.ok).toBe(true);
    expect(result.predictions[0].placeId).toBe("new-1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain(
      "places.googleapis.com"
    );
  });

  it("falls back to legacy autocomplete when Places API (New) times out", async () => {
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href.includes("places.googleapis.com")) {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      return {
        json: async () => ({
          status: "OK",
          predictions: [
            {
              place_id: "legacy-after-timeout",
              description: "Carrer de Diagonal, Barcelona",
            },
          ],
        }),
      };
    });

    const result = await fetchPlaceAutocomplete({ input: "diagonal" });
    expect(result.ok).toBe(true);
    expect(result.configured).toBe(true);
    expect(result.predictions[0].placeId).toBe("legacy-after-timeout");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to legacy autocomplete when New is not enabled", async () => {
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href.includes("places.googleapis.com")) {
        return {
          json: async () => ({
            error: {
              status: "PERMISSION_DENIED",
              message: "Places API (New) has not been used in project",
            },
          }),
        };
      }
      return {
        json: async () => ({
          status: "OK",
          predictions: [
            {
              place_id: "legacy-1",
              description: "Carrer de Diagonal, Barcelona",
            },
          ],
        }),
      };
    });

    const result = await fetchPlaceAutocomplete({ input: "diagonal" });
    expect(result.ok).toBe(true);
    expect(result.predictions[0].placeId).toBe("legacy-1");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("omits types when none is requested so hotels and streets can both match", () => {
    expect(normalizePlaceAutocompleteTypes("", "")).toBe("");
    expect(normalizePlaceAutocompleteTypes(undefined, "")).toBe("");
    expect(normalizePlaceAutocompleteTypes("(cities)")).toBe("(cities)");
  });

  it("classifies Google referer errors without treating them as a missing key", async () => {
    const { classifyPlacesFailure, PLACES_FAIL_REASON } = await import(
      "../googlePlaces"
    );
    expect(
      classifyPlacesFailure(
        "API keys with referer restrictions cannot be used with this API."
      )
    ).toBe(PLACES_FAIL_REASON.REFERER_RESTRICTED);
    expect(
      classifyPlacesFailure("Requests from referer <empty> are blocked.")
    ).toBe(PLACES_FAIL_REASON.REFERER_RESTRICTED);
    expect(classifyPlacesFailure("REQUEST_DENIED")).toBe(
      PLACES_FAIL_REASON.REQUEST_DENIED
    );
  });

  it("classifies quota, IP, timeout, invalid request and unsupported area", async () => {
    const { classifyPlacesFailure, PLACES_FAIL_REASON, publicPlacesMessage } =
      await import("../googlePlaces");
    expect(classifyPlacesFailure({ status: "OVER_QUERY_LIMIT" })).toBe(
      PLACES_FAIL_REASON.QUOTA_EXCEEDED
    );
    expect(
      classifyPlacesFailure("Requests from this IP address are blocked.")
    ).toBe(PLACES_FAIL_REASON.IP_RESTRICTED);
    expect(classifyPlacesFailure("deadline exceeded")).toBe(
      PLACES_FAIL_REASON.TIMEOUT
    );
    expect(classifyPlacesFailure({ status: "INVALID_REQUEST" })).toBe(
      PLACES_FAIL_REASON.INVALID_REQUEST
    );
    expect(
      classifyPlacesFailure("This API is not available in this country")
    ).toBe(PLACES_FAIL_REASON.UNSUPPORTED_AREA);
    expect(classifyPlacesFailure({ status: "ZERO_RESULTS" })).toBe(
      PLACES_FAIL_REASON.ZERO_RESULTS
    );
    expect(publicPlacesMessage(PLACES_FAIL_REASON.QUOTA_EXCEEDED)).toMatch(
      /quota/i
    );
    expect(publicPlacesMessage(PLACES_FAIL_REASON.REFERER_RESTRICTED)).not.toMatch(
      /AIza|key=/i
    );
  });

  it("reports not_configured when the maps key is missing", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "";
    const result = await fetchPlaceAutocomplete({ input: "office" });
    expect(result).toMatchObject({
      ok: false,
      configured: false,
      unavailable: true,
      reason: "not_configured",
    });
  });

  it("does not call Google for a single character", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const result = await fetchPlaceAutocomplete({ input: "d" });
    expect(result.ok).toBe(true);
    expect(result.predictions).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("normalizes Spain country names before calling Google components", async () => {
    const fetchMock = jest.fn(async (url, init) => {
      if (String(url).includes("places.googleapis.com")) {
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.includedRegionCodes).toEqual(["es"]);
        return {
          ok: false,
          json: async () => ({
            error: { code: 400, status: "INVALID_ARGUMENT", message: "fail new" },
          }),
        };
      }
      const href = String(url);
      expect(href).toContain("components=country%3Aes");
      expect(href).not.toMatch(/country%3Aspain/i);
      return {
        ok: true,
        json: async () => ({
          status: "OK",
          predictions: [
            {
              place_id: "p1",
              description: "Calle Mayor, Madrid, Spain",
              structured_formatting: {
                main_text: "Calle Mayor",
                secondary_text: "Madrid, Spain",
              },
            },
          ],
        }),
      };
    });
    global.fetch = fetchMock;
    process.env.GOOGLE_MAPS_API_KEY = "AIzaTestKey";
    const result = await fetchPlaceAutocomplete({
      input: "Calle Mayor",
      country: "Spain",
    });
    expect(result.ok).toBe(true);
    expect(result.predictions).toHaveLength(1);
  });
});

describe("placeCountryCode", () => {
  it("normalizes ISO2 and Spain/Greece long names", async () => {
    const { placeCountryCode } = await import("../googlePlaces");
    expect(placeCountryCode("ES")).toBe("ES");
    expect(placeCountryCode("es")).toBe("ES");
    expect(placeCountryCode("Spain")).toBe("ES");
    expect(placeCountryCode("España")).toBe("ES");
    expect(placeCountryCode("Greece")).toBe("GR");
    expect(placeCountryCode("FR")).toBe("FR");
    expect(placeCountryCode("")).toBe("");
  });
});
