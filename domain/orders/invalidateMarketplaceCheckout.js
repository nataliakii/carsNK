/**
 * Expire still-open unpaid Spain marketplace Checkout Sessions when a
 * partner loses operating permission. Covers order.payment sessions and
 * alternative-offer sessions stored on AlternativeVehicleOffer.
 * Paid / BOOKING_CONFIRMED records are never touched.
 */

import { Order } from "@models/order";
import Company from "@models/company";
import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import { connectToDB } from "@lib/database";
import { getStripeMode, isStripeConfigured } from "@config/stripe";
import { assertStripeReady } from "@/lib/stripe";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  BOOKING_MODES,
  isMarketplaceRequestMode,
} from "@/domain/booking/bookingMode";
import {
  applyCompliancePaymentExpiration,
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import {
  releaseMarketplaceHold,
  releaseMarketplaceHoldForOffer,
} from "@/domain/booking/bookingHold";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import { isMarketplaceOperatingCompany } from "@/domain/legal/partnerOperatingPolicy";
import { getCurrentPackageChecksum } from "@/domain/legal/agreementService";
import {
  archiveOfferCheckoutSession,
  archiveStripeSession,
  currentStripeSessionId,
  rememberArchivedStripeSession,
  STRIPE_SESSION_ARCHIVE,
} from "@/domain/orders/stripePaymentRefs";
import { sendCustomerPaymentLinkUnavailableEmail } from "@/domain/orders/marketplaceBookingEmails";

export const CHECKOUT_INVALIDATION_REASON = Object.freeze({
  SUSPENDED: "PARTNER_SUSPENDED",
  REJECTED: "PARTNER_REJECTED",
  PROFILE_NOT_VERIFIED: "PROFILE_NOT_VERIFIED",
  AGREEMENT_MISSING: "AGREEMENT_MISSING",
  AGREEMENT_OUTDATED: "AGREEMENT_OUTDATED",
  MARKETPLACE_DISABLED: "MARKETPLACE_DISABLED",
});

export const INVALIDATION_ERROR_CATEGORY = Object.freeze({
  STRIPE_RETRIEVE: "stripe_retrieve_failed",
  STRIPE_EXPIRE: "stripe_expire_failed",
  STRIPE_NETWORK: "stripe_network",
  LOCAL_SAVE: "local_save_failed",
  UNKNOWN: "unknown",
});

export const CHECKOUT_INVALIDATION_RETRY = Object.freeze({
  MAX_ATTEMPTS: 8,
  BATCH_LIMIT: 50,
  BATCH_MAX: 200,
});

export const CHECKOUT_SESSION_KIND = Object.freeze({
  BOOKING: "booking",
  ALTERNATIVE_OFFER: "alternative_offer",
});

const OPEN_UNPAID_FILTER = {
  bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
  "payment.status": { $nin: ["paid"] },
  bookingStatus: {
    $nin: [
      BOOKING_STATUS.BOOKING_CONFIRMED,
      BOOKING_STATUS.CUSTOMER_CANCELLED,
      BOOKING_STATUS.SUPPLIER_CANCELLED,
      BOOKING_STATUS.ADMIN_CANCELLED,
      BOOKING_STATUS.COMPLETED,
    ],
  },
  "payment.provider": "stripe",
  "payment.providerPaymentId": { $exists: true, $nin: [null, ""] },
};

function isPaidOrConfirmed(order) {
  const bookingStatus = String(order?.bookingStatus || "");
  const rental = resolveRentalState(order);
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  return (
    paymentStatus === "paid" ||
    paymentStatus === "refunded" ||
    paymentStatus === "disputed" ||
    bookingStatus === BOOKING_STATUS.BOOKING_CONFIRMED ||
    rental === RENTAL_STATE.CONFIRMED
  );
}

function alreadyInvalidatedOrder(order) {
  return order?.payment?.status === "expired" && !order?.payment?.checkoutUrl;
}

function alreadyInvalidatedOffer(offer) {
  return (
    !offer?.checkoutUrl &&
    !offer?.complianceInvalidateRetry &&
    Array.isArray(offer?.sessionHistory) &&
    offer.sessionHistory.length > 0
  );
}

function stripeLooksPaid(session) {
  if (!session) return false;
  const paymentStatus = String(session.payment_status || "").toLowerCase();
  const status = String(session.status || "").toLowerCase();
  return paymentStatus === "paid" || status === "complete";
}

function stripeLooksExpired(session) {
  if (!session) return false;
  return String(session.status || "").toLowerCase() === "expired";
}

function stripeLooksOpen(session) {
  if (!session) return false;
  return String(session.status || "").toLowerCase() === "open";
}

export function classifyInvalidationError(error) {
  const msg = String(error || "").toLowerCase();
  if (/retriev/i.test(msg)) return INVALIDATION_ERROR_CATEGORY.STRIPE_RETRIEVE;
  if (/expire/i.test(msg)) return INVALIDATION_ERROR_CATEGORY.STRIPE_EXPIRE;
  if (/network|timeout|econn|enotfound|503|429/i.test(msg)) {
    return INVALIDATION_ERROR_CATEGORY.STRIPE_NETWORK;
  }
  if (/save|mongo|write/i.test(msg)) return INVALIDATION_ERROR_CATEGORY.LOCAL_SAVE;
  if (/retriev/.test(msg)) return INVALIDATION_ERROR_CATEGORY.STRIPE_RETRIEVE;
  return INVALIDATION_ERROR_CATEGORY.UNKNOWN;
}

export function sanitizeInvalidationError(error) {
  return String(error || "")
    .replace(/sk_(live|test)_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/rk_(live|test)_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/whsec_[A-Za-z0-9]+/g, "[redacted]")
    .slice(0, 200);
}

export function nextInvalidationRetryAt(attempts, now = new Date()) {
  const n = Math.max(1, Number(attempts) || 1);
  const minutes = 2 ** Math.min(n, 6);
  return new Date(now.getTime() + minutes * 60 * 1000);
}

export function clampInvalidationRetryBatchSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return CHECKOUT_INVALIDATION_RETRY.BATCH_LIMIT;
  return Math.min(CHECKOUT_INVALIDATION_RETRY.BATCH_MAX, Math.round(n));
}

