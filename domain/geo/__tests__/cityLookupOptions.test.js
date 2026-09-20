import {
  catalogCityOption,
  cityOptionLabel,
  foldCityText,
  matchesCityQuery,
  mergeCityLookupOptions,
} from "@/domain/geo/cityLookupOptions";

const thessaloniki = {
  _id: "1",
  name: "Thessaloniki",
  country: "GR",
  coords: { lat: "40.6401", lon: "22.9444" },
};
const cadaques = {
  _id: "2",
  name: "Cadaqués",
  country: "ES",
  coords: { lat: "42.2887", lng: "3.2778" },
};
const noCoords = { _id: "3", name: "Sarti", country: "GR" };

describe("catalogCityOption", () => {
  it("keeps cities with coords and accepts lng as an alias for lon", () => {
    expect(catalogCityOption(thessaloniki).coords).toEqual({
      lat: "40.6401",
      lon: "22.9444",
    });
    expect(catalogCityOption(cadaques).coords).toEqual({
      lat: "42.2887",
      lon: "3.2778",
    });
  });

  it("drops cities without coords", () => {
    expect(catalogCityOption(noCoords)).toBeNull();
    expect(catalogCityOption(null)).toBeNull();
  });
});

describe("matchesCityQuery", () => {
  const option = catalogCityOption(cadaques);

  it("is accent- and case-insensitive", () => {
    expect(matchesCityQuery(option, "cadaques")).toBe(true);
    expect(matchesCityQuery(option, "CADAQUÉS")).toBe(true);
  });

  it("matches on country and searchText tokens", () => {
    expect(matchesCityQuery(option, "es")).toBe(true);
    expect(matchesCityQuery(option, "athens")).toBe(false);
  });

  it("treats an empty query as a match", () => {
    expect(matchesCityQuery(option, "")).toBe(true);
  });
});

describe("mergeCityLookupOptions", () => {
  const catalogOptions = [thessaloniki, noCoords, cadaques]
    .map(catalogCityOption)
    .filter(Boolean);

  it("lists matching catalog cities before Places predictions", () => {
    const merged = mergeCityLookupOptions({
      catalogOptions,
      predictions: [
        { placeId: "p1", mainText: "Barcelona", secondaryText: "Spain" },
      ],
      query: "ca",
    });
    expect(merged.map((o) => [o.source, o.name])).toEqual([
      ["catalog", "Cadaqués"],
      ["places", "Barcelona"],
    ]);
  });

  it("returns Places results for cities missing from the catalog", () => {
    const merged = mergeCityLookupOptions({
      catalogOptions,
      predictions: [
        { placeId: "p1", mainText: "Barcelona", secondaryText: "Spain" },
        { placeId: "p2", mainText: "Girona", secondaryText: "Spain" },
      ],
      query: "barcelona",
    });
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ source: "places", placeId: "p1" });
  });

  it("does not repeat a city that the catalog already provides", () => {
    const merged = mergeCityLookupOptions({
      catalogOptions,
      predictions: [
        { placeId: "p3", mainText: "Thessaloniki", secondaryText: "Greece" },
      ],
      query: "thessaloniki",
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("catalog");
  });

  it("skips predictions without a placeId", () => {
    const merged = mergeCityLookupOptions({
      catalogOptions: [],
      predictions: [{ mainText: "Nowhere" }, { placeId: "", mainText: "X" }],
      query: "no",
    });
    expect(merged).toEqual([]);
  });
});

describe("cityOptionLabel", () => {
  it("appends the secondary text when present", () => {
    expect(cityOptionLabel(catalogCityOption(thessaloniki))).toBe(
      "Thessaloniki (GR)"
    );
    expect(cityOptionLabel({ name: "Madrid" })).toBe("Madrid");
    expect(cityOptionLabel(null)).toBe("");
  });
});

describe("foldCityText", () => {
  it("collapses whitespace and strips diacritics", () => {
    expect(foldCityText("  Platja  d'Aro ")).toBe("platja d'aro");
    expect(foldCityText("Málaga")).toBe("malaga");
  });
});
