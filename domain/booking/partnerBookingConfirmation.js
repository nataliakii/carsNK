/**
 * Partner availability confirmation — the legally significant act by which a
 * supplier commits to a booking.
 *
 * Safety properties:
 *   - opening the link (GET) never changes anything; it only renders a view
 *   - the confirmation itself is a POST that consumes a one-time token
 *   - consumption is a single atomic findOneAndUpdate, so a double submit or
 *     a replayed link resolves to the same result instead of confirming twice
 *   - every step is audit-logged, and an audit failure never rolls back the
 *     business operation
 *   - all money shown and stored is recomputed server-side; nothing is taken
 *     from the request
 */

import { Order } from "@models/order";
import Company from "@models/company";
import { Car } from "@models/car";
import BookingConfirmationToken from "@models/BookingConfirmationToken";
import ConfirmedBookingSnapshot from "@models/ConfirmedBookingSnapshot";
import { connectToDB } from "@lib/database";

import {
  signConfirmationToken,
  verifyConfirmationToken,
  hashConfirmationToken,
} from "./partnerConfirmationToken";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import {
  notifyBookingAccepted,
  notifyBookingDeclined,
} from "@/domain/mail/notificationPolicy";
import {
  normalizePartnerDeclineReason,
  PARTNER_DECLINE_REASON,
} from "@/domain/mail/partnerDeclinePolicy";
import { absoluteUrl } from "@config/domain";
import { loadLegalSettings } from "@/domain/legal/legalSettingsService";
import { getAgreementVersionRef } from "@/domain/legal/agreementService";
import { computeSnapshotChecksum } from "@/domain/legal/checksum";
import { resolveDocumentForDisplay } from "@/domain/legal/documentService";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import { marketplaceFinancialSplit } from "@/domain/orders/marketplaceFinancialSplit";
import {
  applyRentalStateTransition,
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  acquireMarketplaceHold,
  attachStripeSessionToHold,
  markHoldForRetry,
  releaseMarketplaceHold,
} from "@/domain/booking/bookingHold";
import {
  clampStripeExpiresMinutes,
  createRentalCheckoutSession,
  expireRentalCheckoutSession,
} from "@/domain/orders/rentalStripeCheckout";
import { computePriceSnapshotChecksum } from "@/domain/orders/priceSnapshotChecksum";
import {
  sendCustomerDeclineEmail,
  sendCustomerPaymentRequestEmail,
} from "@/domain/orders/marketplaceBookingEmails";
import {
  AVAILABILITY_PURPOSE,
  evaluateRentalAvailability,
} from "@/domain/booking/availabilityEngine";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import {
  assertPartnerCanOperate,
  auditPartnerComplianceBlock,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";

/**
 * Exact wording the partner must accept. Stored verbatim on the snapshot so
 * the record shows what was agreed, not a later revision of the wording.
 */
export function partnerConfirmationStatement() {
  return "I confirm this car is available.";
}

export const PARTNER_CONFIRMATION_STATEMENT = partnerConfirmationStatement(1000);

export const PARTNER_CONFIRMATION_BUTTON_LABEL = "Confirm availability";

/**
 * Issue a fresh one-time confirmation link for an order.
 *
 * @param {{ orderId: string, issuedByEmail?: string, ttlHours?: number }} params
 */
export async function issueConfirmationToken({
  orderId,
  issuedByEmail = "",
  ttlHours,
}) {
  await connectToDB();
  const order = await Order.findById(orderId).select("ownerId").lean();
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Order not found" };
  }

  const settings = await loadLegalSettings();
  const hours = Number(ttlHours) > 0
    ? Number(ttlHours)
    : settings.confirmationTokenExpirationHours;

  const signed = signConfirmationToken({
    orderId: String(orderId),
    companyId: order.ownerId ? String(order.ownerId) : null,
    ttlHours: hours,
  });

  const agreementRef = order.ownerId
    ? await getAgreementVersionRef(order.ownerId).catch(() => null)
    : null;

  await BookingConfirmationToken.create({
    tokenHash: signed.tokenHash,
    jti: signed.jti,
    orderId,
    companyId: order.ownerId || null,
    expiresAt: signed.expiresAt,
    issuedByEmail,
    agreementRef,
  });

  return {
    ok: true,
    token: signed.token,
    jti: signed.jti,
    expiresAt: signed.expiresAt,
  };
}