async function retrieveCheckoutSession(sessionId) {
  if (!sessionId) return { ok: true, missing: true, session: null };
  if (!isStripeConfigured()) {
    return { ok: true, stripeUnavailable: true, session: null };
  }
  try {
    const stripe = assertStripeReady(getStripeMode());
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return { ok: true, session };
  } catch (err) {
    const msg = String(err?.message || err);
    if (/No such/i.test(msg)) {
      return { ok: true, missing: true, session: null };
    }
    return { ok: false, retryable: true, error: msg };
  }
}

async function expireCheckoutSession(sessionId) {
  if (!sessionId || !isStripeConfigured()) {
    return { ok: true, skipped: true };
  }
  try {
    const stripe = assertStripeReady(getStripeMode());
    await stripe.checkout.sessions.expire(sessionId);
    return { ok: true };
  } catch (err) {
    const msg = String(err?.message || err);
    if (/expired/i.test(msg)) return { ok: true, alreadyExpired: true };
    if (/complete|No such/i.test(msg)) {
      return { ok: false, maybePaid: /complete/i.test(msg), error: msg };
    }
    return { ok: false, retryable: true, error: msg };
  }
}

function retryFields({ attempts, category, error, now }) {
  return {
    complianceInvalidateRetry: true,
    complianceInvalidateAttempts: attempts,
    complianceInvalidateRetryAt: nextInvalidationRetryAt(attempts, now),
    lastInvalidateErrorCategory: category,
    lastInvalidateAttemptAt: now,
    lastCheckoutError: category,
  };
}

function clearedRetryFields() {
  return {
    complianceInvalidateRetry: false,
    complianceInvalidateRetryAt: null,
    lastInvalidateErrorCategory: "",
  };
}

/** Persist a cleared retry marker after expiration or a confirmed no-op. */
async function persistOrderRetryClear(order) {
  if (!order?.payment || order.payment.complianceInvalidateRetry !== true) return;
  const payment = {
    ...(typeof order.payment === "object" ? order.payment : {}),
    ...clearedRetryFields(),
  };
  if (typeof order.set === "function") {
    order.set("payment", payment, { strict: false });
  } else {
    order.payment = payment;
  }
  if (typeof order.save === "function") {
    await order.save().catch(() => {});
  }
}

async function persistOfferRetryClear(offer) {
  if (!offer || offer.complianceInvalidateRetry !== true) return;
  offer.complianceInvalidateRetry = false;
  offer.complianceInvalidateRetryAt = null;
  offer.lastInvalidateErrorCategory = "";
  if (typeof offer.save === "function") {
    await offer.save().catch(() => {});
  }
}

