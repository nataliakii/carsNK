import {
  buildBookingPriceSummary,
  buildBookingPriceSummaryFromBreakdown,
  createEmptyBookingPriceSummary,
} from "../bookingPriceSummary";

describe("bookingPriceSummary", () => {
  test("returns empty fallback when input is missing", () => {
    expect(buildBookingPriceSummary(null)).toEqual(
      createEmptyBookingPriceSummary()
    );
  });

  test("adds delivery total to rental total when breakdown is available", () => {
    expect(
      buildBookingPriceSummary({
        days: 4,
        totalPrice: 120,
        breakdown: {
          deliveryTotal: 35.5,
        },
      })
    ).toEqual({
      days: 4,
      rentalPrice: 120,
      deliveryCost: 35.5,
      pickupDeliveryCost: null,
      returnDeliveryCost: null,
      totalPrice: 155.5,
      deliveryStatus: "ready",
    });
  });

  test("treats zero delivery as a valid calculated value", () => {
    expect(
      buildBookingPriceSummary({
        days: 2,
        totalPrice: 80,
        breakdown: {
          deliveryIn: 0,
          deliveryOut: 0,
          deliveryTotal: 0,
        },
      })
    ).toEqual({
      days: 2,
      rentalPrice: 80,
      deliveryCost: 0,
      pickupDeliveryCost: 0,
      returnDeliveryCost: 0,
      totalPrice: 80,
      deliveryStatus: "ready",
    });
  });

  test("keeps pickup and return delivery values separately", () => {
    expect(
      buildBookingPriceSummary({
        days: 5,
        totalPrice: 200,
        breakdown: {
          deliveryIn: 10,
          deliveryOut: 15.75,
          deliveryTotal: 25.75,
        },
      })
    ).toEqual({
      days: 5,
      rentalPrice: 200,
      deliveryCost: 25.75,
      pickupDeliveryCost: 10,
      returnDeliveryCost: 15.75,
      totalPrice: 225.75,
      deliveryStatus: "ready",
    });
  });

  test("falls back to rental total when delivery is not calculable", () => {
    expect(
      buildBookingPriceSummary({
        days: 3,
        totalPrice: 90,
        breakdown: {},
      })
    ).toEqual({
      days: 3,
      rentalPrice: 90,
      deliveryCost: null,
      pickupDeliveryCost: null,
      returnDeliveryCost: null,
      totalPrice: 90,
      deliveryStatus: "unavailable",
    });
  });

  test("builds the same summary shape from raw breakdown input", () => {
    expect(
      buildBookingPriceSummaryFromBreakdown({
        days: 6,
        rentalPrice: 180,
        breakdown: {
          deliveryIn: 12,
          deliveryOut: 8,
          deliveryTotal: 20,
        },
      })
    ).toEqual({
      days: 6,
      rentalPrice: 180,
      deliveryCost: 20,
      pickupDeliveryCost: 12,
      returnDeliveryCost: 8,
      totalPrice: 200,
      deliveryStatus: "ready",
    });
  });
});
