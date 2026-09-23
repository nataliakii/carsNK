import { computeZoneDeliveryPrice } from "../deliveryPriceFormula";
import {
  chargeableKmBeyondRadius,
  computeRuleDeliveryPrice,
  hasActiveDeliveryPricing,
  isAfterWorkingHours,
  nextDeliveryPricingVersion,
  normalizeDeliveryPricingInput,
} from "../deliveryPricingPolicy";

describe("deliveryPricingPolicy", () => {
  test("Barcelona-style: inside fixed, outside perKm from boundary, after-hours surcharge", () => {
    const policy = {
      radiusKm: 15,
      inside: { mode: "fixed", amount: 25 },
      outside: { mode: "perKm", amount: 1.2 },
      afterHoursSurcharge: 20,
    };

    const inside = computeRuleDeliveryPrice({
      distanceKm: 8,
      policy,
      isAfterHours: false,
    });
    expect(inside).toMatchObject({
      price: 25,
      region: "inside",
      blocked: false,
    });

    const outside = computeRuleDeliveryPrice({
      distanceKm: 25,
      policy,
      isAfterHours: false,
    });
    // 25 - 15 = 10 km × 1.2
    expect(outside.price).toBe(12);
    expect(outside.region).toBe("outside");
    expect(outside.chargeableKm).toBe(10);

    const afterHours = computeRuleDeliveryPrice({
      distanceKm: 8,
      policy,
      isAfterHours: true,
    });
    expect(afterHours.price).toBe(45);
  });

  test("outside blocked when mode blocked and no zone", () => {
    const result = computeRuleDeliveryPrice({
      distanceKm: 40,
      policy: {
        radiusKm: 10,
        inside: { mode: "free", amount: 0 },
        outside: { mode: "blocked", amount: 0 },
        afterHoursSurcharge: 0,
      },
    });
    expect(result.blocked).toBe(true);
    expect(result.price).toBe(0);
  });

  test("named zone override uses zone formula", () => {
    const result = computeRuleDeliveryPrice({
      distanceKm: 50,
      policy: {
        radiusKm: 10,
        inside: { mode: "fixed", amount: 25 },
        outside: { mode: "blocked", amount: 0 },
        afterHoursSurcharge: 0,
      },
      matchedOutsideZone: {
        distanceKm: 50,
        fixedPrice: 40,
        isFreeDelivery: false,
      },
      computeZonePrice: (z) => computeZoneDeliveryPrice(z, 1),
    });
    expect(result.usedZone).toBe(true);
    expect(result.price).toBe(40);
  });

  test("chargeableKmBeyondRadius and hasActiveDeliveryPricing", () => {
    expect(chargeableKmBeyondRadius(20, 15)).toBe(5);
    expect(chargeableKmBeyondRadius(10, 15)).toBe(0);
    expect(hasActiveDeliveryPricing({ radiusKm: 0 })).toBe(true);
    expect(hasActiveDeliveryPricing({ radiusKm: null })).toBe(false);
  });

  test("isAfterWorkingHours", () => {
    expect(isAfterWorkingHours("07:00", { start: "08:00", end: "22:00" })).toBe(
      true
    );
    expect(isAfterWorkingHours("12:00", { start: "08:00", end: "22:00" })).toBe(
      false
    );
    expect(isAfterWorkingHours("22:00", { start: "08:00", end: "22:00" })).toBe(
      true
    );
  });

  test("deliveryPricing version is monotonic and bumps only on content change", () => {
    const previous = {
      strategy: "radius",
      radiusKm: 15,
      operatingCities: [],
      maxDistanceKm: null,
      inside: { mode: "fixed", amount: 25 },
      outside: { mode: "perKm", amount: 1 },
      afterHoursSurcharge: 0,
      version: 3,
    };
    expect(nextDeliveryPricingVersion({ radiusKm: 15 }, previous)).toBe(3);
    expect(nextDeliveryPricingVersion({ radiusKm: 20 }, previous)).toBe(4);
    const normalized = normalizeDeliveryPricingInput(
      {
        radiusKm: 20,
        inside: { mode: "fixed", amount: 25 },
        outside: { mode: "perKm", amount: 1 },
      },
      { deliveryPricing: previous, deliveryPricePerKm: 1 }
    );
    expect(normalized.ok).toBe(true);
    expect(normalized.value.version).toBe(4);
  });
});