async function expireStripeThenLocal({
  sessionId,
  reason,
  actor,
  onPaid,
  onRetry,
  onLocal,
}) {
  const retrieved = await retrieveCheckoutSession(sessionId);
  if (!retrieved.ok) {
    return await onRetry({
      category: INVALIDATION_ERROR_CATEGORY.STRIPE_RETRIEVE,
      error: retrieved.error,
    });
  }
  if (stripeLooksPaid(retrieved.session)) {
    return await onPaid();
  }
  if (stripeLooksOpen(retrieved.session)) {
    const expired = await expireCheckoutSession(sessionId);
    if (!expired.ok && expired.maybePaid) {
      const again = await retrieveCheckoutSession(sessionId);
      if (again.ok && stripeLooksPaid(again.session)) return await onPaid();
    }
    if (!expired.ok && expired.retryable) {
      return await onRetry({
        category: INVALIDATION_ERROR_CATEGORY.STRIPE_EXPIRE,
        error: expired.error,
      });
    }
    if (!expired.ok) {
      const again = await retrieveCheckoutSession(sessionId);
      if (again.ok && stripeLooksPaid(again.session)) return await onPaid();
      if (!(again.ok && (stripeLooksExpired(again.session) || again.missing))) {
        return await onRetry({
          category: INVALIDATION_ERROR_CATEGORY.STRIPE_EXPIRE,
          error: expired.error,
        });
      }
    }
  }
  try {
    return await onLocal();
  } catch (err) {
    return await onRetry({
      category: INVALIDATION_ERROR_CATEGORY.LOCAL_SAVE,
      error: err?.message || err,
    });
  }
}

async function notifyInvalidateFailure({ title, reason, actor, error, meta }) {
  await recordAuditEvent({
    action: "RENTAL_CHECKOUT_INVALIDATE_FAILED",
    userRole: actor.role || "system",
    userEmail: actor.email || "",
    severity: "high",
    result: "failure",
    reason,
    ipAddress: actor.ipAddress || "",
    userAgent: actor.userAgent || "",
    orderData: meta.orderId
      ? { orderId: meta.orderId, orderNumber: meta.orderNumber }
      : undefined,
    metadata: {
      companyId: meta.companyId || "",
      sessionId: meta.sessionId || "",
      offerId: meta.offerId || "",
      category: meta.category || "",
      error: sanitizeInvalidationError(error),
    },
  });
  try {
    await notifySuperadmin({
      title,
      bodyLines: [
        `Internal reason: ${reason}`,
        `Stripe API failed; session was NOT treated as expired.`,
        `Category: ${meta.category || ""}`,
        meta.companyId ? `Company ${meta.companyId}` : "",
        meta.orderId ? `Order ${meta.orderId}` : "",
        meta.offerId ? `Offer ${meta.offerId}` : "",
        meta.sessionId ? `Session ${meta.sessionId}` : "",
      ].filter(Boolean),
      meta: {
        orderId: meta.orderId,
        companyId: meta.companyId,
        type: "checkout_invalidate_failed",
      },
    });
  } catch (err) {
    console.error("[checkout invalidate] failure notify failed", err?.message || err);
  }
}

async function markOrderInvalidateFailure(doc, { reason, error, actor, category }) {
  const attempts = Number(doc.payment?.complianceInvalidateAttempts || 0) + 1;
  const now = new Date();
  const cat = category || classifyInvalidationError(error);
  const payment = {
    ...(doc.payment && typeof doc.payment === "object" ? doc.payment : {}),
    ...retryFields({ attempts, category: cat, error, now }),
  };
  if (typeof doc.set === "function") {
    doc.set("payment", payment, { strict: false });
    await doc.save().catch(() => {});
  }
  await notifyInvalidateFailure({
    title: `⚠️ Checkout invalidation failed — order #${doc.orderNumber || doc._id}`,
    reason,
    actor,
    error,
    meta: {
      category: cat,
      companyId: doc.ownerId ? String(doc.ownerId) : "",
      orderId: doc._id,
      orderNumber: doc.orderNumber,
      sessionId: doc.payment?.providerPaymentId || "",
    },
  });
}