function minor(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Server-authoritative money for the confirmation page.
 * Derives the prepayment from the stored authoritative price; never trusts a
 * client-supplied total.
 *
 * @param {object} order
 */
export function resolveConfirmationFinancials(order) {
  const auth = order?.authoritativePrice || {};
  let grossMinor = minor(auth.grossMinor);
  if (!grossMinor) {
    const fallbackMajor = Number(
      order?.OverridePrice != null ? order.OverridePrice : order?.totalPrice
    );
    grossMinor = Number.isFinite(fallbackMajor)
      ? Math.round(fallbackMajor * 100)
      : 0;
  }

  const split = marketplaceFinancialSplit({
    ...auth,
    grossMinor,
    currency: auth.currency || order?.currency || "EUR",
  });

  return {
    currency: split.currency,
    grossMinor: split.grossMinor,
    marketplaceBookingFeeBps: split.marketplaceBookingFeeBps,
    prepaymentPercent: split.prepaymentPercent,
    feePercent: split.feePercent,
    prepaymentMinor: split.prepaymentMinor,
    balanceMinor: split.balanceMinor,
    supplierBalancePercent: split.supplierBalancePercent,
    platformAmountMinor: split.platformAmountMinor,
    stripeAmountMinor: split.stripeAmountMinor,
    supplierBalanceMinor: split.supplierBalanceMinor,
    payoutMinor: split.payoutMinor,
  };
}

/**
 * Everything the partner must see before the button, per the Partner
 * Agreement: booking id, vehicle, dates, pickup/return, full price, booking
 * prepayment, balance due to the Supplier, deposit, insurance, extras,
 * cancellation rules and the applicable agreement version.
 *
 * Read-only. Safe to call from GET.
 *
 * @param {string} token
 */
export async function buildConfirmationView(token) {
  const parsed = verifyConfirmationToken(token);
  if (!parsed.ok) return parsed;

  await connectToDB();

  const record = await BookingConfirmationToken.findOne({
    tokenHash: hashConfirmationToken(token),
  }).lean();
  if (!record) {
    return {
      ok: false,
      status: 400,
      code: "unknown_token",
      message: "This confirmation link is not recognised",
    };
  }

  const order = await Order.findById(parsed.orderId).lean();
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Booking not found" };
  }

  const [company, car, settings] = await Promise.all([
    order.ownerId
      ? Company.findById(order.ownerId).select("name email").lean()
      : null,
    order.car
      ? Car.findById(order.car)
          .select("model carNumber regNumber transmission numberOfSeats photos franchise deposit class")
          .lean()
      : null,
    loadLegalSettings(),
  ]);

  const financials = resolveConfirmationFinancials(order);
  const statement = partnerConfirmationStatement(
    financials.marketplaceBookingFeeBps
  );

  const { doc: partnerAgreementDoc } = await resolveDocumentForDisplay({
    documentType: LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT,
    language: "en",
  }).catch(() => ({ doc: null }));

  return {
    ok: true,
    alreadyConsumed: Boolean(record.consumedAt),
    decision: record.decision || null,
    expiresAt: record.expiresAt,
    statement,
    buttonLabel: PARTNER_CONFIRMATION_BUTTON_LABEL,
    booking: {
      bookingId: String(order._id),
      orderNumber: order.orderNumber || "",
      ownerId: order.ownerId ? String(order.ownerId) : "",
      bookingMode: order.bookingMode || "",
      supplierName: company?.name || "",
      vehicle: {
        model: order.carModel || car?.model || "",
        regNumber: order.regNumber || car?.regNumber || "",
        category: car?.class || "",
        transmission: car?.transmission || "",
        seats: car?.numberOfSeats ?? null,
      },
      pickup: {
        atUtc: order.pickupAtUtc || order.timeIn || order.rentalStartDate,
        place: order.placeIn || "",
        detail: order.placeInDetail || "",
      },
      dropoff: {
        atUtc: order.returnAtUtc || order.timeOut || order.rentalEndDate,
        place: order.placeOut || "",
        detail: order.placeOutDetail || "",
      },
      timezone: order.timezone || "",
      numberOfDays: order.numberOfDays ?? null,
      insurance: order.insurance || "",
      extras: {
        childSeats: order.ChildSeats ?? 0,
        secondDriver: Boolean(order.secondDriver),
      },
      /** Vehicle security deposit — collected by the Supplier, separate from
       *  the non-refundable Rovaro Booking Fee. */
      securityDeposit: car?.deposit ?? order.franchiseOrder ?? null,
      financials,
    },
    cancellationRules: {
      supplierCancellationServiceCharge:
        settings.supplierCancellationServiceCharge,
      replacementCostDifferenceCap: settings.replacementCostDifferenceCap,
      replacementNotificationHours: settings.replacementNotificationHours,
      currency: settings.commissionCurrency,
    },
    agreement: {
      applicableVersion: record.agreementRef || null,
      partnerAgreementVersion: partnerAgreementDoc
        ? {
            version: partnerAgreementDoc.version,
            checksum: partnerAgreementDoc.checksum,
            language: partnerAgreementDoc.language,
          }
        : null,
    },
  };
}

