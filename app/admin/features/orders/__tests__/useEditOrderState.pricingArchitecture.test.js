import {
  isExplicitTotalPriceSource,
  getOriginalTotalPrice,
  buildTotalPricePayload,
  buildReactivePriceSyncResult,
  hasRentalRateChanged,
} from "../hooks/useEditOrderState";

describe("useEditOrderState pricing architecture invariants", () => {
  describe("isExplicitTotalPriceSource", () => {
    test("allows only manual and confirmed recalculation sources", () => {
      expect(isExplicitTotalPriceSource("manual")).toBe(true);
      expect(isExplicitTotalPriceSource("confirmed_recalculation")).toBe(true);
      // Backward compatibility for older caller in modal
      expect(isExplicitTotalPriceSource("admin_recalculate_confirmed")).toBe(
        true
      );

      expect(isExplicitTotalPriceSource(undefined)).toBe(false);
      expect(isExplicitTotalPriceSource("auto")).toBe(false);
      expect(isExplicitTotalPriceSource("recalculate")).toBe(false);
      expect(isExplicitTotalPriceSource("background")).toBe(false);
    });
  });

  describe("getOriginalTotalPrice", () => {
    test("prioritizes stored breakdown over mutable editedOrder.totalPrice", () => {
      const storedBreakdown = { totalPrice: 224 };
      const editedOrder = { totalPrice: 336 };
      expect(getOriginalTotalPrice(storedBreakdown, editedOrder)).toBe(224);
    });

    test("falls back to edited order total when no stored breakdown", () => {
      expect(getOriginalTotalPrice(null, { totalPrice: 360 })).toBe(360);
      expect(getOriginalTotalPrice(undefined, { totalPrice: 0 })).toBe(0);
    });
  });

  describe("buildTotalPricePayload", () => {
    test("uses manual override as final payload price", () => {
      const result = buildTotalPricePayload({
        orderSnapshot: { totalPrice: 224, OverridePrice: 300 },
        storedBreakdown: { totalPrice: 224 },
        priceBreakdown: null,
        priceRecalculated: false,
      });

      expect(result).toEqual({ totalPrice: 300, isOverridePrice: true });
    });

    test("uses recalculated grand total only after explicit recalculation", () => {
      const result = buildTotalPricePayload({
        orderSnapshot: { totalPrice: 224, OverridePrice: null },
        storedBreakdown: { totalPrice: 224 },
        priceBreakdown: {
          baseRentalTotal: 300,
          kaskoTotal: 40,
          childSeatsTotal: 20,
          secondDriverTotal: 0,
          deliveryTotal: 12,
          dailyRates: [],
        },
        priceRecalculated: true,
      });

      expect(result).toEqual({ totalPrice: 372, isOverridePrice: false });
    });

    test("keeps immutable stored price when recalculation is not confirmed", () => {
      const result = buildTotalPricePayload({
        orderSnapshot: { totalPrice: 336, OverridePrice: null },
        storedBreakdown: { totalPrice: 224 },
        priceBreakdown: {
          baseRentalTotal: 300,
          deliveryTotal: 12,
          dailyRates: [],
        },
        priceRecalculated: false,
      });

      expect(result).toEqual({ totalPrice: 224, isOverridePrice: false });
    });
  });

  describe("buildReactivePriceSyncResult", () => {
    test("returns null when pricing inputs are incomplete", () => {
      expect(
        buildReactivePriceSyncResult({
          editedOrder: { totalPrice: 100 },
          currentBookingPriceSummary: null,
          currentRatesData: { days: 3, breakdown: null },
        })
      ).toBeNull();
    });

    test("applies reactive total and preserves manual override metadata", () => {
      const result = buildReactivePriceSyncResult({
        editedOrder: {
          totalPrice: 224,
          numberOfDays: 2,
          OverridePrice: 300,
          placeIn: "Airport",
        },
        currentBookingPriceSummary: {
          totalPrice: 372,
        },
        currentRatesData: {
          days: 4,
          breakdown: {
            baseRentalTotal: 300,
            deliveryTotal: 72,
          },
        },
      });

      expect(result).toEqual({
        orderSnapshot: {
          totalPrice: 372,
          numberOfDays: 4,
          OverridePrice: 300,
          placeIn: "Airport",
        },
        priceBreakdown: {
          baseRentalTotal: 300,
          deliveryTotal: 72,
        },
      });
    });
  });

  describe("hasRentalRateChanged", () => {
    test("compares rental only and ignores delivery totals", () => {
      const changed = hasRentalRateChanged({
        storedBreakdownLoaded: true,
        currentRatesData: {
          totalPrice: 360, // API rental total
          breakdown: { deliveryTotal: 100 },
        },
        storedBreakdown: {
          totalPrice: 224,
          baseRentalTotal: 300,
          kaskoTotal: 40,
          childSeatsTotal: 20,
          secondDriverTotal: 0, // saved rental subtotal = 360
          deliveryTotal: 0,
          dailyRates: [],
        },
      });

      expect(changed).toBe(false);
    });

    test("returns true when rental subtotal actually changed", () => {
      const changed = hasRentalRateChanged({
        storedBreakdownLoaded: true,
        currentRatesData: { totalPrice: 372 },
        storedBreakdown: {
          baseRentalTotal: 300,
          kaskoTotal: 40,
          childSeatsTotal: 20,
          secondDriverTotal: 0,
          deliveryTotal: 50,
          dailyRates: [],
        },
      });

      expect(changed).toBe(true);
    });
  });
});
