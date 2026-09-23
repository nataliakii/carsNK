/**
 * Spain marketplace Rovaro Booking Fee is non-refundable.
 *
 * It is paid through Stripe into Rovaro's own account and retained in full.
 * It is credited when calculating the remaining supplier balance. It is not held
 * for the supplier and is never paid out to the supplier.
 *
 * There is no automatic refund for customer cancellation, no-show, failed
 * eligibility/safety checks, invalid licence, incorrect information, refused
 * verification, or partner rejection. Voluntary refunds are SUPERADMIN-only,
 * require an explicit reason, go through Stripe refunds.create, write AuditLog
 * and notify the customer. Chargebacks stay on the existing webhook.
 */

import { ROLE, ROLE_NAME } from "@models/user";
import { Order } from "@models/order";
import { assertStripeReady, getStripeMode } from "@/lib/stripe";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { computeNetPaidMinor } from "@/domain/orders/stripePaymentRefs";
import { sendCustomerBookingFeeRefundEmail } from "@/domain/orders/marketplaceBookingEmails";

export const MARKETPLACE_FEE_NO_AUTO_REFUND = Object.freeze([
  "customer_cancel",
  "customer_no_show",
  "eligibility_failed",
  "licence_invalid",
  "incorrect_information",
  "verification_refused",
  "partner_rejection",
]);

export const BOOKING_FEE_REFUND_CODE = Object.freeze({
  FORBIDDEN_NOT_SUPERADMIN: "forbidden_not_superadmin",
  REASON_REQUIRED: "reason_required",
  NOT_MARKETPLACE: "not_marketplace",
  NOT_PAID: "not_paid",
  ALREADY_REFUNDED: "already_refunded",
  MISSING_STRIPE_REF: "missing_stripe_ref",
  STRIPE_FAILED: "stripe_failed",
  BOOKING_FEE_NON_REFUNDABLE: "booking_fee_non_refundable",
});

const EXCEPTION_CLAUSE =
  "except where required by applicable law or expressly authorised by Rovaro in exceptional circumstances";

export function marketplaceBookingFeeExceptionClause() {
  return EXCEPTION_CLAUSE;
}

export function isAutomaticMarketplaceFeeRefundForbidden(trigger) {
  return MARKETPLACE_FEE_NO_AUTO_REFUND.includes(String(trigger || "").trim());
}

export function blockAutomaticMarketplaceFeeRefund(trigger) {
  return {
    ok: false,
    refunded: false,
    automatic: false,
    code: BOOKING_FEE_REFUND_CODE.BOOKING_FEE_NON_REFUNDABLE,
    message:
      "The Rovaro Booking Fee is non-refundable. No automatic refund is issued, " +
      EXCEPTION_CLAUSE +
      ".",
    trigger: String(trigger || ""),
  };
}

function isSuperadminActor(actorRole) {
  if (actorRole === ROLE.SUPERADMIN) return true;
  const raw = String(actorRole || "").trim().toLowerCase();
  return raw === "superadmin" || raw === String(ROLE.SUPERADMIN);
}

export function assertVoluntaryMarketplaceFeeRefund({ actorRole, reason } = {}) {
  if (!isSuperadminActor(actorRole)) {
    return {
      ok: false,
      status: 403,
      code: BOOKING_FEE_REFUND_CODE.FORBIDDEN_NOT_SUPERADMIN,
      message:
        "Only the platform superadmin can authorise a voluntary refund of the Rovaro Booking Fee.",
    };
  }
  if (!String(reason || "").trim()) {
    return {
      ok: false,
      status: 400,
      code: BOOKING_FEE_REFUND_CODE.REASON_REQUIRED,
      message: "An explicit reason is required for a voluntary refund.",
    };
  }
  return { ok: true };
}

function stripeRefundTarget(payment) {
  const paymentIntentId = String(payment?.paymentIntentId || "").trim();
  if (paymentIntentId) return { payment_intent: paymentIntentId };
  const chargeId = String(payment?.chargeId || "").trim();
  if (chargeId) return { charge: chargeId };
  return null;
}

/**
 * SUPERADMIN voluntary refund of the marketplace booking fee.
 * Never called from partner ADMIN, partner rejection, or customer cancel.
 */