async function markOfferInvalidateFailure(offer, { reason, error, actor, category, order }) {
  const attempts = Number(offer.complianceInvalidateAttempts || 0) + 1;
  const now = new Date();
  const cat = category || classifyInvalidationError(error);
  offer.complianceInvalidateRetry = true;
  offer.complianceInvalidateAttempts = attempts;
  offer.complianceInvalidateRetryAt = nextInvalidationRetryAt(attempts, now);
  offer.lastInvalidateErrorCategory = cat;
  offer.lastInvalidateAttemptAt = now;
  await offer.save().catch(() => {});
  await notifyInvalidateFailure({
    title: `⚠️ Alternative checkout invalidation failed — offer ${offer.offerId}`,
    reason,
    actor,
    error,
    meta: {
      category: cat,
      companyId: offer.companyId ? String(offer.companyId) : "",
      orderId: offer.orderId,
      orderNumber: order?.orderNumber,
      offerId: offer.offerId,
      sessionId: offer.stripeSessionId || "",
    },
  });
}

async function applyLocalOrderInvalidation(
  doc,
  { reason, actor, sessionId, now, emailCustomer = true, skipHoldRelease = false }
) {
  const archived = archiveStripeSession(
    {
      ...(doc.payment && typeof doc.payment === "object" ? doc.payment : {}),
    },
    { status: STRIPE_SESSION_ARCHIVE.EXPIRED, at: now }
  );
  const payment = {
    ...archived,
    status: "expired",
    checkoutUrl: "",
    lastCheckoutError: reason,
    invalidatedReason: reason,
    invalidatedAt: now,
    ...clearedRetryFields(),
  };

  const moved = applyCompliancePaymentExpiration(doc);
  if (!moved.ok && (moved.code === "paid_or_confirmed" || moved.code === "terminal")) {
    return { skipped: true, reason: moved.code };
  }
  if (typeof doc.set === "function") {
    doc.set("payment", payment, { strict: false });
  } else {
    doc.payment = payment;
  }
  await doc.save();
  if (!skipHoldRelease) {
    await releaseMarketplaceHold(doc._id, { reason: `compliance:${reason}` });
  }

  await recordAuditEvent({
    action: "RENTAL_CHECKOUT_INVALIDATED",
    userRole: actor.role || "system",
    userEmail: actor.email || "",
    severity: "high",
    reason,
    ipAddress: actor.ipAddress || "",
    userAgent: actor.userAgent || "",
    orderData: { orderId: doc._id, orderNumber: doc.orderNumber },
    metadata: {
      companyId: doc.ownerId ? String(doc.ownerId) : "",
      sessionId: sessionId || "",
      reason,
      sessionKind: CHECKOUT_SESSION_KIND.BOOKING,
    },
  });

  let emailed = { ok: true, skipped: true };
  if (emailCustomer) {
    emailed = await sendCustomerPaymentLinkUnavailableEmail({
      order: doc.toObject ? doc.toObject() : doc,
      stripeSessionId: sessionId,
    });
  }
  return { emailed };
}

async function recordOfferSessionOnOrder(order, { sessionId, checkoutUrl, now }) {
  if (!order || !sessionId) return;
  if (isPaidOrConfirmed(order)) return;
  const current = currentStripeSessionId(order);
  if (current && current === sessionId) return;
  const payment = rememberArchivedStripeSession(
    {
      ...(order.payment && typeof order.payment === "object" ? order.payment : {}),
    },
    {
      sessionId,
      checkoutUrl,
      status: STRIPE_SESSION_ARCHIVE.EXPIRED,
      at: now,
    }
  );
  if (typeof order.set === "function") {
    order.set("payment", payment, { strict: false });
  } else {
    order.payment = payment;
  }
  await order.save().catch(() => {});
}

/**
 * Invalidate one unpaid marketplace order's current Checkout Session.
 */
