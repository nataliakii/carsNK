/**
 * After the rental period ends, a paid/confirmed client booking becomes
 * completed + PAID_AND_CLOSED (view-only, "past").
 *
 * Internal company-calendar rows are left alone.
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

const SKIP_BOOKING = new Set([
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CUSTOMER_CANCELLED,
  BOOKING_STATUS.SUPPLIER_CANCELLED,
  BOOKING_STATUS.ADMIN_CANCELLED,
  BOOKING_STATUS.SUPPLIER_DECLINED,
  BOOKING_STATUS.NO_AVAILABILITY,
  BOOKING_STATUS.PAYMENT_EXPIRED,
]);

export function isRentalPeriodOver(order, now = new Date()) {
  if (!order) return false;
  const tz = order.timezone || ATHENS_TZ;
  if (order.returnAtUtc) {
    return dayjs.utc(order.returnAtUtc).isBefore(now);
  }
  if (order.timeOut) {
    return dayjs.utc(order.timeOut).isBefore(now);
  }
  if (!order.rentalEndDate) return false;
  return dayjs.utc(order.rentalEndDate).tz(tz).endOf("day").isBefore(now);
}

export function shouldCloseCompletedRental(order, now = new Date()) {
  if (!isPlatformBooking(order)) return false;
  if (order.status === ORDER_STATUS.PAID_AND_CLOSED) return false;
  if (SKIP_BOOKING.has(String(order.bookingStatus || ""))) return false;
  const paid = String(order.payment?.status || "").toLowerCase() === "paid";
  const confirmed =
    order.confirmed === true ||
    String(order.bookingStatus || "") === BOOKING_STATUS.BOOKING_CONFIRMED;
  if (!paid && !confirmed) return false;
  return isRentalPeriodOver(order, now);
}

export async function closeCompletedRentals({
  now = new Date(),
  limit = 100,
  trigger = "cron",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const candidates = await Order.find({
    my_order: true,
    status: { $ne: ORDER_STATUS.PAID_AND_CLOSED },
    bookingStatus: { $nin: [...SKIP_BOOKING] },
    $or: [
      { confirmed: true },
      { "payment.status": "paid" },
      { bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED },
    ],
  })
    .sort({ rentalEndDate: 1 })
    .limit(cap * 3);

  let closed = 0;
  let skipped = 0;
  let failed = 0;
  for (const order of candidates) {
    if (closed + skipped + failed >= cap) break;
    if (!shouldCloseCompletedRental(order, now)) {
      skipped += 1;
      continue;
    }
    try {
      const from = resolveRentalState(order);
      if (from === RENTAL_STATE.CONFIRMED) {
        applyRentalStateTransition(order, RENTAL_STATE.COMPLETED);
      } else {
        order.bookingStatus = BOOKING_STATUS.COMPLETED;
      }
      order.status = ORDER_STATUS.PAID_AND_CLOSED;
      await order.save();
      closed += 1;
      await recordAuditEvent({
        action: "BOOKING_AUTO_CLOSED",
        severity: "low",
        result: "success",
        orderData: {
          orderId: order._id,
          orderNumber: order.orderNumber,
        },
        metadata: { trigger, fromState: from },
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
    closed,
    skipped,
    failed,
  };
}
