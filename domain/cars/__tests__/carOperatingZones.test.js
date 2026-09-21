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

  it("falls back to car offices when the company has no operating cities", () => {
    expect(
      resolveCarOperatingZones({
        car: { offices: ["Airport"] },
        company: { locations: [{ name: "Madrid" }] },
        zoneNames: ["Sitges"],
      })
    ).toEqual(["Airport"]);
  });

  it("ignores the booking catalog even when it is the only long list", () => {
    const catalog = ["Barcelona", "Girona", "Costa Brava", "Madrid", "Valencia"];
    expect(
      resolveCarOperatingZones({
        car: {},
        company: {},
        zoneNames: catalog,
      })
    ).toEqual([]);
  });

  it("drops blanks and duplicates on offices", () => {
    const zones = resolveCarOperatingZones({
      car: { offices: [" Girona ", "", null, "Girona", "Blanes"] },
      company: {},
    });
    expect(zones).toEqual(["Girona", "Blanes"]);
  });

  it("returns an empty list when nothing is configured", () => {
    expect(resolveCarOperatingZones({ car: {}, company: {} })).toEqual([]);
  });
});
