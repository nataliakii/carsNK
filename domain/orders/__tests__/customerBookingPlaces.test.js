import { resolveAllowedCustomerPlaceNames } from "../customerBookingPlaces";

describe("resolveAllowedCustomerPlaceNames", () => {
  test("Spain company with Barcelona coverage does not receive the Spain catalog or Greek list", () => {
    const names = resolveAllowedCustomerPlaceNames({
      countryCode: "ES",
      company: {
        _id: "es-bcn",
        country: "ES",
        deliveryPricing: { operatingCities: ["Barcelona"] },
        locations: [{ name: "Olympiada" }],
      },
      car: { offices: [] },
      ownerBookingCityNames: ["Airport", "Nea Kallikratia", "Madrid"],
    });
    expect(names).toEqual(["Barcelona"]);
  });

  test("car office remains bookable without becoming a delivery city from the catalog", () => {
    const names = resolveAllowedCustomerPlaceNames({
      countryCode: "ES",
      company: {
        _id: "es-office",
        country: "ES",
        deliveryPricing: { operatingCities: ["Barcelona"] },
        offices: [
          {
            _id: "desk-1",
            name: "Rovaro Office",
            address: "Carrer Office 1",
            country: "ES",
            status: "active",
          },
        ],
      },
      car: { ownerId: "es-office", officeScope: "all" },
      ownerBookingCityNames: ["Airport"],
    });
    expect(names).toContain("Barcelona");
    expect(names).toContain("Rovaro Office");
    expect(names).not.toContain("Madrid");
  });

  test("Greece keeps saved coverage and drops Spanish catalog names", () => {
    const names = resolveAllowedCustomerPlaceNames({
      countryCode: "GR",
      company: {
        _id: "gr-1",
        country: "GR",
        deliveryPricing: { operatingCities: ["Olympiada", "Kriopigi"] },
        offices: [
          {
            _id: "gr-desk",
            name: "Airport",
            country: "GR",
            status: "active",
          },
        ],
      },
      car: { ownerId: "gr-1", officeScope: "all" },
      ownerBookingCityNames: ["Nea Kallikratia", "Barcelona"],
    });
    expect(names).toEqual(["Kriopigi", "Olympiada", "Airport"]);
  });
});
