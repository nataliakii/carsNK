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

  it("treats REQUEST_DENIED as unconfigured so the UI can fall back to typing", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        status: "REQUEST_DENIED",
        error_message:
          "This API key is not authorized to use this API. Referer restrictions.",
      }),
    });
    global.fetch = fetchMock;

    const first = await fetchPlaceAutocomplete({
      input: "diagonal",
      country: "es",
    });
    expect(first).toMatchObject({
      ok: false,
      configured: false,
      unavailable: true,
      predictions: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await fetchPlaceAutocomplete({
      input: "diagonal 123",
      country: "es",
    });
    expect(second.configured).toBe(false);
    expect(second.unavailable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it("omits types when none is requested so hotels and streets can both match", () => {
    expect(normalizePlaceAutocompleteTypes("", "")).toBe("");
    expect(normalizePlaceAutocompleteTypes(undefined, "")).toBe("");
    expect(normalizePlaceAutocompleteTypes("(cities)")).toBe("(cities)");
  });

  it("does not call Google for a single character", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const result = await fetchPlaceAutocomplete({ input: "d" });
    expect(result.ok).toBe(true);
    expect(result.predictions).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