export async function invalidateMarketplaceCheckoutForOrder(
  order,
  {
    reason = CHECKOUT_INVALIDATION_REASON.PROFILE_NOT_VERIFIED,
    actorEmail = "",
    actorRole = "system",
    ipAddress = "",
    userAgent = "",
    now = new Date(),
    ignoreRetryAt = false,
  } = {}
) {
  const actor = {
    email: actorEmail,
    role: actorRole,
    ipAddress,
    userAgent,
  };
  if (!order) return { ok: true, skipped: true, reason: "missing_order" };
  if (!isMarketplaceRequestMode(order.bookingMode)) {
    return { ok: true, skipped: true, reason: "not_marketplace" };
  }
  if (isPaidOrConfirmed(order)) {
    await persistOrderRetryClear(order);
    return { ok: true, skipped: true, reason: "confirmed", skippedConfirmed: true, skippedPaid: true };
  }
  const sessionId = String(order.payment?.providerPaymentId || "");
  if (alreadyInvalidatedOrder(order)) {
    await persistOrderRetryClear(order);
    const emailed = await sendCustomerPaymentLinkUnavailableEmail({
      order: order.toObject ? order.toObject() : order,
      stripeSessionId: sessionId,
    });
    return {
      ok: true,
      skipped: true,
      idempotent: true,
      reason: "already_invalidated",
      emailed,
    };
  }
  if (!sessionId && !order.payment?.checkoutUrl) {
    await persistOrderRetryClear(order);
    return { ok: true, skipped: true, reason: "no_session" };
  }
  if (
    !ignoreRetryAt &&
    order.payment?.complianceInvalidateRetry &&
    order.payment?.complianceInvalidateRetryAt &&
    new Date(order.payment.complianceInvalidateRetryAt) > now
  ) {
    return { ok: true, skipped: true, reason: "backoff", retryable: true };
  }

  return expireStripeThenLocal({
    sessionId,
    reason,
    actor,
    onPaid: async () => {
      await persistOrderRetryClear(order);
      return {
        ok: true,
        skipped: true,
        reason: "stripe_paid",
        leaveForWebhook: true,
        skippedPaid: true,
      };
    },
    onRetry: async ({ category, error }) => {
      await markOrderInvalidateFailure(order, {
        reason,
        error,
        actor,
        category,
      });
      return {
        ok: false,
        retryable: true,
        code: category,
        error: sanitizeInvalidationError(error),
      };
    },
    onLocal: async () => {
      const local = await applyLocalOrderInvalidation(order, {
        reason,
        actor,
        sessionId,
        now,
      });
      if (local?.skipped) {
        return { ok: true, skipped: true, reason: local.reason };
      }
      return {
        ok: true,
        invalidated: true,
        emailed: local.emailed,
        orderId: String(order._id),
        sessionId,
        reason,
        sessionKind: CHECKOUT_SESSION_KIND.BOOKING,
      };
    },
  });
}

/**
 * Invalidate the Checkout Session stored on an alternative-offer row.
 * Does not restore the original vehicle or rewrite authoritativePrice.
 */
