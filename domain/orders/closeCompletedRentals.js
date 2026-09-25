/**
 * Platform rental completion after the Booking Fee is paid.
 *
 * BOOKING_CONFIRMED → COMPLETION_PENDING → COMPLETED
 * A stored RENTAL_IN_PROGRESS row is still completed at return. New runs do not write it.
 *
 * Return time moves an eligible platform booking to COMPLETION_PENDING.
 * Twenty-four hours later, with no reported problem, it becomes COMPLETED.
 * This job never sets order.status to PAID_AND_CLOSED and never records
 * that the supplier received the remaining rental amount.
 *
 * Internal bookings are left untouched.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { Order } from "@models/order";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  applyRentalStateTransition,
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import { ORDER_STATUS } from "@/domain/orders/orderStatus";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import { ATHENS_TZ } from "@/domain/time/athensTime";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

dayjs.extend(utc);
dayjs.extend(timezone);

export const COMPLETION_GRACE_MS = 24 * 60 * 60 * 1000;

const SKIP_BOOKING = new Set([
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CUSTOMER_CANCELLED,
  BOOKING_STATUS.SUPPLIER_CANCELLED,
  BOOKING_STATUS.ADMIN_CANCELLED,
  BOOKING_STATUS.SUPPLIER_DECLINED,
  BOOKING_STATUS.NO_AVAILABILITY,
  BOOKING_STATUS.PAYMENT_EXPIRED,
]);

export function bookingFeeIsPaid(order) {
  return String(order?.payment?.status || "").toLowerCase() === "paid";
}

export function hasReportedProblem(order) {
  return order?.hasProblem === true || Boolean(order?.problemReportedAt);
}

export function supplierRecordedRemainingPaid(order) {
  return Boolean(order?.supplierRemainingPaidAt);
}

function instantBefore(value, now, { endOfDay = false, tz = ATHENS_TZ } = {}) {
  if (!value) return false;
  const point = endOfDay
    ? dayjs.utc(value).tz(tz).endOf("day")
    : dayjs.utc(value);
  return point.isBefore(now);
}

export function isRentalPeriodOver(order, now = new Date()) {
  if (!order) return false;
  const tz = order.timezone || ATHENS_TZ;
  if (order.returnAtUtc) return instantBefore(order.returnAtUtc, now);
  if (order.timeOut) return instantBefore(order.timeOut, now);
  if (!order.rentalEndDate) return false;
  return instantBefore(order.rentalEndDate, now, { endOfDay: true, tz });
}

export function isPickupTimeReached(order, now = new Date()) {
  if (!order) return false;
  const tz = order.timezone || ATHENS_TZ;
  if (order.pickupAtUtc) return instantBefore(order.pickupAtUtc, now);
  if (order.timeIn) return instantBefore(order.timeIn, now);
  if (!order.rentalStartDate) return false;
  return instantBefore(order.rentalStartDate, now, { endOfDay: false, tz });
}

/**
 * Next stored lifecycle move, or null when the booking must stay put.
 * `armGrace` means the caller should stamp completionPendingAt.
 */
export function planPlatformCompletion(order, now = new Date()) {
  if (!isPlatformBooking(order)) return null;
  if (order?.status === ORDER_STATUS.PAID_AND_CLOSED) return null;
  const status = String(order?.bookingStatus || "");
  if (SKIP_BOOKING.has(status)) return null;
  if (!bookingFeeIsPaid(order)) return null;

  const state = resolveRentalState(order);
  const pending =
    status === BOOKING_STATUS.COMPLETION_PENDING ||
    state === RENTAL_STATE.COMPLETION_PENDING;

  if (pending) {
    if (hasReportedProblem(order)) return null;
    const since = order.completionPendingAt
      ? new Date(order.completionPendingAt)
      : null;
    if (!since || Number.isNaN(since.getTime())) {
      return { rentalState: RENTAL_STATE.COMPLETION_PENDING, armGrace: true };
    }
    if (now.getTime() - since.getTime() >= COMPLETION_GRACE_MS) {
      return { rentalState: RENTAL_STATE.COMPLETED };
    }
    return null;
  }

  const confirmed =
    status === BOOKING_STATUS.BOOKING_CONFIRMED ||
    state === RENTAL_STATE.CONFIRMED;
  const inProgress =
    status === BOOKING_STATUS.RENTAL_IN_PROGRESS ||
    state === RENTAL_STATE.RENTAL_IN_PROGRESS;

  if (isRentalPeriodOver(order, now) && (confirmed || inProgress)) {
    return { rentalState: RENTAL_STATE.COMPLETION_PENDING, armGrace: true };
  }
  return null;
}