/**
 * Consume the token and record the decision.
 *
 * Idempotent: a second POST with the same token returns the first result with
 * `idempotent: true` rather than confirming again.
 *
 * @param {{
 *   token: string,
 *   decision: "accepted"|"declined",
 *   accepted: boolean,
 *   ipAddress?: string,
 *   userAgent?: string,
 *   actorEmail?: string,
 *   reason?: string,
 * }} params
 */
const CANCELLED_STATUSES = new Set([
  BOOKING_STATUS.CUSTOMER_CANCELLED,
  BOOKING_STATUS.SUPPLIER_CANCELLED,
  BOOKING_STATUS.ADMIN_CANCELLED,
]);

export function evaluatePartnerDecisionGuards(order, { tokenCompanyId, decision } = {}) {
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Booking not found" };
  }

  const status = String(order.bookingStatus || "");
  const rental = resolveRentalState(order);
  const paid = order.payment?.status === "paid" || rental === RENTAL_STATE.CONFIRMED;

  if (paid) {
    return {
      ok: false,
      status: 409,
      code: "already_paid",
      message: "This booking is already paid and cannot be changed.",
    };
  }

  if (
    rental === RENTAL_STATE.DECLINED ||
    status === BOOKING_STATUS.SUPPLIER_DECLINED
  ) {
    if (decision === "declined") {
      return { ok: true, idempotentDecline: true };
    }
    return {
      ok: false,
      status: 409,
      code: "already_declined",
      message: "This booking was already declined and cannot be confirmed.",
    };
  }

  if (CANCELLED_STATUSES.has(status) || rental === RENTAL_STATE.CANCELLED) {
    return {
      ok: false,
      status: 409,
      code: "cancelled",
      message: "This booking was cancelled.",
    };
  }

  if (
    rental !== RENTAL_STATE.REQUESTED &&
    rental !== RENTAL_STATE.PARTNER_CONFIRMED &&
    rental !== RENTAL_STATE.PAYMENT_PENDING &&
    rental !== RENTAL_STATE.PAYMENT_EXPIRED
  ) {
    return {
      ok: false,
      status: 409,
      code: "not_pending",
      message: "This booking is not waiting for a partner decision.",
    };
  }

  if (decision === "accepted" && rental === RENTAL_STATE.PAYMENT_EXPIRED) {
    return {
      ok: false,
      status: 409,
      code: "payment_expired",
      message: "The previous payment link expired. Ask Rovaro to issue a new one.",
    };
  }

  if (decision === "accepted" && rental === RENTAL_STATE.PAYMENT_PENDING) {
    return { ok: true, alreadyPaymentPending: true };
  }

  if (decision === "accepted" && rental !== RENTAL_STATE.REQUESTED && rental !== RENTAL_STATE.PARTNER_CONFIRMED) {
    return {
      ok: false,
      status: 409,
      code: "not_pending",
      message: "This booking is not waiting for a partner confirmation.",
    };
  }

  const orderCompany = order.ownerId ? String(order.ownerId) : "";
  const tokenCompany = tokenCompanyId ? String(tokenCompanyId) : "";
  if (tokenCompany && orderCompany && tokenCompany !== orderCompany) {
    return {
      ok: false,
      status: 403,
      code: "wrong_company",
      message: "This confirmation link does not belong to the car owner.",
    };
  }

  return { ok: true };
}

async function notifyPartnerDecision(order, decision, actorEmail, declineCtx = {}) {
  try {
    const companyId = order.ownerId ? String(order.ownerId) : "";
    let companyName = "";
    if (companyId) {
      const company = await Company.findById(companyId).select("name").lean();
      companyName = company?.name || "";
    }
    if (decision === "accepted") {
      await notifyBookingAccepted({
        orderId: String(order._id),
        companyId,
        companyName,
        orderNumber: order.orderNumber,
        actorEmail,
        status: order.bookingStatus || "accepted",
        timestamp: new Date(),
      });
      return;
    }
    await notifyBookingDeclined({
      orderId: String(order._id),
      companyId,
      companyName,
      orderNumber: order.orderNumber,
      customerName: order.customerName || "",
      actorEmail,
      reasonCode: declineCtx.reasonCode,
      explanation: declineCtx.explanation,
      reason: declineCtx.reason || order.declineReason || "",
      feePaid: Boolean(declineCtx.feePaid),
      feeFormatted: declineCtx.feeFormatted || "",
      alternativeAvailable: declineCtx.alternativeAvailable,
      bookingAlreadyAccepted: Boolean(declineCtx.bookingAlreadyAccepted),
      status: order.bookingStatus || "declined",
      timestamp: new Date(),
    });
  } catch (err) {
    console.error(
      "[partner-confirm] decision notify failed:",
      err?.message || err
    );
  }
}