export async function invalidateMarketplaceCheckoutForAlternativeOffer(
  offer,
  {
    reason = CHECKOUT_INVALIDATION_REASON.PROFILE_NOT_VERIFIED,
    actorEmail = "",
    actorRole = "system",
    ipAddress = "",
    userAgent = "",
    now = new Date(),
    ignoreRetryAt = false,
    order: orderHint = null,
  } = {}
) {
  const actor = {
    email: actorEmail,
    role: actorRole,
    ipAddress,
    userAgent,
  };
  if (!offer) return { ok: true, skipped: true, reason: "missing_offer" };

  const order = orderHint || (await Order.findById(offer.orderId));
  if (order && !isMarketplaceRequestMode(order.bookingMode)) {
    return { ok: true, skipped: true, reason: "not_marketplace" };
  }
  if (order && isPaidOrConfirmed(order)) {
    await persistOfferRetryClear(offer);
    return {
      ok: true,
      skipped: true,
      reason: "confirmed",
      skippedConfirmed: true,
      skippedPaid: true,
    };
  }
  if (alreadyInvalidatedOffer(offer)) {
    await persistOfferRetryClear(offer);
    return { ok: true, skipped: true, idempotent: true, reason: "already_invalidated" };
  }

  const sessionId = String(offer.stripeSessionId || "");
  if (!sessionId && !offer.checkoutUrl) {
    await persistOfferRetryClear(offer);
    return { ok: true, skipped: true, reason: "no_session" };
  }
  if (
    !ignoreRetryAt &&
    offer.complianceInvalidateRetry &&
    offer.complianceInvalidateRetryAt &&
    new Date(offer.complianceInvalidateRetryAt) > now
  ) {
    return { ok: true, skipped: true, reason: "backoff", retryable: true };
  }

  return expireStripeThenLocal({
    sessionId,
    reason,
    actor,
    onPaid: async () => {
      await persistOfferRetryClear(offer);
      return {
        ok: true,
        skipped: true,
        reason: "stripe_paid",
        leaveForWebhook: true,
        skippedPaid: true,
      };
    },
    onRetry: async ({ category, error }) => {
      await markOfferInvalidateFailure(offer, {
        reason,
        error,
        actor,
        category,
        order,
      });
      return {
        ok: false,
        retryable: true,
        code: category,
        error: sanitizeInvalidationError(error),
      };
    },
    onLocal: async () => {
      const archived = archiveOfferCheckoutSession(offer, {
        status: STRIPE_SESSION_ARCHIVE.EXPIRED,
        at: now,
      });
      offer.sessionHistory = archived.sessionHistory;
      offer.checkoutUrl = "";
      offer.stripeSessionId = "";
      offer.paymentLinkGenerationFailed = false;
      offer.invalidatedReason = reason;
      offer.invalidatedAt = now;
      offer.complianceInvalidateRetry = false;
      offer.complianceInvalidateRetryAt = null;
      offer.lastInvalidateErrorCategory = "";
      if (offer.status === "ACCEPTED" || offer.status === "OFFERED") {
        offer.status = "EXPIRED";
        offer.decidedAt = offer.decidedAt || now;
      }
      await offer.save();

      if (order) {
        const current = currentStripeSessionId(order);
        if (sessionId && current === sessionId) {
          if (!alreadyInvalidatedOrder(order)) {
            await applyLocalOrderInvalidation(order, {
              reason,
              actor,
              sessionId,
              now,
              emailCustomer: false,
              skipHoldRelease: true,
            });
          }
        } else {
          await recordOfferSessionOnOrder(order, {
            sessionId,
            checkoutUrl: "",
            now,
          });
        }
      }

      await releaseMarketplaceHoldForOffer(offer.orderId, offer.offerId, {
        reason: `compliance:${reason}`,
      });

      await recordAuditEvent({
        action: "RENTAL_ALTERNATIVE_CHECKOUT_INVALIDATED",
        userRole: actor.role || "system",
        userEmail: actor.email || "",
        severity: "high",
        reason,
        ipAddress: actor.ipAddress || "",
        userAgent: actor.userAgent || "",
        orderData: order
          ? { orderId: order._id, orderNumber: order.orderNumber }
          : { orderId: offer.orderId },
        metadata: {
          companyId: offer.companyId ? String(offer.companyId) : "",
          sessionId: sessionId || "",
          offerId: offer.offerId,
          reason,
          sessionKind: CHECKOUT_SESSION_KIND.ALTERNATIVE_OFFER,
        },
      });

      const emailed = await sendCustomerPaymentLinkUnavailableEmail({
        order: order
          ? order.toObject
            ? order.toObject()
            : order
          : { _id: offer.orderId, email: "" },
        stripeSessionId: sessionId,
      });
      return {
        ok: true,
        invalidated: true,
        emailed,
        offerId: offer.offerId,
        orderId: String(offer.orderId),
        sessionId,
        reason,
        sessionKind: CHECKOUT_SESSION_KIND.ALTERNATIVE_OFFER,
      };
    },
  });
}

export async function invalidateOpenMarketplaceCheckoutSessions(
  companyId,
  {
    reason = CHECKOUT_INVALIDATION_REASON.PROFILE_NOT_VERIFIED,
    actorEmail = "",
    actorRole = "system",
    ipAddress = "",
    userAgent = "",
  } = {}
) {
  await connectToDB();
  const id = companyId ? String(companyId) : "";
  if (!id) {
    return { ok: true, skipped: true, reason: "missing_company" };
  }

  const company = await Company.findById(id)
    .select("_id country bookingMode listedOnMarketplace")
    .lean();
  if (!isMarketplaceOperatingCompany(company)) {
    return { ok: true, skipped: true, reason: "not_marketplace" };
  }

  const orders = await Order.find({
    ...OPEN_UNPAID_FILTER,
    ownerId: company._id,
  });

  const results = [];
  const expiredSessionIds = new Set();
  for (const order of orders) {
    const row = await invalidateMarketplaceCheckoutForOrder(order, {
      reason,
      actorEmail,
      actorRole,
      ipAddress,
      userAgent,
    });
    results.push(row);
    if (row.invalidated && row.sessionId) expiredSessionIds.add(String(row.sessionId));
  }

  const offers = await AlternativeVehicleOffer.find({
    companyId: company._id,
    $or: [
      { checkoutUrl: { $exists: true, $nin: [null, ""] } },
      { stripeSessionId: { $exists: true, $nin: [null, ""] } },
      { complianceInvalidateRetry: true },
    ],
  });

  for (const offer of offers) {
    const sessionId = String(offer.stripeSessionId || "");
    if (sessionId && expiredSessionIds.has(sessionId) && !offer.checkoutUrl) {
      results.push({ ok: true, skipped: true, idempotent: true, reason: "already_invalidated" });
      continue;
    }
    const row = await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason,
      actorEmail,
      actorRole,
      ipAddress,
      userAgent,
    });
    results.push(row);
  }

  const invalidated = results.filter((row) => row.invalidated).length;
  const failed = results.filter((row) => row.ok === false).length;
  const skippedPaid = results.filter((row) => row.skippedPaid || row.reason === "stripe_paid").length;
  const idempotent = results.filter((row) => row.idempotent).length;

  if (invalidated || failed) {
    try {
      await notifySuperadmin({
        title: `Marketplace checkout sessions invalidated — company ${id}`,
        bodyLines: [
          `Internal reason: ${reason}`,
          `Invalidated: ${invalidated}`,
          `Failed (retry): ${failed}`,
          `Stripe already paid (left for webhook): ${skippedPaid}`,
          `Already invalidated: ${idempotent}`,
          `Company ${id}`,
        ],
        meta: { companyId: id, type: "checkout_invalidated" },
      });
    } catch (err) {
      console.error("[checkout invalidate] company notify failed", err?.message || err);
    }
  }

  return {
    ok: failed === 0,
    companyId: id,
    reason,
    scanned: orders.length + offers.length,
    invalidated,
    failed,
    skippedPaid,
    idempotent,
    results,
  };
}