/** True only when the grace has elapsed and completion itself is the next step. */
export function shouldCloseCompletedRental(order, now = new Date()) {
  return planPlatformCompletion(order, now)?.rentalState === RENTAL_STATE.COMPLETED;
}

function completionAnchor(order, now) {
  if (order?.returnAtUtc) return new Date(order.returnAtUtc);
  if (order?.timeOut) return new Date(order.timeOut);
  if (order?.rentalEndDate) {
    return dayjs
      .utc(order.rentalEndDate)
      .tz(order.timezone || ATHENS_TZ)
      .endOf("day")
      .toDate();
  }
  return now;
}

export function applyPlatformCompletionStep(order, now = new Date()) {
  const step = planPlatformCompletion(order, now);
  if (!step) return { ok: false, code: "no_step" };

  if (
    step.armGrace &&
    (order.bookingStatus === BOOKING_STATUS.COMPLETION_PENDING ||
      resolveRentalState(order) === RENTAL_STATE.COMPLETION_PENDING)
  ) {
    if (!order.completionPendingAt) {
      order.completionPendingAt = completionAnchor(order, now);
    }
    return { ok: true, armed: true, bookingStatus: order.bookingStatus };
  }

  const result = applyRentalStateTransition(order, step.rentalState);
  if (!result.ok) return result;
  if (step.armGrace) order.completionPendingAt = completionAnchor(order, now);
  return result;
}

/**
 * Supplier explicitly records that the customer paid the remaining rental
 * amount to the company. Stripe Booking Fee payment must never call this.
 */
export function recordSupplierRemainingPaid(order, at = new Date()) {
  if (!isPlatformBooking(order)) {
    return { ok: false, code: "not_platform_booking" };
  }
  if (!bookingFeeIsPaid(order)) {
    return { ok: false, code: "booking_fee_unpaid" };
  }
  order.supplierRemainingPaidAt = at;
  return { ok: true };
}

export function reportBookingProblem(order, { at = new Date(), by = "" } = {}) {
  if (!isPlatformBooking(order)) {
    return { ok: false, code: "not_platform_booking" };
  }
  order.hasProblem = true;
  order.problemReportedAt = at;
  if (by) order.problemReportedBy = by;
  return { ok: true };
}

export async function closeCompletedRentals({
  now = new Date(),
  limit = 100,
  trigger = "cron",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const candidates = await Order.find({
    "payment.status": "paid",
    bookingStatus: { $nin: [...SKIP_BOOKING] },
    status: { $ne: ORDER_STATUS.PAID_AND_CLOSED },
    $or: [
      { source: "PLATFORM" },
      { my_order: true, source: { $exists: false } },
    ],
  })
    .sort({ rentalEndDate: 1 })
    .limit(cap * 3);

  let closed = 0;
  let advanced = 0;
  let skipped = 0;
  let failed = 0;
  for (const order of candidates) {
    if (advanced + skipped + failed >= cap) break;
    if (!planPlatformCompletion(order, now)) {
      skipped += 1;
      continue;
    }
    try {
      const from = resolveRentalState(order);
      const applied = applyPlatformCompletionStep(order, now);
      if (!applied.ok) {
        skipped += 1;
        continue;
      }
      await order.save();
      advanced += 1;
      if (applied.bookingStatus === BOOKING_STATUS.COMPLETED || applied.to === RENTAL_STATE.COMPLETED) {
        closed += 1;
      }
      await recordAuditEvent({
        action: "BOOKING_COMPLETION_STEP",
        severity: "low",
        result: "success",
        orderData: {
          orderId: order._id,
          orderNumber: order.orderNumber,
        },
        metadata: {
          trigger,
          fromState: from,
          bookingStatus: order.bookingStatus,
        },
      }).catch(() => {});
    } catch (err) {
      failed += 1;
      console.error(
        "[closeCompletedRentals] failed",
        order._id,
        err?.message || err
      );
    }
  }

  return {
    scanned: candidates.length,
    advanced,
    closed,
    skipped,
    failed,
  };
}