async function finalizePartnerAccept({
  order,
  consumed,
  ipAddress,
  userAgent,
  actorEmail,
}) {
  const now = new Date();
  const settings = await loadLegalSettings().catch(() => ({
    paymentLinkExpirationMinutes: 60,
  }));
  const expireMinutes = clampStripeExpiresMinutes(
    settings.paymentLinkExpirationMinutes
  );
  const holdExpiresAt = new Date(now.getTime() + expireMinutes * 60 * 1000);
  const priceChecksum = computePriceSnapshotChecksum(order);

  const toConfirmed = applyRentalStateTransition(
    order,
    RENTAL_STATE.PARTNER_CONFIRMED
  );
  if (!toConfirmed.ok && resolveRentalState(order) !== RENTAL_STATE.PARTNER_CONFIRMED) {
    return {
      ok: false,
      status: 409,
      code: toConfirmed.code || "illegal_transition",
      message: "This booking cannot be confirmed in its current state.",
    };
  }

  const hold = await acquireMarketplaceHold({
    carId: order.car,
    orderId: order._id,
    companyId: order.ownerId,
    pickupAtUtc: order.pickupAtUtc || order.timeIn,
    returnAtUtc: order.returnAtUtc || order.timeOut,
    holdExpiresAt,
    timezone: order.timezone,
    bookingMode: order.bookingMode,
  });

  if (!hold.ok) {
    await recordAuditEvent({
      action: "BOOKING_HOLD_CONFLICT",
      severity: "high",
      result: "failure",
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { code: hold.code, message: hold.message },
    });
    return {
      ok: false,
      status: 409,
      code: hold.code,
      message: hold.message,
    };
  }

  const checkout = await createRentalCheckoutSession(String(order._id), {
    company: order.ownerId
      ? await Company.findById(order.ownerId)
          .select("name email rentalPayments prepaymentPercent")
          .lean()
      : null,
    emailCustomer: false,
  });

  if (!checkout.ok || !checkout.url) {
    await markHoldForRetry(order._id, { reason: checkout.code || "checkout_failed" });
    await recordAuditEvent({
      action: "RENTAL_CHECKOUT_FAILED",
      severity: "critical",
      result: "failure",
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { code: checkout.code, message: checkout.message },
    });
    try {
      await notifySuperadmin({
        title: `⚠️ Checkout failed after partner confirm — order #${order.orderNumber || order._id}`,
        bodyLines: [
          checkout.message || checkout.code || "Checkout failed",
          "No payment email was sent. Hold marked for retry.",
        ],
        meta: { orderId: order._id },
      });
    } catch (err) {
      console.error("[partner-confirm] checkout fail notify", err?.message || err);
    }
    return {
      ok: false,
      status: 502,
      code: checkout.code || "checkout_failed",
      message:
        "Availability was recorded but the payment link could not be created. Rovaro has been notified.",
    };
  }

  const reloaded = await Order.findById(order._id);
  if (resolveRentalState(reloaded) === RENTAL_STATE.REQUESTED) {
    applyRentalStateTransition(reloaded, RENTAL_STATE.PARTNER_CONFIRMED);
  }
  applyRentalStateTransition(reloaded, RENTAL_STATE.PAYMENT_PENDING);
  reloaded.companyEmailDecision = "accepted";
  reloaded.companyEmailDecisionAt = now;
  reloaded.partnerConfirmedAt = now;
  reloaded.partnerConfirmedByEmail = actorEmail || "";
  reloaded.set(
    "partnerConfirmMeta",
    {
      jti: consumed.jti,
      ipAddress,
      userAgent,
      companyId: reloaded.ownerId ? String(reloaded.ownerId) : "",
      agreementVersion: consumed.agreementRef || null,
      priceChecksum,
    },
    { strict: false }
  );
  await reloaded.save();
  await attachStripeSessionToHold(reloaded._id, checkout.sessionId);

  const mailed = await sendCustomerPaymentRequestEmail({
    order: reloaded.toObject(),
    paymentUrl: checkout.url,
    expiresAt: checkout.expiresAt,
    stripeSessionId: checkout.sessionId,
  });
  if (!mailed.ok && !mailed.deduped) {
    console.error("[partner-confirm] payment email failed", mailed);
  }

  await recordAuditEvent({
    action: "BOOKING_PARTNER_CONFIRMED",
    userRole: "admin",
    userEmail: actorEmail,
    severity: "critical",
    ipAddress,
    userAgent,
    orderData: {
      orderId: reloaded._id,
      orderNumber: reloaded.orderNumber,
      carModel: reloaded.carModel,
      rentalStartDate: reloaded.rentalStartDate,
      rentalEndDate: reloaded.rentalEndDate,
    },
    metadata: {
      jti: consumed.jti,
      statement: partnerConfirmationStatement(
        resolveConfirmationFinancials(reloaded).marketplaceBookingFeeBps
      ),
      agreementRef: consumed.agreementRef,
      priceChecksum,
      sessionId: checkout.sessionId,
      reusedCheckout: Boolean(checkout.reused),
    },
  });

  await notifyPartnerDecision(reloaded, "accepted", actorEmail);

  return {
    ok: true,
    idempotent: Boolean(checkout.reused),
    decision: "accepted",
    orderId: String(reloaded._id),
    bookingStatus: reloaded.bookingStatus,
    paymentUrl: checkout.url,
    message: "Availability confirmed. The customer will receive a payment link.",
  };
}

