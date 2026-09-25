/**
 * @jest-environment node
 */
import {
  isRentalPeriodOver,
  shouldCloseCompletedRental,
} from "../closeCompletedRentals";
import { ORDER_STATUS } from "../orderStatus";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

describe("closeCompletedRentals helpers", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  test("isRentalPeriodOver uses returnAtUtc when present", () => {
    expect(
      isRentalPeriodOver({ returnAtUtc: "2026-09-30T10:00:00.000Z" }, now)
    ).toBe(true);
    expect(
      isRentalPeriodOver({ returnAtUtc: "2026-10-02T10:00:00.000Z" }, now)
    ).toBe(false);
  });

  test("shouldCloseCompletedRental skips internals and unpaid unconfirmed", () => {
    expect(
      shouldCloseCompletedRental(
        { my_order: false, confirmed: true, returnAtUtc: "2026-09-01T00:00:00Z" },
        now
      )
    ).toBe(false);
    expect(
      shouldCloseCompletedRental(
        { my_order: true, confirmed: false, payment: { status: "pending" }, returnAtUtc: "2026-09-01T00:00:00Z" },
        now
      )
    ).toBe(false);
  });

  test("shouldCloseCompletedRental closes paid client bookings after return", () => {
    expect(
      shouldCloseCompletedRental(
        {
          my_order: true,
          confirmed: true,
          payment: { status: "paid" },
          bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
          returnAtUtc: "2026-09-30T10:00:00.000Z",
        },
        now
      )
    ).toBe(true);
    expect(
      shouldCloseCompletedRental(
        {
          my_order: true,
          confirmed: true,
          payment: { status: "paid" },
          status: ORDER_STATUS.PAID_AND_CLOSED,
          returnAtUtc: "2026-09-30T10:00:00.000Z",
        },
        now
      )
    ).toBe(false);
  });
});