export async function invalidateMarketplaceCheckoutsForOutdatedAgreements({
  actorEmail = "",
  actorRole = "superadmin",
  ipAddress = "",
  userAgent = "",
} = {}) {
  await connectToDB();
  const checksum = await getCurrentPackageChecksum();
  if (!checksum) {
    return { ok: true, skipped: true, reason: "no_checksum" };
  }

  const acceptances = await PartnerAgreementAcceptance.find({
    supersededAt: null,
    terminatedAt: null,
  })
    .select("companyId packageChecksum")
    .lean();

  const outdatedIds = [
    ...new Set(
      (acceptances || [])
        .filter((row) => row.packageChecksum && row.packageChecksum !== checksum)
        .map((row) => String(row.companyId))
    ),
  ];

  const summaries = [];
  for (const companyId of outdatedIds) {
    summaries.push(
      await invalidateOpenMarketplaceCheckoutSessions(companyId, {
        reason: CHECKOUT_INVALIDATION_REASON.AGREEMENT_OUTDATED,
        actorEmail,
        actorRole,
        ipAddress,
        userAgent,
      })
    );
  }
  return { ok: true, checksum, companies: outdatedIds.length, summaries };
}

export function shouldInvalidateOnVerificationChange(from, to) {
  if (!to) return false;
  if (to === "SUSPENDED" || to === "REJECTED") return true;
  return from === "VERIFIED" && to !== "VERIFIED";
}

export async function invalidateMarketplaceCheckoutsForOrderRecord(order, opts = {}) {
  const results = [];
  results.push(await invalidateMarketplaceCheckoutForOrder(order, opts));
  const offers = await AlternativeVehicleOffer.find({
    orderId: order._id,
    $or: [
      { checkoutUrl: { $exists: true, $nin: [null, ""] } },
      { stripeSessionId: { $exists: true, $nin: [null, ""] } },
      { complianceInvalidateRetry: true },
    ],
  });
  for (const offer of offers) {
    results.push(
      await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
        ...opts,
        order,
      })
    );
  }
  return results;
}

function summarizeRetryResults(results) {
  return {
    processed: results.length,
    invalidated: results.filter((row) => row.invalidated).length,
    skippedPaid: results.filter((row) => row.skippedPaid || row.reason === "stripe_paid").length,
    stillRetryable: results.filter((row) => row.retryable && row.ok === false).length,
    failed: results.filter((row) => row.ok === false).length,
  };
}

/**
 * Bounded retry of records explicitly marked complianceInvalidateRetry.
 */