async function finalizePartnerDecline({
  order,
  consumed,
  ipAddress,
  userAgent,
  actorEmail,
  reason,
  reasonCode = "",
  explanation = "",
}) {
  const now = new Date();
  if (
    order.bookingStatus === BOOKING_STATUS.SUPPLIER_DECLINED &&
    order.companyEmailDecision === "rejected"
  ) {
    return {
      ok: true,
      idempotent: true,
      decision: "declined",
      orderId: String(order._id),
      bookingStatus: order.bookingStatus,
      message: "This booking was already declined.",
    };
  }

  const normalized = normalizePartnerDeclineReason(
    reasonCode || reason,
    explanation || (reasonCode ? "" : reason)
  );
  let resolvedCode;
  let resolvedExplanation;
  if (normalized.ok) {
    resolvedCode = normalized.code;
    resolvedExplanation = normalized.explanation;
  } else {
    // Legacy free-text declines map to OTHER when an explanation is present.
    const note = String(explanation || reason || "").trim().slice(0, 1000);
    if (!note) {
      return {
        ok: false,
        status: 400,
        code: normalized.code || "invalid_decline_reason",
        message:
          normalized.message ||
          "A structured decline reason is required.",
      };
    }
    resolvedCode = PARTNER_DECLINE_REASON.OTHER;
    resolvedExplanation = note;
  }

  const moved = applyRentalStateTransition(order, RENTAL_STATE.DECLINED);
  if (!moved.ok) {
    order.bookingStatus = BOOKING_STATUS.SUPPLIER_DECLINED;
  }
  order.companyEmailDecision = "rejected";
  order.companyEmailDecisionAt = now;
  order.declineReason = resolvedExplanation || resolvedCode;
  order.declinedAt = now;
  order.declinedByEmail = actorEmail || "";
  order.set(
    "declineMeta",
    {
      jti: consumed?.jti,
      ipAddress,
      userAgent,
      reasonCode: resolvedCode,
      explanation: resolvedExplanation,
      autoRefund: false,
    },
    { strict: false }
  );
  const payment = {
    ...(order.payment && typeof order.payment === "object" ? order.payment : {}),
    checkoutUrl: "",
  };
  order.set("payment", payment, { strict: false });
  await order.save();

  await expireRentalCheckoutSession(order._id);
  await releaseMarketplaceHold(order._id, { reason: "supplier_declined" });
  await sendCustomerDeclineEmail({
    order: order.toObject ? order.toObject() : order,
    reason: resolvedExplanation || resolvedCode,
  });

  await recordAuditEvent({
    action: "BOOKING_PARTNER_DECLINED",
    userRole: "admin",
    userEmail: actorEmail,
    severity: "critical",
    ipAddress,
    userAgent,
    reason: resolvedExplanation || resolvedCode,
    orderData: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      carModel: order.carModel,
      rentalStartDate: order.rentalStartDate,
      rentalEndDate: order.rentalEndDate,
    },
    metadata: {
      jti: consumed?.jti,
      reasonCode: resolvedCode,
      autoRefund: false,
    },
  });
  await notifyPartnerDecision(order, "declined", actorEmail, {
    reasonCode: resolvedCode,
    explanation: resolvedExplanation,
    reason: resolvedExplanation || resolvedCode,
    feePaid: String(order.payment?.status || "").toLowerCase() === "paid",
    bookingAlreadyAccepted: Boolean(order.partnerConfirmedAt),
  });

  return {
    ok: true,
    idempotent: false,
    decision: "declined",
    orderId: String(order._id),
    bookingStatus: order.bookingStatus,
    refundRequired: false,
    refunded: false,
    autoRefund: false,
    message:
      "Booking declined. Rovaro will inform the customer.",
  };
}

