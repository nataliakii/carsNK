/**
 * @jest-environment node
 */
import {
  applyPlatformCompletionStep,
  bookingFeeIsPaid,
  COMPLETION_GRACE_MS,
  isRentalPeriodOver,
  planPlatformCompletion,
  recordSupplierRemainingPaid,
  reportBookingProblem,
  shouldCloseCompletedRental,
  supplierRecordedRemainingPaid,
} from "../closeCompletedRentals";
import { ORDER_STATUS } from "../orderStatus";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

describe("closeCompletedRentals helpers", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  function platform(overrides = {}) {
    return {
      my_order: true,
      source: "PLATFORM",
      bookingMode: "MARKETPLACE_REQUEST",
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "paid" },
      confirmed: true,
      ...overrides,
    };
  }

  test("isRentalPeriodOver uses returnAtUtc when present", () => {
    expect(
      isRentalPeriodOver({ returnAtUtc: "2026-09-30T10:00:00.000Z" }, now)
    ).toBe(true);
    expect(
      isRentalPeriodOver({ returnAtUtc: "2026-10-02T10:00:00.000Z" }, now)
    ).toBe(false);
  });

  test("internal bookings and unpaid platform bookings are not moved", () => {
    expect(
      planPlatformCompletion(
        {
          my_order: false,
          source: "INTERNAL",
          bookingMode: "MARKETPLACE_REQUEST",
          confirmed: true,
          payment: { status: "paid" },
          bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
          returnAtUtc: "2026-09-01T00:00:00Z",
        },
        now
      )
    ).toBeNull();
    expect(
      planPlatformCompletion(
        platform({
          payment: { status: "pending" },
          returnAtUtc: "2026-09-01T00:00:00Z",
        }),
        now
      )
    ).toBeNull();
  });

  test("return time moves a paid platform booking to COMPLETION_PENDING", () => {
    const order = platform({
      pickupAtUtc: "2026-09-20T10:00:00.000Z",
      returnAtUtc: "2026-10-01T11:00:00.000Z",
    });
    expect(planPlatformCompletion(order, now).rentalState).toBe(
      "COMPLETION_PENDING"
    );
    const applied = applyPlatformCompletionStep(order, now);
    expect(applied.ok).toBe(true);
    expect(order.bookingStatus).toBe(BOOKING_STATUS.COMPLETION_PENDING);
    expect(order.status).not.toBe(ORDER_STATUS.PAID_AND_CLOSED);
    expect(supplierRecordedRemainingPaid(order)).toBe(false);
    expect(shouldCloseCompletedRental(order, now)).toBe(false);
  });

  test("the 24-hour grace period then moves it to COMPLETED", () => {
    const pendingAt = new Date(now.getTime() - COMPLETION_GRACE_MS - 1000);
    const order = platform({
      bookingStatus: BOOKING_STATUS.COMPLETION_PENDING,
      completionPendingAt: pendingAt,
      returnAtUtc: "2026-09-30T10:00:00.000Z",
    });
    expect(shouldCloseCompletedRental(order, now)).toBe(true);
    applyPlatformCompletionStep(order, now);
    expect(order.bookingStatus).toBe(BOOKING_STATUS.COMPLETED);
    expect(order.status).not.toBe(ORDER_STATUS.PAID_AND_CLOSED);
  });

  test("a reported problem prevents completion", () => {
    const order = platform({
      bookingStatus: BOOKING_STATUS.COMPLETION_PENDING,
      completionPendingAt: new Date(now.getTime() - COMPLETION_GRACE_MS - 1000),
      returnAtUtc: "2026-09-30T10:00:00.000Z",
    });
    expect(reportBookingProblem(order, { by: "company" }).ok).toBe(true);
    expect(planPlatformCompletion(order, now)).toBeNull();
    expect(order.bookingStatus).toBe(BOOKING_STATUS.COMPLETION_PENDING);
  });

  test("Booking Fee paid does not record the remaining amount", () => {
    const order = platform();
    expect(bookingFeeIsPaid(order)).toBe(true);
    expect(supplierRecordedRemainingPaid(order)).toBe(false);
    expect(recordSupplierRemainingPaid(order, now).ok).toBe(true);
    expect(supplierRecordedRemainingPaid(order)).toBe(true);
    expect(order.payment.status).toBe("paid");
  });

  test("pickup does not leave BOOKING_CONFIRMED before the return", () => {
    const order = platform({
      pickupAtUtc: "2026-10-01T08:00:00.000Z",
      returnAtUtc: "2026-10-05T10:00:00.000Z",
    });
    expect(planPlatformCompletion(order, now)).toBeNull();
    expect(order.bookingStatus).toBe(BOOKING_STATUS.BOOKING_CONFIRMED);
  });
});
