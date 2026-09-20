const {
  SPAIN_CITY_OPTIONS,
  DEFAULT_SPAIN_BOOKING_LOCATION,
  isSpainCityOption,
  spainCityRequiresAddressDetail,
  filterSpainCityOptions,
  normalizeSpainCitySearchText,
} = require("../spainCityOptions");
const {
  isSpainBookingSite,
  resolveCatalogPlaceOptions,
  resolveCatalogDefaultPlace,
  resolvePlaceRequiresAddressDetail,
} = require("../catalogPlaceOptions");

describe("spainCityOptions", () => {
  test("includes hubs, Costa Brava, provincial capitals, and airports", () => {
    expect(SPAIN_CITY_OPTIONS).toEqual(
      expect.arrayContaining([
        "Barcelona",
        "Girona",
        "Madrid",
        "Valencia",
        "Costa Brava",
        "Lloret de Mar",
        "Marbella",
        "Ibiza",
        "Salamanca",
        "Vitoria-Gasteiz",
        "Barcelona Airport",
        "Girona Airport",
        "Tenerife South Airport",
      ])
    );
    expect(SPAIN_CITY_OPTIONS.length).toBeGreaterThanOrEqual(70);
    expect(DEFAULT_SPAIN_BOOKING_LOCATION).toBe("Barcelona");
  });

  test("cities require address detail; airports do not", () => {
    expect(spainCityRequiresAddressDetail("Barcelona")).toBe(true);
    expect(spainCityRequiresAddressDetail("Madrid")).toBe(true);
    expect(spainCityRequiresAddressDetail("Barcelona Airport")).toBe(false);
    expect(spainCityRequiresAddressDetail("Unknown")).toBe(false);
    expect(isSpainCityOption("sevilla")).toBe(true);
    expect(isSpainCityOption("Málaga")).toBe(true);
  });

  test("search is accent-insensitive and uses aliases", () => {
    expect(normalizeSpainCitySearchText("Málaga")).toBe("malaga");
    expect(filterSpainCityOptions("malaga")).toEqual(
      expect.arrayContaining(["Malaga", "Malaga Airport"])
    );
    expect(filterSpainCityOptions("córdoba")).toContain("Cordoba");
    expect(filterSpainCityOptions("donostia")).toContain("San Sebastian");
    expect(filterSpainCityOptions("bcn")).toEqual(
      expect.arrayContaining(["Barcelona", "Barcelona Airport"])
    );
    expect(filterSpainCityOptions("zzzz-not-a-city")).toEqual([]);
  });
});

describe("catalogPlaceOptions", () => {
  test("Spain uses curated cities and keeps company extras", () => {
    expect(isSpainBookingSite("ES")).toBe(true);
    expect(isSpainBookingSite("GR")).toBe(false);
    const names = resolveCatalogPlaceOptions(["Custom Hub"], "ES");
    expect(names[0]).toBe("Barcelona");
    expect(names).toContain("Custom Hub");
    expect(resolveCatalogDefaultPlace("Vrasna", "ES")).toBe("Barcelona");
  });

  test("Greece keeps company location list", () => {
    expect(resolveCatalogPlaceOptions(["Vrasna", "Airport"], "GR")).toEqual([
      "Vrasna",
      "Airport",
    ]);
    expect(resolveCatalogDefaultPlace("Vrasna", "GR")).toBe("Vrasna");
  });

  test("Spain requires address for cities via resolvePlaceRequiresAddressDetail", () => {
    expect(
      resolvePlaceRequiresAddressDetail("Girona", () => false, "ES")
    ).toBe(true);
    expect(
      resolvePlaceRequiresAddressDetail("Madrid Airport", () => false, "ES")
    ).toBe(false);
    expect(
      resolvePlaceRequiresAddressDetail("Thessaloniki", () => true, "GR")
    ).toBe(true);
  });
});