export async function consumeConfirmationToken({
  token,
  decision,
  accepted,
  ipAddress = "",
  userAgent = "",
  actorEmail = "",
  reason = "",
  reasonCode = "",
  explanation = "",
  complianceOverrideReason = "",
  complianceOverrideRole = "",
}) {
  const parsed = verifyConfirmationToken(token);
  if (!parsed.ok) return parsed;

  if (decision === "accepted" && !accepted) {
    return {
      ok: false,
      status: 400,
      code: "checkbox_required",
      message: "You must tick the confirmation checkbox before confirming availability",
    };
  }

  await connectToDB();
  const tokenHash = hashConfirmationToken(token);
  const now = new Date();

  const existing = await BookingConfirmationToken.findOne({ tokenHash });
  if (!existing) {
    return {
      ok: false,
      status: 400,
      code: "unknown_token",
      message: "This confirmation link is not recognised",
    };
  }
  if (!existing.consumedAt && existing.expiresAt <= now) {
    return {
      ok: false,
      status: 410,
      code: "expired",
      message: "This confirmation link has expired. Ask Rovaro for a new one.",
    };
  }

  const order = await Order.findById(existing.orderId);
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Booking not found" };
  }

  const guards = evaluatePartnerDecisionGuards(order, {
    tokenCompanyId: parsed.companyId || existing.companyId,
    decision,
  });
  if (!guards.ok) return guards;

  if (guards.alreadyPaymentPending && decision === "accepted") {
    if (order.payment?.checkoutUrl) {
      return {
        ok: true,
        idempotent: true,
        decision: "accepted",
        orderId: String(order._id),
        bookingStatus: order.bookingStatus,
        paymentUrl: order.payment.checkoutUrl,
        message: "This booking was already confirmed.",
      };
    }
  }

  const needsCheckoutRetry =
    decision === "accepted" &&
    existing.consumedAt &&
    existing.decision === "accepted" &&
    !order.payment?.checkoutUrl &&
    order.payment?.status !== "paid";

  if (guards.idempotentDecline) {
    return {
      ok: true,
      idempotent: true,
      decision: "declined",
      orderId: String(order._id),
      bookingStatus: order.bookingStatus,
      message: "This booking was already declined.",
    };
  }

  if (decision === "accepted" && isMarketplaceRequestMode(order.bookingMode)) {
    const confirmGate = await assertPartnerCanOperate(order.ownerId, {
      purpose: PARTNER_OPERATION_PURPOSE.CONFIRM,
      overrideReason: complianceOverrideReason,
      overrideByRole: complianceOverrideRole,
      overrideByEmail: actorEmail,
      audit: { orderId: order._id, ipAddress, userAgent },
    });
    if (!confirmGate.allowed) {
      await auditPartnerComplianceBlock({
        purpose: PARTNER_OPERATION_PURPOSE.CONFIRM,
        result: confirmGate,
        actorEmail,
        actorRole: "admin",
        ipAddress,
        userAgent,
        orderId: order._id,
      });
      return {
        ok: false,
        status: 403,
        error: confirmGate.error,
        code: confirmGate.code,
        message: confirmGate.partnerMessage,
      };
    }
  }

  if (decision === "accepted") {
    const { assertLocationSnapshotForConfirm } = await import(
      "@/domain/orders/locationSnapshot"
    );
    const snapCheck = assertLocationSnapshotForConfirm(order);
    if (!snapCheck.ok) {
      return {
        ok: false,
        status: 409,
        code: snapCheck.code,
        message: snapCheck.message,
      };
    }
    const { assertAuthoritativePriceReconciled, logPriceBreakdownMismatch, PRICE_BREAKDOWN_CUSTOMER_MESSAGE, PRICE_BREAKDOWN_MISMATCH } = await import(
      "@/domain/orders/priceBreakdownReconciliation"
    );
    const priceCheck = assertAuthoritativePriceReconciled(order);
    if (!priceCheck.ok) {
      logPriceBreakdownMismatch({
        orderId: order._id,
        companyId: order.ownerId,
        breakdown: priceCheck.breakdown,
        stage: "partner_confirm",
      });
      return {
        ok: false,
        status: 409,
        code: PRICE_BREAKDOWN_MISMATCH,
        message: PRICE_BREAKDOWN_CUSTOMER_MESSAGE,
      };
    }
  }

  if (decision === "accepted" && isMarketplaceRequestMode(order.bookingMode)) {
    const orderQuery = Order.find({ car: order.car });
    const existingOrders =
      typeof orderQuery.lean === "function"
        ? await orderQuery.lean()
        : await orderQuery;
    const availability = evaluateRentalAvailability({
      carId: order.car,
      pickupAtUtc: order.pickupAtUtc || order.timeIn,
      returnAtUtc: order.returnAtUtc || order.timeOut,
      timezone: order.timezone,
      existingOrders,
      excludeOrderId: String(order._id),
      purpose: AVAILABILITY_PURPOSE.CONFIRM,
      bookingMode: order.bookingMode,
    });
    if (availability.hardConflict) {
      return {
        ok: false,
        status: 409,
        code: "date_conflict",
        message: availability.userSafeReason || "Those dates are not available.",
      };
    }
  }

  const consumed = await BookingConfirmationToken.findOneAndUpdate(
    { tokenHash, consumedAt: null, expiresAt: { $gt: now } },
    {
      $set: {
        consumedAt: now,
        decision,
        consumedIp: ipAddress,
        consumedUserAgent: userAgent,
      },
    },
    { new: true }
  );

  if (!consumed) {
    if (needsCheckoutRetry) {
      return finalizePartnerAccept({
        order,
        consumed: existing,
        ipAddress,
        userAgent,
        actorEmail,
      });
    }

    await BookingConfirmationToken.updateOne(
      { tokenHash },
      { $inc: { replayAttempts: 1 }, $set: { lastReplayAt: now } }
    ).catch(() => {});

    await recordAuditEvent({
      action: "BOOKING_CONFIRMATION_TOKEN_REPLAY",
      severity: "high",
      ipAddress,
      userAgent,
      orderData: { orderId: existing.orderId },
      metadata: { jti: existing.jti, priorDecision: existing.decision },
    });

    const latest = await Order.findById(existing.orderId);
    if (existing.decision === "accepted") {
      return {
        ok: true,
        idempotent: true,
        decision: "accepted",
        orderId: String(existing.orderId),
        bookingStatus: latest?.bookingStatus,
        paymentUrl: latest?.payment?.checkoutUrl || "",
        message: "This booking was already confirmed.",
      };
    }
    return {
      ok: true,
      idempotent: true,
      decision: existing.decision,
      orderId: String(existing.orderId),
      bookingStatus: latest?.bookingStatus,
      message: "This booking was already declined.",
    };
  }

  if (isMarketplaceRequestMode(order.bookingMode)) {
    if (decision === "accepted") {
      return finalizePartnerAccept({
        order,
        consumed,
        ipAddress,
        userAgent,
        actorEmail,
      });
    }
    return finalizePartnerDecline({
      order,
      consumed,
      ipAddress,
      userAgent,
      actorEmail,
      reason,
      reasonCode,
      explanation,
    });
  }

  if (decision === "accepted") {
    order.companyEmailDecision = "accepted";
    order.companyEmailDecisionAt = now;
    order.bookingStatus = BOOKING_STATUS.CONFIRMED_AWAITING_PAYMENT;
  } else {
    order.companyEmailDecision = "rejected";
    order.companyEmailDecisionAt = now;
    order.bookingStatus = BOOKING_STATUS.SUPPLIER_DECLINED;
    order.declineReason = String(reason || "").slice(0, 500);
    order.declinedAt = now;
  }
  await order.save();

  await recordAuditEvent({
    action:
      decision === "accepted"
        ? "BOOKING_PARTNER_CONFIRMED"
        : "BOOKING_PARTNER_DECLINED",
    userRole: "admin",
    userEmail: actorEmail,
    severity: "critical",
    ipAddress,
    userAgent,
    reason,
    orderData: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      carModel: order.carModel,
      rentalStartDate: order.rentalStartDate,
      rentalEndDate: order.rentalEndDate,
    },
    metadata: { jti: consumed.jti },
  });
  await notifyPartnerDecision(order, decision, actorEmail);

  return {
    ok: true,
    idempotent: false,
    decision,
    orderId: String(order._id),
    bookingStatus: order.bookingStatus,
    message:
      decision === "accepted"
        ? "Availability confirmed. The booking is confirmed once the customer pays."
        : "Booking declined. Rovaro will inform the customer.",
  };
}