export async function issueMarketplaceBookingFeeRefund({
  orderId,
  reason,
  actorEmail = "",
  actorRole,
  ipAddress = "",
  userAgent = "",
  idempotencyKey = "",
} = {}) {
  const gate = assertVoluntaryMarketplaceFeeRefund({ actorRole, reason });
  if (!gate.ok) return gate;

  const order = await Order.findById(orderId);
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Order not found" };
  }
  if (!isMarketplaceRequestMode(order.bookingMode)) {
    return {
      ok: false,
      status: 400,
      code: BOOKING_FEE_REFUND_CODE.NOT_MARKETPLACE,
      message: "This refund path is only for Spain marketplace bookings.",
    };
  }

  const payment = order.payment && typeof order.payment === "object" ? order.payment : {};
  const paid =
    String(payment.status || "") === "paid" ||
    Number(payment.paidAmountMinor || payment.amountMinor || 0) > 0;
  if (!paid) {
    return {
      ok: false,
      status: 409,
      code: BOOKING_FEE_REFUND_CODE.NOT_PAID,
      message: "There is no captured Rovaro Booking Fee to refund.",
    };
  }

  const net = computeNetPaidMinor({
    paidAmountMinor: payment.paidAmountMinor || payment.amountMinor || 0,
    refundedAmountMinor: payment.refundedAmountMinor || 0,
  });
  if (net <= 0 || String(payment.refundStatus || "") === "full") {
    return {
      ok: false,
      status: 409,
      code: BOOKING_FEE_REFUND_CODE.ALREADY_REFUNDED,
      message: "The Rovaro Booking Fee has already been refunded.",
    };
  }

  const target = stripeRefundTarget(payment);
  if (!target) {
    return {
      ok: false,
      status: 409,
      code: BOOKING_FEE_REFUND_CODE.MISSING_STRIPE_REF,
      message: "No Stripe payment intent or charge is stored for this booking.",
    };
  }

  const trimmedReason = String(reason).trim().slice(0, 500);
  let refund;
  try {
    const stripe = assertStripeReady(getStripeMode());
    refund = await stripe.refunds.create(
      {
        ...target,
        reason: "requested_by_customer",
        metadata: {
          kind: "rental_booking_fee",
          orderId: String(order._id),
          bookingReference: String(order.orderNumber || order._id),
          voluntary: "1",
          actorEmail: String(actorEmail || "").slice(0, 120),
          reason: trimmedReason,
        },
      },
      idempotencyKey
        ? { idempotencyKey: String(idempotencyKey).slice(0, 255) }
        : undefined
    );
  } catch (err) {
    await recordAuditEvent({
      action: "RENTAL_BOOKING_FEE_REFUND_REQUESTED",
      userRole: ROLE_NAME[ROLE.SUPERADMIN],
      userEmail: actorEmail,
      severity: "critical",
      ipAddress,
      userAgent,
      reason: trimmedReason,
      result: "failure",
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { error: err?.message || String(err) },
    });
    return {
      ok: false,
      status: 502,
      code: BOOKING_FEE_REFUND_CODE.STRIPE_FAILED,
      message: err?.message || "Stripe refund failed",
    };
  }

  const nextPayment = {
    ...payment,
    lastVoluntaryRefundId: refund?.id || "",
    lastVoluntaryRefundAt: new Date(),
    lastVoluntaryRefundReason: trimmedReason,
  };
  order.set("payment", nextPayment, { strict: false });
  await order.save();

  await recordAuditEvent({
    action: "RENTAL_BOOKING_FEE_REFUND_REQUESTED",
    userRole: ROLE_NAME[ROLE.SUPERADMIN],
    userEmail: actorEmail,
    severity: "critical",
    ipAddress,
    userAgent,
    reason: trimmedReason,
    result: "success",
    orderData: { orderId: order._id, orderNumber: order.orderNumber },
    metadata: {
      stripeRefundId: refund?.id || "",
      amountMinor: refund?.amount ?? net,
      currency: refund?.currency || payment.currency || "eur",
    },
  });

  const mailed = await sendCustomerBookingFeeRefundEmail({
    order: order.toObject ? order.toObject() : order,
    amountMinor: refund?.amount ?? net,
    currency: refund?.currency || payment.currency || "EUR",
    reason: trimmedReason,
  }).catch((err) => ({ ok: false, error: err?.message || String(err) }));

  return {
    ok: true,
    refunded: true,
    automatic: false,
    stripeRefundId: refund?.id || "",
    amountMinor: refund?.amount ?? net,
    mailed,
  };
}
