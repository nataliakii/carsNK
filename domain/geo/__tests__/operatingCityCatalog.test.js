import { SPAIN_CITY_COORDS } from "@/domain/geo/spainCityCoords";
import {
  citiesWithinRadius,
  cityNamesFromCityIds,
  mergeOperatingCityCatalog,
  selectedCityIdsFromCatalog,
} from "@/domain/geo/operatingCityCatalog";

const barcelonaBase = SPAIN_CITY_COORDS.Barcelona;
const thessaloniki = {
  _id: "64a1b2c3d4e5f60718293a4b",
  name: "Thessaloniki",
  country: "GR",
  coords: { lat: "40.6401", lon: "22.9444" },
};

describe("mergeOperatingCityCatalog", () => {
  it("adds curated Spanish cities with coords for ES companies", () => {
    const merged = mergeOperatingCityCatalog([], { country: "ES" });
    const barcelona = merged.find((c) => c.name === "Barcelona");
    expect(barcelona?.coords).toEqual({
      lat: String(SPAIN_CITY_COORDS.Barcelona.lat),
      lon: String(SPAIN_CITY_COORDS.Barcelona.lon),
    });
    expect(merged.some((c) => c.country === "GR")).toBe(false);
  });

  it("does not inject Spanish cities for Greece companies", () => {
    const merged = mergeOperatingCityCatalog([thessaloniki], { country: "GR" });
    expect(merged.map((c) => c.name)).toEqual(["Thessaloniki"]);
  });

  it("lets a platform row win over the Spain fallback of the same name", () => {
    const platform = [
      {
        _id: "64a1b2c3d4e5f60718293a4c",
        name: "Barcelona",
        country: "ES",
        coords: { lat: "1", lon: "2" },
      },
    ];
    const merged = mergeOperatingCityCatalog(platform, { country: "ES" });
    const barcelona = merged.filter((c) => c.name === "Barcelona");
    expect(barcelona).toHaveLength(1);
    expect(barcelona[0]._id).toBe("64a1b2c3d4e5f60718293a4c");
  });
});

describe("citiesWithinRadius", () => {
  it("finds Barcelona-area cities inside 25 km (the old catalog-only search found none)", () => {
    const catalog = mergeOperatingCityCatalog([], { country: "ES" });
    const within = citiesWithinRadius(catalog, barcelonaBase, 25).map(
      (c) => c.name
    );
    expect(within).toContain("Barcelona");
    expect(within).toContain("Barcelona Airport");
    expect(within).not.toContain("Madrid");
    expect(within).not.toContain("Girona");
  });

  it("returns nothing without base coordinates", () => {
    const catalog = mergeOperatingCityCatalog([], { country: "ES" });
    expect(citiesWithinRadius(catalog, null, 25)).toEqual([]);
  });
});

describe("city id mapping", () => {
  it("keeps only real platform ObjectIds when saving cityIds", () => {
    const catalog = mergeOperatingCityCatalog([thessaloniki], { country: "ALL" });
    expect(
      selectedCityIdsFromCatalog(["Thessaloniki", "Barcelona"], catalog)
    ).toEqual(["64a1b2c3d4e5f60718293a4b"]);
  });

  it("resolves saved cityIds back to names", () => {
    expect(
      cityNamesFromCityIds(["64a1b2c3d4e5f60718293a4b"], [thessaloniki])
    ).toEqual(["Thessaloniki"]);
  });
});