export async function retryMarketplaceCheckoutInvalidations({
  limit = CHECKOUT_INVALIDATION_RETRY.BATCH_LIMIT,
  trigger = "cron",
  now = new Date(),
  ignoreRetryAt = false,
  actorEmail = "",
  actorRole = "system",
} = {}) {
  await connectToDB();
  const batchSize = clampInvalidationRetryBatchSize(limit);
  const due = ignoreRetryAt
    ? {}
    : {
        $or: [
          { "payment.complianceInvalidateRetryAt": { $lte: now } },
          { "payment.complianceInvalidateRetryAt": null },
          { "payment.complianceInvalidateRetryAt": { $exists: false } },
        ],
      };

  const orders = await Order.find({
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    "payment.complianceInvalidateRetry": true,
    ...due,
  }).limit(batchSize);

  const remaining = Math.max(0, batchSize - orders.length);
  const offerDue = ignoreRetryAt
    ? {}
    : {
        $or: [
          { complianceInvalidateRetryAt: { $lte: now } },
          { complianceInvalidateRetryAt: null },
          { complianceInvalidateRetryAt: { $exists: false } },
        ],
      };
  const offers =
    remaining > 0
      ? await AlternativeVehicleOffer.find({
          complianceInvalidateRetry: true,
          ...offerDue,
        }).limit(remaining)
      : [];

  const results = [];
  for (const order of orders) {
    try {
      results.push(
        await invalidateMarketplaceCheckoutForOrder(order, {
          reason: order.payment?.invalidatedReason || CHECKOUT_INVALIDATION_REASON.PROFILE_NOT_VERIFIED,
          actorEmail,
          actorRole,
          now,
          ignoreRetryAt,
        })
      );
    } catch (err) {
      results.push({
        ok: false,
        retryable: true,
        code: INVALIDATION_ERROR_CATEGORY.UNKNOWN,
        error: sanitizeInvalidationError(err?.message || err),
      });
    }
  }
  for (const offer of offers) {
    try {
      results.push(
        await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
          reason: offer.invalidatedReason || CHECKOUT_INVALIDATION_REASON.PROFILE_NOT_VERIFIED,
          actorEmail,
          actorRole,
          now,
          ignoreRetryAt,
        })
      );
    } catch (err) {
      results.push({
        ok: false,
        retryable: true,
        code: INVALIDATION_ERROR_CATEGORY.UNKNOWN,
        error: sanitizeInvalidationError(err?.message || err),
      });
    }
  }

  const summary = summarizeRetryResults(results);
  await recordAuditEvent({
    action: "RENTAL_CHECKOUT_INVALIDATE_RETRY",
    userRole: actorRole === "superadmin" ? "superadmin" : "system",
    userEmail: actorEmail,
    severity: "medium",
    metadata: { trigger, ...summary },
  });
  return { ok: true, trigger, ...summary };
}

export function buildCheckoutInvalidationView(order, offer = null) {
  const pay = order?.payment && typeof order.payment === "object" ? order.payment : {};
  const offerPending = Boolean(offer?.complianceInvalidateRetry);
  const orderPending = Boolean(pay.complianceInvalidateRetry);
  const pending = orderPending || offerPending;
  const sessionType = offerPending && !orderPending
    ? CHECKOUT_SESSION_KIND.ALTERNATIVE_OFFER
    : CHECKOUT_SESSION_KIND.BOOKING;
  return {
    pending,
    lastAttemptAt:
      offerPending && offer?.lastInvalidateAttemptAt
        ? offer.lastInvalidateAttemptAt
        : pay.lastInvalidateAttemptAt || null,
    attemptCount: Math.max(
      Number(pay.complianceInvalidateAttempts || 0),
      Number(offer?.complianceInvalidateAttempts || 0)
    ),
    lastErrorCategory:
      (offerPending && offer?.lastInvalidateErrorCategory) ||
      pay.lastInvalidateErrorCategory ||
      "",
    sessionType,
    canRetry: pending,
  };
}

export async function retryCheckoutInvalidationForOrder(order, opts = {}) {
  const offer = await AlternativeVehicleOffer.findOne({
    orderId: order._id,
    complianceInvalidateRetry: true,
  });
  const results = [];
  if (order.payment?.complianceInvalidateRetry) {
    results.push(
      await invalidateMarketplaceCheckoutForOrder(order, {
        ...opts,
        ignoreRetryAt: true,
      })
    );
  }
  if (offer) {
    results.push(
      await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
        ...opts,
        order,
        ignoreRetryAt: true,
      })
    );
  }
  if (!results.length) {
    if (order.payment?.providerPaymentId || order.payment?.checkoutUrl) {
      results.push(
        await invalidateMarketplaceCheckoutForOrder(order, {
          ...opts,
          ignoreRetryAt: true,
        })
      );
    }
    const openOffer = await AlternativeVehicleOffer.findOne({
      orderId: order._id,
      $or: [
        { checkoutUrl: { $nin: [null, ""] } },
        { stripeSessionId: { $nin: [null, ""] } },
      ],
    });
    if (openOffer) {
      results.push(
        await invalidateMarketplaceCheckoutForAlternativeOffer(openOffer, {
          ...opts,
          order,
          ignoreRetryAt: true,
        })
      );
    }
  }
  return summarizeRetryResults(results);
}
