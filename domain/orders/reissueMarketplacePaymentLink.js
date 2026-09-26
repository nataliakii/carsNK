import { Order } from "@models/order";
import { BookingHold, HOLD_STATUS } from "@models/BookingHold";
import { connectToDB } from "@lib/database";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  RENTAL_STATE,
  applyRentalStateTransition,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import {
  acquireMarketplaceHold,
  attachStripeSessionToHold,
  markHoldForRetry,
  releaseMarketplaceHold,
} from "@/domain/booking/bookingHold";
import { cleanupExpiredHolds } from "@/domain/booking/expiredHoldCleanup";
import {
  AVAILABILITY_PURPOSE,
  evaluateRentalAvailability,
} from "@/domain/booking/availabilityEngine";
import {
  clampStripeExpiresMinutes,
  createRentalCheckoutSession,
} from "@/domain/orders/rentalStripeCheckout";
import { computePriceSnapshotChecksum } from "@/domain/orders/priceSnapshotChecksum";
import { sendCustomerNewPaymentLinkEmail } from "@/domain/orders/marketplaceBookingEmails";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { loadLegalSettings } from "@/domain/legal/legalSettingsService";
import { currentStripeSessionId } from "@/domain/orders/stripePaymentRefs";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_PAYMENT_STATE,
  resolveBookingPaymentState,
} from "@/domain/orders/bookingPaymentStatus";
import {
  PAYMENT_LINK_REISSUE_REASONS,
  normalizeReissueReason,
} from "@/domain/orders/paymentLinkReissueReasons";
import {
  assertPartnerCanOperate,
  auditPartnerComplianceBlock,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";

export { PAYMENT_LINK_REISSUE_REASONS, normalizeReissueReason };

const TERMINAL_STATUSES = new Set([
  BOOKING_STATUS.CUSTOMER_CANCELLED,
  BOOKING_STATUS.SUPPLIER_CANCELLED,
  BOOKING_STATUS.ADMIN_CANCELLED,
  BOOKING_STATUS.SUPPLIER_DECLINED,
  BOOKING_STATUS.BOOKING_CONFIRMED,
  BOOKING_STATUS.RENTAL_IN_PROGRESS,
  BOOKING_STATUS.COMPLETION_PENDING,
  BOOKING_STATUS.COMPLETED,
]);

function sessionStillActive(order, now = new Date()) {
  const pay = order?.payment || {};
  if (pay.status === "paid" || pay.status === "expired") return false;
  if (pay.provider !== "stripe") return false;
  if (!pay.checkoutUrl || !pay.providerPaymentId) return false;
  if (pay.expiresAt && new Date(pay.expiresAt) <= now) return false;
  return true;
}

function partnerAlreadyConfirmed(order) {
  if (order?.partnerConfirmedAt) return true;
  if (order?.companyEmailDecision === "accepted") return true;
  const rental = resolveRentalState(order);
  return (
    rental === RENTAL_STATE.PARTNER_CONFIRMED ||
    rental === RENTAL_STATE.PAYMENT_PENDING ||
    rental === RENTAL_STATE.PAYMENT_EXPIRED
  );
}

export function evaluatePaymentLinkReissue(order, { now = new Date() } = {}) {
  if (!order) {
    return { ok: false, code: "not_found", message: "Order not found" };
  }
  if (!isPlatformBooking(order)) {
    return {
      ok: false,
      code: "not_platform_booking",
      message: "Internal company bookings do not use Rovaro payment links.",
    };
  }
  if (!isMarketplaceRequestMode(order.bookingMode)) {
    return {
      ok: false,
      code: "not_marketplace",
      message: "Payment links can only be reissued for Spain marketplace bookings.",
    };
  }
  if (!partnerAlreadyConfirmed(order)) {
    return {
      ok: false,
      code: "partner_not_confirmed",
      message: "The rental company has not confirmed this booking yet.",
    };
  }

  const rental = resolveRentalState(order);
  const status = String(order.bookingStatus || "");
  if (
    order.payment?.status === "paid" ||
    rental === RENTAL_STATE.CONFIRMED ||
    status === BOOKING_STATUS.BOOKING_CONFIRMED
  ) {
    return {
      ok: false,
      code: "already_paid",
      message: "This booking is already paid.",
    };
  }
  if (
    TERMINAL_STATUSES.has(status) ||
    rental === RENTAL_STATE.CANCELLED ||
    rental === RENTAL_STATE.DECLINED ||
    rental === RENTAL_STATE.RENTAL_IN_PROGRESS ||
    rental === RENTAL_STATE.COMPLETION_PENDING ||
    rental === RENTAL_STATE.COMPLETED
  ) {
    return {
      ok: false,
      code: "terminal",
      message: "This booking is cancelled, declined, or already confirmed.",
    };
  }

  const storedChecksum =
    order.payment?.priceChecksum ||
    order.partnerConfirmMeta?.priceChecksum ||
    "";
  const liveChecksum = computePriceSnapshotChecksum(order);
  if (storedChecksum && liveChecksum && storedChecksum !== liveChecksum) {
    return {
      ok: false,
      code: "price_changed",
      message: "The stored price snapshot no longer matches. Do not issue a new link.",
    };
  }

  const paymentState = resolveBookingPaymentState(order, { now });
  if (
    paymentState.state === BOOKING_PAYMENT_STATE.PAYMENT_LINK_ACTIVE ||
    sessionStillActive(order, now)
  ) {
    return {
      ok: false,
      code: "session_active",
      message: "The current payment link is still active. Resend that email instead.",
      canResend: true,
    };
  }

  if (paymentState.state !== BOOKING_PAYMENT_STATE.PAYMENT_LINK_EXPIRED) {
    return {
      ok: false,
      code: "payment_link_not_expired",
      message: "A replacement link can only be created after the current payment link expires.",
      canResend: Boolean(order.payment?.checkoutUrl),
    };
  }

  return {
    ok: true,
    canResend: false,
    priceChecksum: liveChecksum || storedChecksum,
  };
}

async function carStillAvailable(order) {
  const orderQuery = Order.find({ car: order.car });
  const existingOrders =
    typeof orderQuery.lean === "function"
      ? await orderQuery.lean()
      : await orderQuery;
  return evaluateRentalAvailability({
    carId: order.car,
    pickupAtUtc: order.pickupAtUtc || order.timeIn,
    returnAtUtc: order.returnAtUtc || order.timeOut,
    timezone: order.timezone,
    existingOrders,
    excludeOrderId: String(order._id),
    purpose: AVAILABILITY_PURPOSE.CONFIRM,
    bookingMode: order.bookingMode,
  });
}

/**
 * Reissue a marketplace payment link after the current Stripe link expires.
 * Reuses the immutable authoritative price snapshot — never recalculates.
 */
export async function reissueMarketplacePaymentLink({
  orderId,
  reason,
  reasonNote = "",
  actorEmail = "",
  actorRole = "superadmin",
  actorUserId = "",
  actorCompanyId = "",
  ipAddress = "",
  userAgent = "",
  idempotencyKey = "",
  now = new Date(),
  complianceOverride = false,
  complianceOverrideReason = "",
}) {
  await connectToDB();
  const normalizedReason = normalizeReissueReason(reason);
  if (!normalizedReason) {
    return {
      ok: false,
      status: 400,
      code: "invalid_reason",
      message: "Pick a short reason for issuing a new payment link.",
    };
  }

  await cleanupExpiredHolds(now, { trigger: "reissue", limit: 25 });

  const doc = await Order.findById(orderId);
  if (!doc) {
    return { ok: false, status: 404, code: "not_found", message: "Order not found" };
  }

  if (
    actorRole !== "superadmin" &&
    String(actorCompanyId || "").trim() !== String(doc.ownerId || "").trim()
  ) {
    return { ok: false, status: 404, code: "not_found", message: "Order not found" };
  }

  if (
    idempotencyKey &&
    doc.payment?.reissueIdempotencyKey === idempotencyKey &&
    sessionStillActive(doc, now)
  ) {
    return {
      ok: true,
      idempotent: true,
      reused: true,
      url: doc.payment.checkoutUrl,
      sessionId: doc.payment.providerPaymentId,
      expiresAt: doc.payment.expiresAt || null,
      order: doc.toObject(),
    };
  }

  const guard = evaluatePaymentLinkReissue(doc, { now });
  if (!guard.ok) {
    if (guard.code === "session_active" && guard.canResend) {
      return {
        ok: true,
        idempotent: true,
        reused: true,
        url: doc.payment?.checkoutUrl || "",
        sessionId: doc.payment?.providerPaymentId || "",
        expiresAt: doc.payment?.expiresAt || null,
        order: doc.toObject(),
      };
    }
    return { ...guard, status: guard.code === "not_found" ? 404 : 409 };
  }

  const reissueGate = await assertPartnerCanOperate(doc.ownerId, {
    purpose: PARTNER_OPERATION_PURPOSE.REISSUE,
    overrideReason:
      complianceOverride && actorRole === "superadmin"
        ? complianceOverrideReason
        : "",
    overrideByRole: actorRole,
    overrideByEmail: actorEmail,
    audit: { orderId: doc._id, ipAddress, userAgent },
  });
  if (!reissueGate.allowed) {
    await auditPartnerComplianceBlock({
      purpose: PARTNER_OPERATION_PURPOSE.REISSUE,
      result: reissueGate,
      actorEmail,
      actorRole,
      ipAddress,
      userAgent,
      orderId: doc._id,
    });
    return {
      ok: false,
      status: 403,
      error: reissueGate.error,
      code: reissueGate.code,
      message: reissueGate.partnerMessage,
    };
  }

  const availability = await carStillAvailable(doc);
  if (availability.hardConflict) {
    return {
      ok: false,
      status: 409,
      code: "date_conflict",
      message: availability.userSafeReason || "Those dates are not available.",
    };
  }

  const settings = await loadLegalSettings().catch(() => ({
    paymentLinkExpirationMinutes: 60,
  }));
  const expireMinutes = clampStripeExpiresMinutes(
    settings.paymentLinkExpirationMinutes
  );
  const holdExpiresAt = new Date(now.getTime() + expireMinutes * 60 * 1000);

  const hold = await acquireMarketplaceHold({
    carId: doc.car,
    orderId: doc._id,
    companyId: doc.ownerId,
    pickupAtUtc: doc.pickupAtUtc || doc.timeIn,
    returnAtUtc: doc.returnAtUtc || doc.timeOut,
    holdExpiresAt,
    timezone: doc.timezone,
    bookingMode: doc.bookingMode,
  });
  if (!hold.ok) {
    await recordAuditEvent({
      action: "BOOKING_HOLD_CONFLICT",
      userRole: actorRole,
      userEmail: actorEmail,
      severity: "high",
      result: "failure",
      ipAddress,
      userAgent,
      reason: normalizedReason,
      orderData: { orderId: doc._id, orderNumber: doc.orderNumber },
      metadata: { code: hold.code, message: hold.message },
    });
    return {
      ok: false,
      status: 409,
      code: hold.code,
      message: hold.message,
    };
  }

  const latestBeforeCheckout = await Order.findById(doc._id);
  if (
    latestBeforeCheckout?.payment?.status === "paid" ||
    resolveRentalState(latestBeforeCheckout) === RENTAL_STATE.CONFIRMED ||
    String(latestBeforeCheckout?.bookingStatus || "") ===
      BOOKING_STATUS.BOOKING_CONFIRMED
  ) {
    await releaseMarketplaceHold(doc._id, { reason: "paid_before_reissue_checkout" });
    return {
      ok: false,
      status: 409,
      code: "already_paid",
      message: "This booking is already paid.",
    };
  }

  const checkout = await createRentalCheckoutSession(String(doc._id), {
    forceNew: true,
    emailCustomer: false,
    complianceOverrideReason:
      complianceOverride && actorRole === "superadmin"
        ? complianceOverrideReason
        : "",
    complianceOverrideRole: actorRole,
    complianceOverrideEmail: actorEmail,
  });
  if (!checkout.ok || !checkout.url) {
    await markHoldForRetry(doc._id, {
      reason: checkout.code || "checkout_failed",
    });
    await recordAuditEvent({
      action: "RENTAL_CHECKOUT_FAILED",
      userRole: actorRole,
      userEmail: actorEmail,
      severity: "critical",
      result: "failure",
      ipAddress,
      userAgent,
      reason: normalizedReason,
      orderData: { orderId: doc._id, orderNumber: doc.orderNumber },
      metadata: { code: checkout.code, message: checkout.message },
    });
    return {
      ok: false,
      status: 502,
      code: checkout.code || "checkout_failed",
      message: checkout.message || "Could not create a new payment link.",
    };
  }

  const reloaded = await Order.findById(doc._id);
  if (
    reloaded?.payment?.status === "paid" ||
    resolveRentalState(reloaded) === RENTAL_STATE.CONFIRMED ||
    String(reloaded?.bookingStatus || "") === BOOKING_STATUS.BOOKING_CONFIRMED
  ) {
    await releaseMarketplaceHold(doc._id, { reason: "paid_during_reissue" });
    return {
      ok: false,
      status: 409,
      code: "already_paid",
      message: "This booking is already paid.",
    };
  }
  const rental = resolveRentalState(reloaded);
  if (rental === RENTAL_STATE.PAYMENT_EXPIRED) {
    applyRentalStateTransition(reloaded, RENTAL_STATE.PAYMENT_PENDING);
  } else if (rental === RENTAL_STATE.PARTNER_CONFIRMED) {
    applyRentalStateTransition(reloaded, RENTAL_STATE.PAYMENT_PENDING);
  } else if (rental !== RENTAL_STATE.PAYMENT_PENDING) {
    reloaded.bookingStatus = BOOKING_STATUS.PAYMENT_PROCESSING;
  }
  reloaded.set(
    "payment",
    {
      ...(reloaded.payment && typeof reloaded.payment === "object"
        ? reloaded.payment
        : {}),
      reissueIdempotencyKey: idempotencyKey || "",
      reissueReason: normalizedReason,
      reissueReasonNote: String(reasonNote || "").slice(0, 300),
      reissuedAt: now,
      reissuedByEmail: actorEmail,
      priceChecksum: guard.priceChecksum,
    },
    { strict: false }
  );
  await reloaded.save();
  await attachStripeSessionToHold(reloaded._id, checkout.sessionId);

  const mailed = await sendCustomerNewPaymentLinkEmail({
    order: reloaded.toObject(),
    paymentUrl: checkout.url,
    expiresAt: checkout.expiresAt,
    stripeSessionId: checkout.sessionId,
  });

  await recordAuditEvent({
    action: "RENTAL_PAYMENT_LINK_REISSUED",
    userRole: actorRole,
    userEmail: actorEmail,
    severity: "high",
    ipAddress,
    userAgent,
    reason: normalizedReason,
    orderData: {
      orderId: reloaded._id,
      orderNumber: reloaded.orderNumber,
      carModel: reloaded.carModel,
    },
    metadata: {
      reason: normalizedReason,
      reasonNote: String(reasonNote || "").slice(0, 300),
      previousSessionId: currentStripeSessionId(doc),
      newSessionId: checkout.sessionId,
      sessionId: checkout.sessionId,
      companyId: doc.ownerId ? String(doc.ownerId) : "",
      publicReference: doc.publicReference || "",
      actorUserId: String(actorUserId || ""),
      actorRole,
      timestamp: now.toISOString(),
      priceChecksum: guard.priceChecksum,
      emailed: Boolean(mailed.ok && !mailed.deduped),
    },
  });

  return {
    ok: true,
    idempotent: false,
    url: checkout.url,
    sessionId: checkout.sessionId,
    expiresAt: checkout.expiresAt,
    priceChecksum: guard.priceChecksum,
    mailed,
    order: reloaded.toObject(),
  };
}

export async function loadMarketplaceHold(orderId) {
  return BookingHold.findOne({ orderId }).lean();
}

export { HOLD_STATUS };
