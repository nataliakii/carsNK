const {
  sortDeliveryZones,
  getPriorityRank,
  normalizeLocationName,
} = require("../sortDeliveryZones");

describe("sortDeliveryZones", () => {
  test("prioritizes airport, thessaloniki, and nea kallikratia before alphabetical remainder", () => {
    const zones = [
      { _id: "4", name: "Sani", slug: "sani" },
      { _id: "2", name: "Thessaloniki", slug: "thessaloniki" },
      { _id: "5", name: "Afytos", slug: "afytos" },
      { _id: "1", name: "Airport", slug: "airport" },
      { _id: "3", name: "Nea Kallikratia", slug: "nea-kallikratia" },
    ];

    expect(sortDeliveryZones(zones).map((zone) => zone.name)).toEqual([
      "Airport",
      "Thessaloniki",
      "Nea Kallikratia",
      "Afytos",
      "Sani",
    ]);
  });

  test("recognizes localized or slightly different priority names", () => {
    const zones = [
      { _id: "3", name: "Неа Каликратия", slug: "nea-kalikratiya" },
      { _id: "2", name: "Solun Center", slug: "solun-center" },
      { _id: "1", name: "Aerodrom", slug: "aerodrom" },
      { _id: "4", name: "Vourvourou", slug: "vourvourou" },
    ];

    expect(sortDeliveryZones(zones).map((zone) => zone.name)).toEqual([
      "Aerodrom",
      "Solun Center",
      "Неа Каликратия",
      "Vourvourou",
    ]);
  });

  test("keeps alphabetical ordering predictable inside the non-priority group", () => {
    const zones = [
      { _id: "b", name: "Sarti", slug: "sarti" },
      { _id: "a", name: "Afitos", slug: "afitos" },
      { _id: "c", name: "Nikiti", slug: "nikiti" },
    ];

    expect(sortDeliveryZones(zones).map((zone) => zone.name)).toEqual([
      "Afitos",
      "Nikiti",
      "Sarti",
    ]);
  });

  test("uses slug and id fallbacks for deterministic order of very similar names", () => {
    const zones = [
      { _id: "2", name: "Airport", slug: "airport-b" },
      { _id: "1", name: "Airport", slug: "airport-a" },
    ];

    expect(sortDeliveryZones(zones).map((zone) => zone.slug)).toEqual([
      "airport-a",
      "airport-b",
    ]);
  });
});

describe("delivery zone sort helpers", () => {
  test("normalizes accents, punctuation, and casing", () => {
    expect(normalizeLocationName("  Néa-Kallikratia  ")).toBe(
      "nea kallikratia"
    );
  });

  test("assigns fallback rank to non-priority locations", () => {
    expect(getPriorityRank("Nikiti")).toBe(3);
  });
});
