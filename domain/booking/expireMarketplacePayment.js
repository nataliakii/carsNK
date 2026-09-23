import { Order } from "@models/order";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  applyRentalStateTransition,
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import { releaseMarketplaceHold } from "@/domain/booking/bookingHold";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import {
  archiveStripeSession,
  STRIPE_SESSION_ARCHIVE,
} from "@/domain/orders/stripePaymentRefs";
import { sendCustomerPaymentExpiredEmail } from "@/domain/orders/marketplaceBookingEmails";

/**
 * Expire an unpaid marketplace checkout without deleting Stripe history.
 * Never touches BOOKING_CONFIRMED / paid orders.
 */
export async function expireUnpaidMarketplacePayment({
  order,
  sessionId = "",
  reason = "checkout_expired",
  sendEmail = true,
  now = new Date(),
} = {}) {
  if (!order) return { ok: true, skipped: true, reason: "missing_order" };

  const bookingStatus = String(order.bookingStatus || "");
  const rental = resolveRentalState(order);
  const paid =
    order.payment?.status === "paid" ||
    bookingStatus === BOOKING_STATUS.BOOKING_CONFIRMED ||
    rental === RENTAL_STATE.CONFIRMED;

  if (paid) {
    return { ok: true, skipped: true, reason: "confirmed", skippedConfirmed: true };
  }

  if (
    rental === RENTAL_STATE.CANCELLED ||
    bookingStatus === BOOKING_STATUS.CUSTOMER_CANCELLED ||
    bookingStatus === BOOKING_STATUS.SUPPLIER_CANCELLED ||
    bookingStatus === BOOKING_STATUS.ADMIN_CANCELLED ||
    rental === RENTAL_STATE.DECLINED
  ) {
    await releaseMarketplaceHold(order._id, { reason });
    return { ok: true, skipped: true, reason: "terminal" };
  }

  const alreadyExpired =
    rental === RENTAL_STATE.PAYMENT_EXPIRED ||
    bookingStatus === BOOKING_STATUS.PAYMENT_EXPIRED ||
    order.payment?.status === "expired";

  const currentSession = String(order.payment?.providerPaymentId || "");
  const incoming = String(sessionId || "");
  if (incoming && currentSession && incoming !== currentSession) {
    return { ok: true, skipped: true, reason: "other_session" };
  }

  const payment = archiveStripeSession(
    {
      ...(order.payment && typeof order.payment === "object" ? order.payment : {}),
      status: "expired",
      checkoutUrl: "",
      lastCheckoutError: alreadyExpired
        ? order.payment?.lastCheckoutError || ""
        : reason,
    },
    { status: STRIPE_SESSION_ARCHIVE.EXPIRED, at: now }
  );

  const doc = typeof order.save === "function" ? order : await Order.findById(order._id);
  if (!doc) return { ok: true, skipped: true, reason: "missing_order" };

  if (!alreadyExpired) {
    const moved = applyRentalStateTransition(doc, RENTAL_STATE.PAYMENT_EXPIRED);
    if (!moved.ok) {
      doc.bookingStatus = BOOKING_STATUS.PAYMENT_EXPIRED;
    }
  }
  doc.set("payment", payment, { strict: false });
  await doc.save();

  await releaseMarketplaceHold(doc._id, { reason });

  if (!alreadyExpired) {
    await recordAuditEvent({
      action: "RENTAL_PAYMENT_EXPIRED",
      severity: "medium",
      orderData: { orderId: doc._id, orderNumber: doc.orderNumber },
      metadata: { sessionId: incoming || currentSession, reason },
    });
  }

  let emailed = { ok: true, skipped: true };
  if (sendEmail) {
    emailed = await sendCustomerPaymentExpiredEmail({
      order: doc.toObject ? doc.toObject() : doc,
      stripeSessionId: incoming || currentSession,
    });
  }

  return {
    ok: true,
    released: true,
    alreadyExpired,
    emailed,
    order: doc.toObject ? doc.toObject() : doc,
  };
}