/**
 * Create the immutable ConfirmedBookingSnapshot once the customer's
 * prepayment has succeeded. Idempotent per (orderId, sequence).
 *
 * @param {{ orderId: string, reason?: string }} params
 */
export async function createConfirmedBookingSnapshot({
  orderId,
  reason = "initial_confirmation",
}) {
  await connectToDB();

  const order = await Order.findById(orderId).lean();
  if (!order) {
    return { ok: false, code: "not_found", message: "Order not found" };
  }

  const existingCount = await ConfirmedBookingSnapshot.countDocuments({ orderId });
  if (existingCount > 0 && reason === "initial_confirmation") {
    const existing = await ConfirmedBookingSnapshot.findOne({ orderId, sequence: 1 }).lean();
    return { ok: true, idempotent: true, snapshot: existing };
  }
  const sequence = existingCount + 1;

  const [car, settings, confirmationToken] = await Promise.all([
    order.car
      ? Car.findById(order.car)
          .select("model regNumber class transmission numberOfSeats photos deposit")
          .lean()
      : null,
    loadLegalSettings(),
    BookingConfirmationToken.findOne({
      orderId,
      decision: "accepted",
    })
      .sort({ consumedAt: -1 })
      .lean(),
  ]);

  const financials = resolveConfirmationFinancials(order);
  const agreementRef = order.ownerId
    ? await getAgreementVersionRef(order.ownerId).catch(() => null)
    : null;

  const { doc: bookingTerms } = await resolveDocumentForDisplay({
    documentType: LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS,
    language: order.clientLang || "en",
  }).catch(() => ({ doc: null }));

  const payload = {
    orderId,
    orderNumber: order.orderNumber || "",
    companyId: order.ownerId || null,
    sequence,
    reason,
    vehicle: {
      carId: order.car ? String(order.car) : "",
      model: order.carModel || car?.model || "",
      regNumber: order.regNumber || car?.regNumber || "",
      category: car?.class || "",
      transmission: car?.transmission || "",
      seats: car?.numberOfSeats ?? null,
      photos: Array.isArray(car?.photos) ? car.photos.slice(0, 6) : [],
    },
    schedule: {
      pickupAtUtc: order.pickupAtUtc || order.timeIn || order.rentalStartDate || null,
      returnAtUtc: order.returnAtUtc || order.timeOut || order.rentalEndDate || null,
      timezone: order.timezone || "",
      placeIn: order.placeIn || "",
      placeOut: order.placeOut || "",
    },
    financials: {
      currency: financials.currency,
      grossMinor: financials.grossMinor,
      marketplaceBookingFeeBps: financials.marketplaceBookingFeeBps,
      feePercent: financials.feePercent,
      prepaymentPercent: financials.prepaymentPercent,
      prepaymentMinor: financials.prepaymentMinor,
      balanceMinor: financials.balanceMinor,
      depositMinor:
        car?.deposit != null ? Math.round(Number(car.deposit) * 100) : null,
      insurance: order.insurance || "",
      extras: {
        childSeats: order.ChildSeats ?? 0,
        secondDriver: Boolean(order.secondDriver),
      },
      lines: order.authoritativePrice?.lines || null,
      platformAmountMinor: financials.platformAmountMinor,
      stripeAmountMinor: financials.stripeAmountMinor,
      supplierBalanceMinor: financials.supplierBalanceMinor,
      payoutMinor: financials.payoutMinor,
      paymentFeeBearer: settings.paymentFeeBearer,
      vatTreatment: settings.vatTreatment,
    },
    payment: {
      provider: order.payment?.provider || "",
      providerPaymentId: order.payment?.providerPaymentId || "",
      paidAt: order.payment?.paidAt || null,
      amountMinor: Number(order.payment?.amountMinor) || 0,
      currency: String(order.payment?.currency || financials.currency).toUpperCase(),
    },
    partnerConfirmation: {
      confirmedAt: confirmationToken?.consumedAt || order.companyEmailDecisionAt || null,
      confirmedByEmail: "",
      confirmationTokenJti: confirmationToken?.jti || "",
      ipAddress: confirmationToken?.consumedIp || "",
      userAgent: confirmationToken?.consumedUserAgent || "",
      statementAccepted: confirmationToken
        ? partnerConfirmationStatement(financials.marketplaceBookingFeeBps)
        : "",
    },
    legalRefs: {
      agreementId: agreementRef?.agreementId || "",
      agreementPackageChecksum: agreementRef?.packageChecksum || "",
      customerBookingTerms: order.termsAcceptance?.platform?.checksum
        ? {
            documentType: order.termsAcceptance.platform.documentType,
            language: order.termsAcceptance.platform.language,
            version: order.termsAcceptance.platform.version,
            checksum: order.termsAcceptance.platform.checksum,
            acceptedAt: order.termsAcceptance.platform.acceptedAt || null,
          }
        : bookingTerms
          ? {
              documentType: bookingTerms.documentType,
              language: bookingTerms.language,
              version: bookingTerms.version,
              checksum: bookingTerms.checksum,
            }
          : null,
      privacyPolicy: order.termsAcceptance?.privacy?.checksum
        ? {
            version: order.termsAcceptance.privacy.version,
            language: order.termsAcceptance.privacy.language,
            checksum: order.termsAcceptance.privacy.checksum,
            contractualCheckbox: false,
          }
        : null,
      supplierRentalTerms: order.termsAcceptance?.company?.checksum
        ? {
            documentId: order.termsAcceptance.company.documentId || "",
            version: order.termsAcceptance.company.version || 0,
            language: order.termsAcceptance.company.language || "",
            checksum: order.termsAcceptance.company.checksum,
          }
        : null,
      partnerDocuments: agreementRef?.documents || null,
    },
    cancellationRulesText: "",
  };

  const snapshot = await ConfirmedBookingSnapshot.create({
    ...payload,
    checksum: computeSnapshotChecksum(payload),
  });

  await recordAuditEvent({
    action: "BOOKING_SNAPSHOT_CREATED",
    severity: "high",
    orderData: { orderId: order._id, orderNumber: order.orderNumber },
    metadata: { sequence, reason, checksum: snapshot.checksum },
  });

  return { ok: true, idempotent: false, snapshot: snapshot.toObject() };
}
