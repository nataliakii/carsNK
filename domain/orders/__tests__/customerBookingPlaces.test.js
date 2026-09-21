import { resolveAllowedCustomerPlaceNames } from "../customerBookingPlaces";

describe("resolveAllowedCustomerPlaceNames", () => {
  test("Spain catalog includes Barcelona even when owner list is Greek", () => {
    const names = resolveAllowedCustomerPlaceNames({
      countryCode: "ES",
      company: { country: "ES" },
      car: { offices: [] },
      ownerBookingCityNames: ["Airport", "Nea Kallikratia"],
    });
    expect(names).toContain("Barcelona");
    expect(names).toContain("Airport");
  });

  test("Spain allows car offices that are not in the owner list", () => {
    const names = resolveAllowedCustomerPlaceNames({
      countryCode: "ES",
      company: { country: "ES", address: "Carrer Office 1" },
      car: { offices: [{ name: "Rovaro Office", address: "Carrer Office 1" }] },
      ownerBookingCityNames: ["Airport"],
    });
    expect(names).toContain("Rovaro Office");
    expect(names).toContain("Barcelona");
  });

  test("Greece keeps owner booking locations and offices", () => {
    const names = resolveAllowedCustomerPlaceNames({
      countryCode: "GR",
      company: { country: "GR" },
      car: { offices: ["Airport"] },
      ownerBookingCityNames: ["Airport", "Nea Kallikratia"],
    });
    expect(names).toEqual(["Airport", "Nea Kallikratia"]);
    expect(names).not.toContain("Barcelona");
  });

  test("Spain does not treat leftover Greek HQ as an office", () => {
    const names = resolveAllowedCustomerPlaceNames({
      countryCode: "ES",
      company: {
        country: "GR",
        name: "Natali Cars",
        address: "Leoforos Nikisis, Kato Galini, Nea Kallikratia 63080, Greece",
        locations: [{ name: "Nea Kallikratia" }],
        deliveryPricing: { operatingCities: ["Barcelona"] },
      },
      car: { offices: [] },
      ownerBookingCityNames: ["Airport"],
    });
    expect(names).toContain("Barcelona");
    expect(names.filter((n) => /kallikratia/i.test(n))).toEqual([]);
  });

  test("cities strategy allows operating cities plus offices", () => {
    const names = resolveAllowedCustomerPlaceNames({
      countryCode: "GR",
      company: {
        country: "GR",
        deliveryPricing: {
          strategy: "cities",
          operatingCities: ["Thessaloniki"],
        },
      },
      car: { offices: ["Airport"] },
      ownerBookingCityNames: ["Nea Kallikratia"],
    });
    expect(names).toContain("Thessaloniki");
    expect(names).toContain("Airport");
    expect(names).toContain("Nea Kallikratia");
  });
});
