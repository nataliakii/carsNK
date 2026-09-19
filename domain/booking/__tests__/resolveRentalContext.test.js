import { resolveRentalBookingContext } from "../resolveRentalContext";
import { BOOKING_MODES } from "../bookingMode";
import { BOOKING_STATUS } from "../bookingStatus";

describe("resolveRentalBookingContext", () => {
  test("new Greece order is OPS_CALENDAR / Athens / EUR", () => {
    const ctx = resolveRentalBookingContext({
      company: { country: "GR" },
      forNewOrder: true,
    });
    expect(ctx.bookingMode).toBe(BOOKING_MODES.OPS_CALENDAR);
    expect(ctx.timezone).toBe("Europe/Athens");
    expect(ctx.currency).toBe("EUR");
    expect(ctx.initialBookingStatus).toBeUndefined();
  });

  test("new Spain order is MARKETPLACE_REQUEST / Madrid / pending status", () => {
    const ctx = resolveRentalBookingContext({
      company: { country: "ES" },
      forNewOrder: true,
    });
    expect(ctx.bookingMode).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
    expect(ctx.timezone).toBe("Europe/Madrid");
    expect(ctx.currency).toBe("EUR");
    expect(ctx.initialBookingStatus).toBe(
      BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION
    );
  });
});
