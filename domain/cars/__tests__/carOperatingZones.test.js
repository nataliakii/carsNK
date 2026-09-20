import { resolveCarOperatingZones } from "../carOperatingZones";

describe("resolveCarOperatingZones", () => {
  it("prefers the company's configured operating cities", () => {
    const zones = resolveCarOperatingZones({
      car: { offices: ["Airport"] },
      company: {
        deliveryPricing: { operatingCities: ["Barcelona", "Girona"] },
        locations: [{ name: "Madrid" }],
      },
      zoneNames: ["Sitges"],
    });
    expect(zones).toEqual(["Barcelona", "Girona"]);
  });

  it("falls back to zone names, then company locations, then offices", () => {
    const car = { offices: ["Airport"] };
    expect(
      resolveCarOperatingZones({ car, company: {}, zoneNames: ["Sitges"] })
    ).toEqual(["Sitges"]);
    expect(
      resolveCarOperatingZones({
        car,
        company: { locations: [{ name: "Madrid" }] },
        zoneNames: [],
      })
    ).toEqual(["Madrid"]);
    expect(resolveCarOperatingZones({ car, company: {} })).toEqual(["Airport"]);
  });

  it("drops blanks and duplicates", () => {
    const zones = resolveCarOperatingZones({
      car: {},
      company: {},
      zoneNames: [" Girona ", "", null, "Girona", "Blanes"],
    });
    expect(zones).toEqual(["Girona", "Blanes"]);
  });

  it("returns an empty list when nothing is configured", () => {
    expect(resolveCarOperatingZones({ car: {}, company: {} })).toEqual([]);
  });
});
