/**
 * @jest-environment node
 */

jest.mock("@/domain/geo/googlePlaces", () => ({
  fetchPlaceAutocomplete: jest.fn(),
  normalizePlaceAutocompleteTypes: jest.fn((value) => value),
}));

import { fetchPlaceAutocomplete } from "@/domain/geo/googlePlaces";
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
  });

  it("fails fast with configured:false on Places deny so the field can become a text input", async () => {
    fetchPlaceAutocomplete.mockResolvedValue({
      ok: false,
      configured: false,
      unavailable: true,
      predictions: [],
      message: "Places API denied this server key",
    });

    const res = await POST(jsonRequest({ input: "diagonal", country: "es" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: false,
      configured: false,
      unavailable: true,
      predictions: [],
    });
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
  });
});
