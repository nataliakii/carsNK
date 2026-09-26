/**
 * Platform rental completion after the Booking Fee is paid.
 *
 * BOOKING_CONFIRMED → COMPLETED at the confirmed return instant.
 * Legacy COMPLETION_PENDING and RENTAL_IN_PROGRESS rows are also advanced.
 *
 * The scheduled return instant moves an eligible platform booking directly
 * to COMPLETED. Reported issues are tracked separately from booking status.
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
  RENTAL_STATE_TO_BOOKING_STATUS,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import { ORDER_STATUS } from "@/domain/orders/orderStatus";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import { ATHENS_TZ } from "@/domain/time/athensTime";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import crypto from "node:crypto";

dayjs.extend(utc);
dayjs.extend(timezone);

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
  if (order.returnAtUtc) return !dayjs.utc(order.returnAtUtc).isAfter(now);
  if (order.timeOut) return !dayjs.utc(order.timeOut).isAfter(now);
  if (!order.rentalEndDate) return false;
  return !dayjs.utc(order.rentalEndDate).tz(tz).endOf("day").isAfter(now);
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
 */
export function planPlatformCompletion(order, now = new Date()) {
  if (!isPlatformBooking(order)) return null;
  if (order?.status === ORDER_STATUS.PAID_AND_CLOSED) return null;
  const status = String(order?.bookingStatus || "");
  if (SKIP_BOOKING.has(status)) return null;
  if (!bookingFeeIsPaid(order)) return null;

  const state = resolveRentalState(order);
  const confirmed =
    status === BOOKING_STATUS.BOOKING_CONFIRMED ||
    state === RENTAL_STATE.CONFIRMED;
  const inProgress =
    status === BOOKING_STATUS.RENTAL_IN_PROGRESS ||
    state === RENTAL_STATE.RENTAL_IN_PROGRESS;
  const pending =
    status === BOOKING_STATUS.COMPLETION_PENDING ||
    state === RENTAL_STATE.COMPLETION_PENDING;

  if (isRentalPeriodOver(order, now) && (confirmed || inProgress || pending)) {
    return { rentalState: RENTAL_STATE.COMPLETED };
  }
  return null;
}

/** True when COMPLETED is the next lifecycle state. */
export function shouldCloseCompletedRental(order, now = new Date()) {
  return (
    planPlatformCompletion(order, now)?.rentalState === RENTAL_STATE.COMPLETED
  );
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
  const result = applyRentalStateTransition(order, step.rentalState);
  if (!result.ok) return result;
  order.completionPendingAt = null;
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

export function reportBookingProblem(
  order,
  { at = new Date(), by = "", type = "OTHER", note = "" } = {}
) {
  if (!isPlatformBooking(order)) {
    return { ok: false, code: "not_platform_booking" };
  }
  const issueType = String(type || "OTHER").toUpperCase();
  const allowedTypes = new Set(["DAMAGE", "PAYMENT", "LATE_RETURN", "OTHER"]);
  if (!allowedTypes.has(issueType)) {
    return { ok: false, code: "invalid_issue_type" };
  }
  const issue = {
    issueId: crypto.randomUUID(),
    status: "OPEN",
    type: issueType,
    note: String(note || "")
      .trim()
      .slice(0, 2000),
    reportedAt: at,
    reportedBy: String(by || ""),
  };
  const existingIssues = Array.isArray(order.bookingIssues)
    ? order.bookingIssues
    : [];
  order.bookingIssues = [...existingIssues, issue];
  order.hasProblem = true;
  order.problemReportedAt = at;
  if (by) order.problemReportedBy = by;
  return { ok: true, issue };
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
    const step = planPlatformCompletion(order, now);
    if (!step) {
      skipped += 1;
      continue;
    }
    try {
      const from = resolveRentalState(order);
      const previousStatus = order.bookingStatus;
      const completedAt = new Date(now);
      const nextStatus = RENTAL_STATE_TO_BOOKING_STATUS[step.rentalState];
      if (!nextStatus) {
        skipped += 1;
        continue;
      }
      const completionEntry = {
        fromState: from,
        toState: RENTAL_STATE.COMPLETED,
        returnAtUtc: completionAnchor(order, now),
        completedAt,
        actor: { role: "system", email: "" },
        meaning: "The scheduled rental period has ended.",
      };
      const compareAndSet = {
        _id: order._id,
        "payment.status": "paid",
        status: { $ne: ORDER_STATUS.PAID_AND_CLOSED },
      };
      if (previousStatus === undefined) {
        compareAndSet.$and = [
          {
            $or: [
              { bookingStatus: { $exists: false } },
              { bookingStatus: null },
              { bookingStatus: "" },
            ],
          },
        ];
      } else {
        compareAndSet.bookingStatus = previousStatus;
      }
      if (order.returnAtUtc) compareAndSet.returnAtUtc = order.returnAtUtc;
      else if (order.timeOut) compareAndSet.timeOut = order.timeOut;
      else if (order.rentalEndDate) {
        compareAndSet.rentalEndDate = order.rentalEndDate;
        compareAndSet.timezone = order.timezone || "";
      }
      if (order.source === "PLATFORM") compareAndSet.source = "PLATFORM";
      else compareAndSet.my_order = true;

      const persisted = await Order.updateOne(compareAndSet, {
        $set: {
          bookingStatus: nextStatus,
          completionPendingAt: null,
        },
        $push: { completionHistory: completionEntry },
      });
      if (!(persisted?.matchedCount > 0 || persisted?.n > 0)) {
        skipped += 1;
        continue;
      }
      advanced += 1;
      closed += 1;
      await recordAuditEvent({
        action: "BOOKING_AUTO_COMPLETED",
        severity: "low",
        result: "success",
        orderData: {
          orderId: order._id,
          orderNumber: order.orderNumber,
        },
        metadata: {
          trigger,
          fromState: from,
          bookingStatus: nextStatus,
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
