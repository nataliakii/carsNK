/**
 * @jest-environment node
 */
import {
  applyPlatformCompletionStep,
  bookingFeeIsPaid,
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
    expect(isRentalPeriodOver({ returnAtUtc: now.toISOString() }, now)).toBe(
      true
    );
  });

  test("date-only legacy returns use the booking timezone", () => {
    const order = {
      rentalEndDate: "2026-09-30T00:00:00.000Z",
      timezone: "Europe/Athens",
    };
    expect(
      isRentalPeriodOver(order, new Date("2026-09-30T20:59:59.000Z"))
    ).toBe(false);
    expect(
      isRentalPeriodOver(order, new Date("2026-09-30T21:00:00.000Z"))
    ).toBe(true);
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

  test("cancelled paid platform bookings are never auto-completed", () => {
    expect(
      planPlatformCompletion(
        platform({
          bookingStatus: BOOKING_STATUS.CUSTOMER_CANCELLED,
          returnAtUtc: "2026-09-01T00:00:00.000Z",
        }),
        now
      )
    ).toBeNull();
  });

  test("return time moves a paid platform booking directly to COMPLETED", () => {
    const order = platform({
      pickupAtUtc: "2026-09-20T10:00:00.000Z",
      returnAtUtc: "2026-10-01T11:00:00.000Z",
    });
    expect(planPlatformCompletion(order, now).rentalState).toBe("COMPLETED");
    const applied = applyPlatformCompletionStep(order, now);
    expect(applied.ok).toBe(true);
    expect(order.bookingStatus).toBe(BOOKING_STATUS.COMPLETED);
    expect(order.status).not.toBe(ORDER_STATUS.PAID_AND_CLOSED);
    expect(supplierRecordedRemainingPaid(order)).toBe(false);
    expect(shouldCloseCompletedRental(order, now)).toBe(false);
    expect(applyPlatformCompletionStep(order, now)).toMatchObject({
      ok: false,
      code: "no_step",
    });
  });

  test("legacy completion-pending rows complete as soon as return is reached", () => {
    const order = platform({
      bookingStatus: BOOKING_STATUS.COMPLETION_PENDING,
      completionPendingAt: new Date(now.getTime() - 60_000),
      returnAtUtc: now.toISOString(),
    });
    expect(shouldCloseCompletedRental(order, now)).toBe(true);
    applyPlatformCompletionStep(order, now);
    expect(order.bookingStatus).toBe(BOOKING_STATUS.COMPLETED);
    expect(order.status).not.toBe(ORDER_STATUS.PAID_AND_CLOSED);
  });

  test("a reported problem is preserved without blocking normal completion", () => {
    const order = platform({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      returnAtUtc: now.toISOString(),
    });
    const reported = reportBookingProblem(order, {
      by: "company",
      type: "DAMAGE",
      note: "Scratch on passenger door",
    });
    expect(reported.ok).toBe(true);
    expect(reported.issue).toMatchObject({
      status: "OPEN",
      type: "DAMAGE",
      note: "Scratch on passenger door",
      reportedBy: "company",
    });
    expect(planPlatformCompletion(order, now).rentalState).toBe("COMPLETED");
    applyPlatformCompletionStep(order, now);
    expect(order.bookingStatus).toBe(BOOKING_STATUS.COMPLETED);
    expect(order.hasProblem).toBe(true);
    expect(order.bookingIssues).toHaveLength(1);
    expect(order.bookingIssues[0].issueId).toBeTruthy();
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
