import {
  BOOKING_MODES,
  resolveBookingMode,
  isMarketplaceRequestMode,
  isOpsCalendarMode,
} from "../bookingMode";

describe("resolveBookingMode", () => {
  test("Greece company defaults to OPS_CALENDAR", () => {
    expect(
      resolveBookingMode({
        company: { country: "GR" },
        forNewOrder: true,
      })
    ).toBe(BOOKING_MODES.OPS_CALENDAR);
  });

  test("legacy Greece company without country defaults to OPS_CALENDAR", () => {
    expect(
      resolveBookingMode({
        company: {},
        forNewOrder: true,
      })
    ).toBe(BOOKING_MODES.OPS_CALENDAR);
  });

  test("Spain marketplace company can use MARKETPLACE_REQUEST", () => {
    expect(
      resolveBookingMode({
        company: { country: "ES" },
        forNewOrder: true,
      })
    ).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
    expect(
      resolveBookingMode({
        company: { country: "ES", bookingMode: "MARKETPLACE_REQUEST" },
        forNewOrder: true,
      })
    ).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
  });

  test("company explicit OPS_CALENDAR wins over Spain country", () => {
    expect(
      resolveBookingMode({
        company: { country: "ES", bookingMode: "OPS_CALENDAR" },
        forNewOrder: true,
      })
    ).toBe(BOOKING_MODES.OPS_CALENDAR);
  });

  test("stored order snapshot wins over later company setting changes", () => {
    expect(
      resolveBookingMode({
        order: { _id: "o1", bookingMode: BOOKING_MODES.OPS_CALENDAR },
        company: { country: "ES", bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST },
      })
    ).toBe(BOOKING_MODES.OPS_CALENDAR);
  });

  test("historical orders without snapshot preserve OPS_CALENDAR", () => {
    expect(
      resolveBookingMode({
        order: { _id: "legacy-1", orderNumber: "20240101120000" },
        company: { country: "ES", bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST },
      })
    ).toBe(BOOKING_MODES.OPS_CALENDAR);
  });

  test("platform default applies for new orders without company mode", () => {
    expect(
      resolveBookingMode({
        company: { country: "GR" },
        platformSettings: { defaultBookingMode: "MARKETPLACE_REQUEST" },
        forNewOrder: true,
      })
    ).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
  });

  test("mode helpers", () => {
    expect(isMarketplaceRequestMode("MARKETPLACE_REQUEST")).toBe(true);
    expect(isOpsCalendarMode("OPS_CALENDAR")).toBe(true);
  });
});
