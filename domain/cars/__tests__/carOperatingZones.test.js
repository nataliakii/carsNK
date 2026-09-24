import { resolveCarOperatingZones } from "../carOperatingZones";

describe("resolveCarOperatingZones", () => {
  it("prefers the company's configured operating cities", () => {
    const zones = resolveCarOperatingZones({
      car: { offices: ["Airport"] },
      company: {
        country: "ES",
        deliveryPricing: { operatingCities: ["Barcelona", "Girona"] },
        locations: [{ name: "Madrid" }],
        offices: [{ id: "o1", name: "QA Office A" }],
      },
      zoneNames: ["Sitges"],
    });
    expect(zones).toEqual(["Barcelona", "Girona"]);
  });

  it("uses company locations when no operating cities or cityIds are set", () => {
    expect(
      resolveCarOperatingZones({
        car: { offices: ["Airport"] },
        company: { country: "ES", locations: [{ name: "Madrid" }] },
        zoneNames: ["Sitges"],
      })
    ).toEqual(["Madrid"]);
  });

  it("resolves cityIds against the platform catalog", () => {
    expect(
      resolveCarOperatingZones({
        car: {},
        company: { cityIds: ["c1", "c2"], country: "ES" },
        catalogCities: [
          { _id: "c1", name: "Barcelona", country: "ES" },
          { _id: "c2", name: "Sants", country: "ES", kind: "commune" },
          { _id: "c3", name: "Madrid", country: "ES" },
        ],
      })
    ).toEqual(["Barcelona", "Sants"]);
  });

  it("prefers pre-resolved deliveryAreaNames from the coverage API", () => {
    expect(
      resolveCarOperatingZones({
        car: { offices: ["Airport"] },
        company: {
          deliveryPricing: { operatingCities: ["Ignored"] },
        },
        deliveryAreaNames: ["Eixample", "Sants", "Eixample"],
      })
    ).toEqual(["Eixample", "Sants"]);
  });

  it("never falls back to office names", () => {
    expect(
      resolveCarOperatingZones({
        car: { offices: ["QA Office A", "QA Office B"] },
        company: {
          offices: [
            { id: "a", name: "QA Office A Eixample" },
            { id: "b", name: "QA Office B Sants" },
          ],
        },
      })
    ).toEqual([]);
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

  it("returns an empty list when nothing is configured", () => {
    expect(resolveCarOperatingZones({ car: {}, company: {} })).toEqual([]);
  });
});
