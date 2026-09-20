/**
 * @jest-environment node
 */

import {
  normalizeOperatingCities,
  resolveDeliveryStrategy,
  addressMatchesOperatingCity,
  computeCityStrategyLegPrice,
  isCityInOperatingList,
} from "../cityDeliveryPricing";
import {
  normalizeCarOffices,
  isPlaceMatchingCarOffice,
  applyCarOfficeFreeDelivery,
  buildBookingPlaceOptionsWithOffices,
} from "@/domain/orders/carOffices";

describe("cityDeliveryPricing", () => {
  test("resolves cities strategy when operatingCities set", () => {
    expect(
      resolveDeliveryStrategy({
        operatingCities: ["Barcelona"],
        outside: { mode: "perKm", amount: 1 },
      })
    ).toBe("cities");
  });

  test("resolves radius strategy when radiusKm set", () => {
    expect(resolveDeliveryStrategy({ radiusKm: 15 })).toBe("radius");
  });

  test("inside listed city by locality is free", () => {
    const leg = computeCityStrategyLegPrice({
      policy: {
        strategy: "cities",
        operatingCities: ["Barcelona"],
        inside: { mode: "free", amount: 0 },
        outside: { mode: "perKm", amount: 1 },
      },
      placeName: "Barcelona",
      address: "Carrer de Mallorca 1, Barcelona",
      locality: "Barcelona",
      addressCoords: { lat: 41.4, lon: 2.17 },
      distanceFromOfficeKm: 8,
      company: { coords: { lat: "41.39", lon: "2.15" } },
    });
    expect(leg.region).toBe("inside_city");
    expect(leg.price).toBe(0);
  });

  test("outside city charges per km from office", () => {
    const leg = computeCityStrategyLegPrice({
      policy: {
        strategy: "cities",
        operatingCities: ["Barcelona"],
        inside: { mode: "free", amount: 0 },
        outside: { mode: "perKm", amount: 1 },
      },
      placeName: "Barcelona",
      address: "Sitges, Spain",
      locality: "Sitges",
      addressCoords: { lat: 41.23, lon: 1.8 },
      distanceFromOfficeKm: 42,
      company: { coords: { lat: "41.39", lon: "2.15" } },
    });
    expect(leg.region).toBe("outside_city");
    expect(leg.price).toBe(42);
    expect(leg.chargeableKm).toBe(42);
  });

  test("optional free radius subtracts from chargeable km", () => {
    const leg = computeCityStrategyLegPrice({
      policy: {
        strategy: "cities",
        operatingCities: ["Barcelona"],
        radiusKm: 10,
        inside: { mode: "free", amount: 0 },
        outside: { mode: "perKm", amount: 1 },
      },
      placeName: "Barcelona",
      locality: "Sitges",
      address: "Sitges",
      distanceFromOfficeKm: 42,
      company: { coords: { lat: "41.39", lon: "2.15" } },
    });
    expect(leg.chargeableKm).toBe(32);
    expect(leg.price).toBe(32);
  });

  test("addressMatchesOperatingCity matches substring", () => {
    expect(
      addressMatchesOperatingCity({
        address: "Hotel X, Barcelona, Spain",
        locality: "",
        placeCity: "",
        operatingCities: ["Barcelona"],
      })
    ).toBe(true);
  });

  test("normalizeOperatingCities dedupes", () => {
    expect(normalizeOperatingCities(["Barcelona", " barcelona ", ""])).toEqual([
      "Barcelona",
    ]);
  });

  test("isCityInOperatingList", () => {
    expect(isCityInOperatingList("Barcelona", ["Barcelona", "Madrid"])).toBe(
      true
    );
    expect(isCityInOperatingList("Sitges", ["Barcelona"])).toBe(false);
  });
});

describe("carOffices", () => {
  test("normalizes string and object offices", () => {
    expect(normalizeCarOffices(["Airport", { name: "Barcelona", address: "C/1" }])).toEqual([
      { name: "Airport", address: "", lat: "", lon: "" },
      { name: "Barcelona", address: "C/1", lat: "", lon: "" },
    ]);
  });

  test("office match is free in delivery result", () => {
    const applied = applyCarOfficeFreeDelivery(
      {
        deliveryIn: 20,
        deliveryOut: 15,
        deliveryTotal: 35,
        placeIn: "Barcelona",
        placeOut: "Madrid",
      },
      [{ name: "Barcelona" }]
    );
    expect(applied.deliveryIn).toBe(0);
    expect(applied.deliveryOut).toBe(15);
    expect(applied.officeFreeIn).toBe(true);
    expect(applied.officeFreeOut).toBe(false);
  });

  test("buildBookingPlaceOptionsWithOffices puts offices first", () => {
    const opts = buildBookingPlaceOptionsWithOffices({
      cityNames: ["Barcelona", "Madrid"],
      carOffices: [{ name: "Barcelona", address: "Calle Office 1" }],
      company: { address: "Calle Office 1" },
      freeNote: "Free at office",
    });
    expect(opts[0].kind).toBe("office");
    expect(opts[0].address).toContain("Office");
    expect(opts[0].free).toBe(true);
    expect(opts.some((o) => o.value === "Madrid" && o.kind === "city")).toBe(
      true
    );
  });

  test("isPlaceMatchingCarOffice aliases Airport", () => {
    expect(isPlaceMatchingCarOffice("airport", ["Airport"])).toBe(true);
  });
});
