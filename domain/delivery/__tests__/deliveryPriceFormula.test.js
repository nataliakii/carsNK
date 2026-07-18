const { computeZoneDeliveryPrice } = require("../deliveryPriceFormula");

describe("computeZoneDeliveryPrice", () => {
  test("null zone returns 0", () => {
    expect(computeZoneDeliveryPrice(null, 1)).toBe(0);
  });

  test("free delivery returns 0", () => {
    expect(
      computeZoneDeliveryPrice(
        { distanceKm: 50, isFreeDelivery: true },
        2
      )
    ).toBe(0);
  });

  test("fixedPrice overrides distance-based calculation", () => {
    expect(
      computeZoneDeliveryPrice(
        { distanceKm: 999, fixedPrice: 45 },
        2
      )
    ).toBe(45);
  });

  test("distance x pricePerKm is calculated one-way and rounded to cents", () => {
    expect(computeZoneDeliveryPrice({ distanceKm: 10 }, 1.5)).toBe(15);
    expect(computeZoneDeliveryPrice({ distanceKm: 1 }, 0.333)).toBe(0.33);
  });

  test("fixedPrice 0 is treated as an explicit fixed zero price", () => {
    expect(
      computeZoneDeliveryPrice({ distanceKm: 5, fixedPrice: 0 }, 1)
    ).toBe(0);
  });

  test("fixedPrice null or undefined falls through to distance-based calculation", () => {
    expect(
      computeZoneDeliveryPrice({ distanceKm: 5, fixedPrice: null }, 1)
    ).toBe(5);
    expect(
      computeZoneDeliveryPrice({ distanceKm: 5, fixedPrice: undefined }, 1)
    ).toBe(5);
  });

  test("missing or invalid numeric inputs return 0 instead of NaN", () => {
    expect(computeZoneDeliveryPrice({ distanceKm: undefined }, 1)).toBe(0);
    expect(computeZoneDeliveryPrice({ distanceKm: 5 }, undefined)).toBe(0);
    expect(computeZoneDeliveryPrice({ distanceKm: -5 }, 1)).toBe(0);
    expect(computeZoneDeliveryPrice({ distanceKm: 5 }, -1)).toBe(0);
  });
});
