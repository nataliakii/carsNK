/**
 * @jest-environment node
 */

jest.mock("@/domain/geo/googlePlaces", () => ({
  fetchPlaceAutocomplete: jest.fn(),
  normalizePlaceAutocompleteTypes: jest.fn((value) => value),
}));

jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(),
  placesAutocompleteRateLimitOptions: jest.fn(() => ({
    keyPrefix: "places_autocomplete",
  })),
}));

import { fetchPlaceAutocomplete } from "@/domain/geo/googlePlaces";
import { consumePublicPostOrError } from "@/services/publicPostRateLimit";
import { POST } from "../route";

function jsonRequest(body) {
  return new Request("http://localhost/api/public/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/places/autocomplete", () => {
  beforeEach(() => {
    fetchPlaceAutocomplete.mockReset();
    consumePublicPostOrError.mockReset();
    consumePublicPostOrError.mockResolvedValue(null);
  });

  it("returns empty predictions for short queries without calling Places or rate limit", async () => {
    const res = await POST(jsonRequest({ input: "ab", country: "es" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.predictions).toEqual([]);
    expect(body.shortQuery).toBe(true);
    expect(fetchPlaceAutocomplete).not.toHaveBeenCalled();
    expect(consumePublicPostOrError).not.toHaveBeenCalled();
  });

  it("returns predictions when Places is healthy", async () => {
    fetchPlaceAutocomplete.mockResolvedValue({
      ok: true,
      configured: true,
      predictions: [{ placeId: "p1", description: "Carrer de Diagonal" }],
    });

    const res = await POST(jsonRequest({ input: "diagonal" }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.configured).toBe(true);
    expect(body.predictions).toHaveLength(1);
    expect(consumePublicPostOrError).toHaveBeenCalled();
  });

  it("throttles with 429 when the public rate limiter trips", async () => {
    consumePublicPostOrError.mockResolvedValue({
      status: 429,
      body: { success: false, message: "Too many requests", code: "RATE_LIMIT" },
    });
    const res = await POST(jsonRequest({ input: "diagonal", country: "es" }));
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMIT");
    expect(body.predictions).toEqual([]);
    expect(fetchPlaceAutocomplete).not.toHaveBeenCalled();
  });

  it("returns unavailable with configured:true on Places deny so the field can retry", async () => {
    fetchPlaceAutocomplete.mockResolvedValue({
      ok: false,
      configured: true,
      unavailable: true,
      reason: "referer_restricted",
      predictions: [],
      message: "Places server key is blocked by HTTP-referrer restrictions",
    });

    const res = await POST(jsonRequest({ input: "diagonal", country: "es" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: false,
      configured: true,
      unavailable: true,
      reason: "referer_restricted",
      predictions: [],
    });
  });

  it("fails fast with configured:false when the maps key is missing", async () => {
    fetchPlaceAutocomplete.mockResolvedValue({
      ok: false,
      configured: false,
      unavailable: true,
      reason: "not_configured",
      predictions: [],
      message: "Places API is not configured",
    });

    const res = await POST(jsonRequest({ input: "diagonal", country: "es" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: false,
      configured: false,
      unavailable: true,
      reason: "not_configured",
      predictions: [],
    });
  });

  it("keeps configured:true on a transient Places failure so the field can retry", async () => {
    fetchPlaceAutocomplete.mockResolvedValue({
      ok: false,
      configured: true,
      unavailable: true,
      predictions: [],
      message: "Places autocomplete failed",
    });

    const res = await POST(jsonRequest({ input: "diagonal", country: "es" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: false,
      configured: true,
      unavailable: true,
      predictions: [],
    });
  });
});
