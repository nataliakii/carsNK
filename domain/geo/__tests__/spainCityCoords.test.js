import { SPAIN_CITY_OPTIONS } from "@/domain/orders/spainCityOptions";
import {
  SPAIN_CITY_COORDS,
  spainFallbackCities,
} from "@/domain/geo/spainCityCoords";
import {
  catalogCityOption,
  dedupeCitiesByName,
  matchesCityQuery,
  mergeCityLookupOptions,
} from "@/domain/geo/cityLookupOptions";

describe("SPAIN_CITY_COORDS", () => {
  it("covers every curated Spanish city", () => {
    const missing = SPAIN_CITY_OPTIONS.filter((n) => !SPAIN_CITY_COORDS[n]);
    expect(missing).toEqual([]);
  });

  it("stays inside Spain's bounding box, Canary Islands included", () => {
    for (const [name, { lat, lon }] of Object.entries(SPAIN_CITY_COORDS)) {
      expect({ name, inLat: lat >= 27 && lat <= 44 }).toEqual({
        name,
        inLat: true,
      });
      expect({ name, inLon: lon >= -19 && lon <= 5 }).toEqual({
        name,
        inLon: true,
      });
    }
  });
});

describe("spainFallbackCities", () => {
  const cities = spainFallbackCities();

  it("produces options the city picker accepts", () => {
    const barcelona = cities.find((c) => c.name === "Barcelona");
    expect(catalogCityOption(barcelona)).toMatchObject({
      source: "catalog",
      name: "Barcelona",
      country: "ES",
      coords: { lat: "41.3874", lon: "2.1686" },
    });
  });

  it("marks airports with the airport kind", () => {
    const airport = cities.find((c) => c.name === "Girona Airport");
    expect(airport.kind).toBe("airport");
  });

  it("keeps the curated search tokens so aliases match", () => {
    const option = catalogCityOption(cities.find((c) => c.name === "Girona"));
    expect(matchesCityQuery(option, "gerona")).toBe(true);
  });
});

describe("dedupeCitiesByName", () => {
  it("lets platform cities win over the Spanish fallback", () => {
    const platform = [
      { _id: "p", name: "Barcelona", coords: { lat: "1", lon: "2" } },
    ];
    const merged = dedupeCitiesByName(platform, spainFallbackCities());
    const barcelona = merged.filter((c) => c.name === "Barcelona");
    expect(barcelona).toHaveLength(1);
    expect(barcelona[0]._id).toBe("p");
  });

  it("makes Barcelona selectable with coords when Places returns nothing", () => {
    const catalogOptions = dedupeCitiesByName([], spainFallbackCities())
      .map(catalogCityOption)
      .filter(Boolean);
    const merged = mergeCityLookupOptions({
      catalogOptions,
      predictions: [],
      query: "barcelona",
    });
    expect(merged.map((o) => o.name)).toContain("Barcelona");
    expect(merged[0].coords).toBeTruthy();
  });
});
