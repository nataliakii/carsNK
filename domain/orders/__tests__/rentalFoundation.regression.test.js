/**
 * @jest-environment node
 */
import { resolveCreateTotalPrice } from "../publicOrderCreatePolicy";
import { detectClientTotalMismatch } from "../rentalPricingService";
import { isOrderDateBlocking } from "../isOrderDateBlocking";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

describe("rental foundation regressions", () => {
  test("forged client totalPrice does not become the stored total", () => {
    const stored = resolveCreateTotalPrice({
      isAdminSession: false,
      clientTotalPrice: 1,
      rentalTotal: 200,
      deliveryTotal: 25,
    });
    expect(stored).toBe(225);
    expect(
      detectClientTotalMismatch({
        clientTotalPrice: 1,
        serverTotalMajor: stored,
      })
    ).not.toBeNull();
  });

  test("legacy confirmed Greece orders still block", () => {
    expect(
      isOrderDateBlocking({ confirmed: true, offline: false })
    ).toBe(true);
  });

  test("pending marketplace status does not block", () => {
    expect(
      isOrderDateBlocking({
        confirmed: false,
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      })
    ).toBe(false);
  });

  test("future hold status will block when present", () => {
    expect(
      isOrderDateBlocking({
        confirmed: false,
        bookingStatus: BOOKING_STATUS.CONFIRMED_AWAITING_PAYMENT,
      })
    ).toBe(true);
  });
});
