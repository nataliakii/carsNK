import { BookingHold, HOLD_STATUS } from "@models/BookingHold";
import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { RENTAL_STATE, resolveRentalState } from "@/domain/booking/rentalBookingState";
import { expireUnpaidMarketplacePayment } from "@/domain/booking/expireMarketplacePayment";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
async function expireStripeCheckout(orderId) {
  const { expireRentalCheckoutSession } = await import(
    "@/domain/orders/rentalStripeCheckout"
  );
  return expireRentalCheckoutSession(orderId).catch(() => {});
}

export const CLEANUP_BATCH_LIMIT = 50;
export const CLEANUP_BATCH_MAX = 200;

export function clampCleanupBatchSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return CLEANUP_BATCH_LIMIT;
  return Math.min(CLEANUP_BATCH_MAX, Math.round(n));
}

function isConfirmedOrder(order) {
  if (!order) return false;
  const rental = resolveRentalState(order);
  return (
    order.payment?.status === "paid" ||
    order.bookingStatus === BOOKING_STATUS.BOOKING_CONFIRMED ||
    rental === RENTAL_STATE.CONFIRMED
  );
}

/**
 * Safe expired-hold sweep.
 *
 * - NEVER releases a hold whose order is BOOKING_CONFIRMED / paid
 * - unpaid PAYMENT_PROCESSING → PAYMENT_EXPIRED, URL cleared, session kept
 * - hold is marked released (not deleted)
 * - emails once per Stripe session; reruns are idempotent
 */
export async function runExpiredHoldCleanup({
  now = new Date(),
  limit = CLEANUP_BATCH_LIMIT,
  trigger = "on_demand",
  carId = null,
} = {}) {
  await connectToDB();
  const batchSize = clampCleanupBatchSize(limit);
  const query = {
    status: HOLD_STATUS.ACTIVE,
    holdExpiresAt: { $lte: now },
  };
  if (carId) query.carId = carId;

  const holds = await BookingHold.find(query).limit(batchSize).lean();
  const summary = {
    scanned: holds.length,
    released: 0,
    skippedConfirmed: 0,
    failed: 0,
    trigger,
  };

  for (const hold of holds) {
    try {
      const order = await Order.findById(hold.orderId);
      if (isConfirmedOrder(order)) {
        await BookingHold.updateOne(
          { _id: hold._id, status: HOLD_STATUS.ACTIVE },
          {
            $set: {
              status: HOLD_STATUS.FINALIZED,
              finalizedAt: now,
              releaseReason: "already_confirmed",
            },
          }
        );
        summary.skippedConfirmed += 1;
        continue;
      }

      if (order) {
        await expireStripeCheckout(order._id);
        const result = await expireUnpaidMarketplacePayment({
          order,
          sessionId: hold.stripeSessionId || order.payment?.providerPaymentId || "",
          reason: "hold_expired",
          sendEmail: true,
          now,
        });
        if (result.skippedConfirmed) {
          summary.skippedConfirmed += 1;
        } else if (result.released || result.alreadyExpired) {
          summary.released += 1;
        }
      } else {
        await BookingHold.updateOne(
          { _id: hold._id, status: HOLD_STATUS.ACTIVE },
          {
            $set: {
              status: HOLD_STATUS.RELEASED,
              releasedAt: now,
              releaseReason: "expired_order_missing",
            },
          }
        );
        summary.released += 1;
      }
    } catch (err) {
      summary.failed += 1;
      await recordAuditEvent({
        action: "BOOKING_HOLD_CLEANUP_FAILED",
        severity: "high",
        result: "failure",
        orderData: { orderId: hold.orderId },
        metadata: {
          holdId: String(hold._id),
          trigger,
          message: err?.message || String(err),
        },
        errorMessage: err?.message || String(err),
      });
    }
  }

  return { ok: true, ...summary };
}

/** Back-compat name used before availability / confirm / reissue. */
export async function cleanupExpiredHolds(now = new Date(), options = {}) {
  return runExpiredHoldCleanup({ now, trigger: "on_demand", ...options });
}
