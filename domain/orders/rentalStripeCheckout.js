import { Order } from "@models/order";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import { snapshotMarketplaceBookingFeeBps } from "@/domain/orders/marketplaceBookingFee";
import Company from "@models/company";
import { getBaseUrl } from "@config/domain";
import { getStripeMode, isStripeConfigured } from "@config/stripe";
import { assertStripeReady } from "@/lib/stripe";
import {
  shortBookingDateRange,
  stripeBookingProductDescription,
  stripeBookingProductTitle,
} from "@/domain/bookings/bookingEmailPolicy";
import {
  resolveCompanyRentalPaymentPolicy,
  resolveRentalCheckoutAmount,
  RENTAL_COLLECTION_MODES,
} from "@/domain/orders/companyRentalPaymentPolicy";
import { loadLegalSettings } from "@/domain/legal/legalSettingsService";
import { computePriceSnapshotChecksum } from "@/domain/orders/priceSnapshotChecksum";
import { sendCustomerPaymentRequestEmail } from "@/domain/orders/marketplaceBookingEmails";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import {
  assertPartnerCanOperate,
  auditPartnerComplianceBlock,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";
import {
  applyRentalStateTransition,
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { replacementAcceptanceOnVerifiedPayment } from "@/domain/booking/equivalentReplacementCopy";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { finalizeMarketplaceHold } from "@/domain/booking/bookingHold";
import { expireUnpaidMarketplacePayment } from "@/domain/booking/expireMarketplacePayment";
import { invalidateMarketplaceCheckoutsForOrderRecord } from "@/domain/orders/invalidateMarketplaceCheckout";
import {
  archiveStripeSession,
  classifyRefundStatus,
  computeNetPaidMinor,
  findOrderForStripeObject,
  hasProcessedStripeEvent,
  isCurrentStripeSession,
  persistStripeRefs,
  rememberStripeEvent,
  sessionHistoryHas,
  listSessionHistory,
  stripeObjectIds,
  STRIPE_SESSION_ARCHIVE,
  REFUND_STATUS,
} from "@/domain/orders/stripePaymentRefs";
import {
  PRICE_BREAKDOWN_CUSTOMER_MESSAGE,
  PRICE_BREAKDOWN_MISMATCH,
  assertAuthoritativePriceReconciled,
  logPriceBreakdownMismatch,
} from "@/domain/orders/priceBreakdownReconciliation";
import { capturePaidMarketplaceFeeSnapshot } from "@/domain/orders/marketplacePriceCorrection";
import { attachBookingFinancialSnapshot } from "@/domain/orders/bookingFinancialSnapshot";

const STRIPE_EXPIRES_MIN_MINUTES = 30;
const STRIPE_EXPIRES_MAX_MINUTES = 24 * 60;

export function clampStripeExpiresMinutes(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return 60;
  return Math.min(
    STRIPE_EXPIRES_MAX_MINUTES,
    Math.max(STRIPE_EXPIRES_MIN_MINUTES, Math.round(n))
  );
}

async function loadOrderCompany(order) {
  const ownerId = order?.ownerId;
  if (!ownerId) return null;
  return Company.findById(ownerId)
    .select("name email rentalPayments prepaymentPercent")
    .lean();
}

function paymentExpiresAt(session) {
  if (session?.expires_at) return new Date(Number(session.expires_at) * 1000);
  return null;
}

export function buildRentalCheckoutMetadata(order, amounts, { mode, policy, priceChecksum }) {
  const orderRef = String(order.orderNumber || order._id);
  const snap = order?.locationSnapshot || {};
  const pickup = snap.pickup || {};
  const ret = snap.return || snap.dropoff || {};
  const feeBps = snapshotMarketplaceBookingFeeBps(order).bps;
  return {
    kind: "rental",
    orderId: String(order._id),
    bookingReference: orderRef,
    bookingRef: orderRef,
    companyId: order.ownerId ? String(order.ownerId) : "",
    carId: order.car ? String(order.car) : "",
    alternativeOfferId: String(order.acceptedAlternativeOfferId || ""),
    expectedAmountMinor: String(amounts.amountMinor),
    prepaymentMinor: String(amounts.amountMinor),
    platformAmountMinor: String(amounts.amountMinor),
    stripeAmountMinor: String(amounts.amountMinor),
    grossMinor: String(amounts.grossMinor),
    supplierBalanceMinor: String(amounts.balanceMinor || 0),
    payoutMinor: "0",
    marketplaceBookingFeeBps: String(
      amounts.marketplaceBookingFeeBps ?? feeBps
    ),
    feePercent: String(
      amounts.feePercent ??
        Number((Number(amounts.marketplaceBookingFeeBps ?? feeBps) / 100).toFixed(2))
    ),
    currency: amounts.currency,
    priceSnapshotChecksum: priceChecksum,
    priceChecksum,
    locationChecksumVersion: String(snap.pricingVersion || ""),
    pickupKind: String(pickup.kind || ""),
    returnKind: String(ret.kind || ""),
    environment: mode,
    stripeMode: mode,
    collectionMode: policy?.mode || "",
    timing: policy?.timing || "",
    onSiteAmountMinor: String(amounts.balanceMinor || 0),
  };
}

/**
 * Mark rental as on-site collection (no Stripe).
 */
export async function applyOnSiteRentalPayment(orderId, { policy } = {}) {
  const doc = await Order.findById(orderId);
  if (!doc) {
    return { ok: false, code: "not_found", message: "Order not found" };
  }

  const amounts = resolveRentalCheckoutAmount(doc);
  doc.set(
    "payment",
    {
      ...(doc.payment && typeof doc.payment === "object" ? doc.payment : {}),
      method: "cash_driver",
      status: "not_required",
      amountMinor: 0,
      currency: amounts.currency,
      provider: "",
      providerPaymentId: "",
      checkoutUrl: "",
      collectionMode: RENTAL_COLLECTION_MODES.ON_SITE,
      onSiteAmountMinor: amounts.grossMinor || amounts.balanceMinor,
      timing: policy?.timing || "",
      notes: "Company collects payment on site / by fact",
    },
    { strict: false }
  );
  await doc.save();
  return { ok: true, transfer: null, order: doc.toObject(), onSite: true };
}

function hasReusableSession(doc) {
  const pay = doc.payment || {};
  if (pay.status === "paid") return false;
  if (pay.status === "expired") return false;
  if (pay.provider !== "stripe") return false;
  if (!pay.checkoutUrl || !pay.providerPaymentId) return false;
  if (pay.expiresAt && new Date(pay.expiresAt) <= new Date()) return false;
  return true;
}

/**
 * Create Stripe Checkout for rental prepayment.
 */
export async function createRentalCheckoutSession(
  orderId,
  {
    forceNew = false,
    company: companyHint = null,
    emailCustomer = false,
    complianceOverrideReason = "",
    complianceOverrideRole = "",
    complianceOverrideEmail = "",
  } = {}
) {
  const doc = await Order.findById(orderId);
  if (!doc) {
    return { ok: false, code: "not_found", message: "Order not found" };
  }
  if (!isPlatformBooking(doc)) {
    return {
      ok: false,
      code: "not_platform_booking",
      message: "Internal bookings do not use Rovaro Checkout.",
    };
  }

  if (doc.payment?.status === "paid") {
    return {
      ok: false,
      code: "already_paid",
      message: "Order prepayment already paid",
      order: doc.toObject(),
    };
  }

  if (isMarketplaceRequestMode(doc.bookingMode)) {
    const reconciled = assertAuthoritativePriceReconciled(doc);
    if (!reconciled.ok) {
      logPriceBreakdownMismatch({
        orderId: doc._id,
        companyId: doc.ownerId,
        breakdown: reconciled.breakdown,
        stage: "createRentalCheckoutSession",
      });
      return {
        ok: false,
        code: PRICE_BREAKDOWN_MISMATCH,
        message: PRICE_BREAKDOWN_CUSTOMER_MESSAGE,
      };
    }
  }

  const company = companyHint || (await loadOrderCompany(doc));
  const policy = resolveCompanyRentalPaymentPolicy(company, {
    stripeConfigured: isStripeConfigured(),
    bookingMode: doc.bookingMode,
  });

  if (!policy.useStripe) {
    return applyOnSiteRentalPayment(orderId, { policy });
  }

  if (!isStripeConfigured()) {
    return {
      ok: false,
      code: "stripe_not_configured",
      message: "Stripe is not configured",
    };
  }

  const amounts = resolveRentalCheckoutAmount(doc, { company });
  if (amounts.amountMinor < 50) {
    return {
      ok: false,
      code: "prepayment_too_low",
      message:
        "Prepayment is 0 or too low for Stripe. Set company prepayment % or collect on site.",
    };
  }

  const mode = getStripeMode();
  const priceChecksum = computePriceSnapshotChecksum(doc);
  const idempotencyKey =
    !forceNew && doc.payment?.idempotencyKey
      ? doc.payment.idempotencyKey
      : `rental_pay_${String(doc._id)}_${mode}_${amounts.amountMinor}`;

  if (isMarketplaceRequestMode(doc.bookingMode)) {
    const checkoutGate = await assertPartnerCanOperate(doc.ownerId, {
      company: companyHint,
      purpose: PARTNER_OPERATION_PURPOSE.CHECKOUT,
      overrideReason: complianceOverrideReason,
      overrideByRole: complianceOverrideRole,
      overrideByEmail: complianceOverrideEmail,
      audit: { orderId: doc._id },
    });
    if (!checkoutGate.allowed) {
      await auditPartnerComplianceBlock({
        purpose: PARTNER_OPERATION_PURPOSE.CHECKOUT,
        result: checkoutGate,
        actorEmail: complianceOverrideEmail,
        actorRole: complianceOverrideRole || "system",
        orderId: doc._id,
      });
      if (hasReusableSession(doc) || doc.payment?.providerPaymentId) {
        await invalidateMarketplaceCheckoutsForOrderRecord(doc, {
          reason: checkoutGate.code || checkoutGate.error,
          actorEmail: complianceOverrideEmail,
          actorRole: complianceOverrideRole || "system",
        });
      }
      return {
        ok: false,
        status: 403,
        code: checkoutGate.code,
        error: checkoutGate.error,
        message: checkoutGate.partnerMessage,
      };
    }
  }

  if (isMarketplaceRequestMode(doc.bookingMode)) {
    attachBookingFinancialSnapshot(doc, { company });
  }

  if (!forceNew && hasReusableSession(doc)) {
    return {
      ok: true,
      reused: true,
      url: doc.payment.checkoutUrl,
      sessionId: doc.payment.providerPaymentId,
      expiresAt: doc.payment.expiresAt || null,
      order: doc.toObject(),
      mode: policy.mode,
      timing: policy.timing,
      priceChecksum,
    };
  }

  const settings = await loadLegalSettings().catch(() => ({
    paymentLinkExpirationMinutes: 60,
  }));
  const expireMinutes = clampStripeExpiresMinutes(
    settings.paymentLinkExpirationMinutes
  );
  const expiresAtUnix = Math.floor(Date.now() / 1000) + expireMinutes * 60;

  const stripe = assertStripeReady(mode);
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const metadata = buildRentalCheckoutMetadata(doc, amounts, {
    mode,
    policy,
    priceChecksum,
  });
  // Checkout presentation is owned by the booking email policy so the title,
  // the fee percentage and the customer-facing reference stay in one place.
  const stripeProductName = stripeBookingProductTitle({ order: doc });
  const stripeProductDescription = stripeBookingProductDescription({
    publicReference: doc.publicReference,
    shortDateRange: shortBookingDateRange(
      doc.localPickup?.date || doc.pickupAtUtc || doc.timeIn,
      doc.localReturn?.date || doc.returnAtUtc || doc.timeOut
    ),
  });

  if (forceNew && doc.payment?.providerPaymentId) {
    try {
      await stripe.checkout.sessions.expire(doc.payment.providerPaymentId);
    } catch (err) {
      const msg = String(err?.message || err);
      if (!/expired|complete|No such/i.test(msg)) {
        console.warn("[rental checkout] expire previous session failed", msg);
      }
    }
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: doc.email || undefined,
        client_reference_id: String(doc._id),
        expires_at: expiresAtUnix,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: amounts.currency.toLowerCase(),
              unit_amount: amounts.amountMinor,
              product_data: {
                name: stripeProductName,
                description: stripeProductDescription,
                metadata: { orderId: String(doc._id) },
              },
            },
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
        },
        success_url: `${baseUrl}/order/pay/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/order/pay/cancel?order=${String(doc._id)}`,
      },
      {
        idempotencyKey: forceNew
          ? `${idempotencyKey}_${Date.now()}`
          : idempotencyKey,
      }
    );
  } catch (err) {
    console.error("[rental checkout] stripe create failed", err?.message || err);
    const failedPayment = {
      ...(doc.payment && typeof doc.payment === "object" ? doc.payment : {}),
      lastCheckoutError: err?.message || "Checkout failed",
    };
    doc.set("payment", failedPayment, { strict: false });
    await doc.save().catch(() => {});
    return {
      ok: false,
      code: "checkout_failed",
      message: err?.message || "Checkout failed",
    };
  }

  const expiresAt = paymentExpiresAt(session);
  const previous = archiveStripeSession(
    doc.payment && typeof doc.payment === "object" ? doc.payment : {},
    {
      status: forceNew
        ? STRIPE_SESSION_ARCHIVE.REPLACED
        : STRIPE_SESSION_ARCHIVE.EXPIRED,
    }
  );
  doc.set(
    "payment",
    {
      ...previous,
      method: "online_partial",
      status: "pending",
      amountMinor: amounts.amountMinor,
      currency: amounts.currency,
      provider: "stripe",
      providerPaymentId: session.id,
      checkoutUrl: session.url || "",
      collectionMode: policy.mode,
      onSiteAmountMinor: amounts.balanceMinor,
      timing: policy.timing,
      idempotencyKey,
      priceChecksum,
      expiresAt,
      lastCheckoutError: "",
      notes:
        amounts.balanceMinor > 0
          ? `Balance on site: ${amounts.balanceMinor} ${amounts.currency}`
          : "",
    },
    { strict: false }
  );
  await doc.save();

  if (emailCustomer && session.url) {
    const mailed = await sendCustomerPaymentRequestEmail({
      order: doc.toObject(),
      paymentUrl: session.url,
      expiresAt,
      stripeSessionId: session.id,
    });
    if (!mailed.ok) {
      console.error("[rental checkout] branded payment email failed", mailed);
    }
  }

  return {
    ok: true,
    reused: false,
    url: session.url,
    sessionId: session.id,
    expiresAt,
    priceChecksum,
    order: doc.toObject(),
    mode: policy.mode,
    timing: policy.timing,
  };
}

export async function expireRentalCheckoutSession(orderId) {
  const doc = await Order.findById(orderId);
  if (!doc?.payment?.providerPaymentId || doc.payment.provider !== "stripe") {
    return { ok: true, skipped: true };
  }
  if (String(doc.payment.status || "") === "paid") {
    return { ok: true, skipped: true, reason: "already_paid_no_refund" };
  }
  if (!isStripeConfigured()) return { ok: true, skipped: true };
  try {
    const stripe = assertStripeReady(getStripeMode());
    await stripe.checkout.sessions.expire(doc.payment.providerPaymentId);
  } catch (err) {
    const msg = String(err?.message || err);
    if (!/expired|complete|No such/i.test(msg)) {
      console.warn("[rental checkout] expire session failed", msg);
    }
  }
  return { ok: true };
}

function mismatch(code, message, extra = {}) {
  return { ok: false, code, message, received: true, ...extra };
}

/**
 * Verify a Stripe Checkout session against the stored order before marking paid.
 */
export function evaluateRentalPaidSession(session, order) {
  if (!session) return mismatch("missing_session", "No session");
  if (session.payment_status !== "paid") {
    return mismatch("not_paid", "Session not paid");
  }
  if (session.metadata?.kind && session.metadata.kind !== "rental") {
    return mismatch("wrong_kind", "Session kind is not rental");
  }
  if (!order) return mismatch("not_found", "Order not found");

  if (order.payment?.status === "expired") {
    return mismatch(
      "stale_session",
      "Session was invalidated and cannot confirm this booking",
      { stale: true }
    );
  }

  const historyRow = listSessionHistory(order.payment).find(
    (row) => String(row?.sessionId || "") === String(session.id)
  );
  const historyStatus = String(historyRow?.status || "").toLowerCase();
  const storedSessionId = String(order.payment?.providerPaymentId || "");
  if (
    historyRow &&
    (historyStatus === STRIPE_SESSION_ARCHIVE.EXPIRED ||
      historyStatus === STRIPE_SESSION_ARCHIVE.REPLACED) &&
    storedSessionId !== String(session.id)
  ) {
    return mismatch(
      "stale_session",
      "Session was replaced or expired and cannot confirm this booking",
      { stale: true }
    );
  }

  const orderId = String(
    session.metadata?.orderId || session.client_reference_id || ""
  );
  if (!orderId || String(order._id) !== orderId) {
    return mismatch("order_mismatch", "Session order does not match stored order");
  }

  if (storedSessionId && storedSessionId !== String(session.id)) {
    const stale = sessionHistoryHas(order.payment, session.id);
    return mismatch(
      stale ? "stale_session" : "session_mismatch",
      stale
        ? "Session was replaced or expired and cannot confirm this booking"
        : "Session id does not match stored checkout",
      { stale: true }
    );
  }

  const amounts = resolveRentalCheckoutAmount(order);
  const sessionAmount = Number(session.amount_total);
  const storedAmount = Number(order.payment?.amountMinor || amounts.amountMinor);
  if (
    !Number.isFinite(sessionAmount) ||
    sessionAmount !== storedAmount ||
    sessionAmount !== amounts.amountMinor
  ) {
    return mismatch("amount_mismatch", "Session amount does not match prepayment");
  }

  const sessionCurrency = String(session.currency || "").toUpperCase();
  const storedCurrency = String(
    order.payment?.currency || amounts.currency || "EUR"
  ).toUpperCase();
  if (sessionCurrency && sessionCurrency !== storedCurrency) {
    return mismatch("currency_mismatch", "Session currency does not match order");
  }

  const sessionCompany = String(session.metadata?.companyId || "");
  const orderCompany = order.ownerId ? String(order.ownerId) : "";
  if (sessionCompany && orderCompany && sessionCompany !== orderCompany) {
    return mismatch("company_mismatch", "Session company does not match order owner");
  }

  const expectedChecksum =
    order.payment?.priceChecksum || computePriceSnapshotChecksum(order);
  const sessionChecksum = String(
    session.metadata?.priceSnapshotChecksum || session.metadata?.priceChecksum || ""
  );
  if (sessionChecksum && expectedChecksum && sessionChecksum !== expectedChecksum) {
    return mismatch("checksum_mismatch", "Price snapshot checksum mismatch");
  }

  const sessionPrepay = Number(
    session.metadata?.expectedAmountMinor || session.metadata?.prepaymentMinor
  );
  if (
    Number.isFinite(sessionPrepay) &&
    sessionPrepay > 0 &&
    sessionPrepay !== amounts.amountMinor
  ) {
    return mismatch("prepayment_mismatch", "Metadata prepayment does not match");
  }

  return { ok: true, amounts, expectedChecksum };
}

export async function markRentalPaidFromCheckoutSession(session, { eventId = "" } = {}) {
  let doc = session?.id
    ? await findOrderForStripeObject(session)
    : null;
  const orderId = session?.metadata?.orderId || session?.client_reference_id || "";
  if (!doc && orderId) {
    doc = await Order.findById(orderId);
  }
  if (!doc) {
    return mismatch("not_found", "Order not found");
  }

  if (hasProcessedStripeEvent(doc.payment, eventId) && doc.payment?.status === "paid") {
    return { ok: true, idempotent: true, order: doc.toObject() };
  }

  if (doc.payment?.status === "paid") {
    return { ok: true, idempotent: true, order: doc.toObject() };
  }

  const check = evaluateRentalPaidSession(session, doc);
  if (!check.ok) {
    const payment = {
      ...(doc.payment && typeof doc.payment === "object" ? doc.payment : {}),
      lastWebhookError: `${check.code}: ${check.message}`,
    };
    doc.set("payment", payment, { strict: false });
    await doc.save().catch(() => {});
    await recordAuditEvent({
      action:
        check.code === "stale_session"
          ? "RENTAL_PAYMENT_STALE_SESSION"
          : "RENTAL_PAYMENT_MISMATCH",
      severity: check.code === "stale_session" ? "medium" : "critical",
      result: "failure",
      orderData: { orderId: doc._id, orderNumber: doc.orderNumber },
      metadata: {
        code: check.code,
        sessionId: session?.id,
        currentSessionId: doc.payment?.providerPaymentId || "",
        amountTotal: session?.amount_total,
        currency: session?.currency,
      },
    });
    try {
      await notifySuperadmin({
        title: `⚠️ Stripe rental mismatch — order #${doc.orderNumber || doc._id}`,
        bodyLines: [
          `Verification failed: ${check.code}`,
          check.message,
          `Session ${session?.id || "—"}`,
          `Order ${doc._id}`,
        ],
        meta: { orderId: doc._id, type: "rental_payment_mismatch" },
      });
    } catch (err) {
      console.error("[rental paid] mismatch notify failed", err?.message || err);
    }
    return check;
  }

  const paidAt = new Date();
  const refs = stripeObjectIds(session);
  const updated = await Order.findOneAndUpdate(
    {
      _id: doc._id,
      "payment.status": { $nin: ["paid", "expired"] },
      bookingStatus: { $ne: BOOKING_STATUS.BOOKING_CONFIRMED },
    },
    {
      $set: {
        customerConfirmation: "CONFIRMED_BY_PAYMENT",
        bookingFeePaymentStatus: "PAID",
        ...replacementAcceptanceOnVerifiedPayment(doc, paidAt),
        "payment.status": "paid",
        "payment.paidAt": paidAt,
        "payment.provider": "stripe",
        "payment.providerPaymentId": session.id,
        "payment.paymentIntentId": refs.paymentIntentId || session.payment_intent || "",
        "payment.chargeId": refs.chargeId || "",
        "payment.amountMinor": check.amounts.amountMinor,
        "payment.paidAmountMinor": check.amounts.amountMinor,
        "payment.refundedAmountMinor": 0,
        "payment.netPaidAmountMinor": check.amounts.amountMinor,
        "payment.refundStatus": REFUND_STATUS.NONE,
        "payment.currency": check.amounts.currency,
        "payment.lastWebhookError": "",
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
        confirmed: true,
      },
    },
    { new: true }
  );

  if (!updated) {
    const latest = await Order.findById(doc._id);
    if (latest?.payment?.status === "paid") {
      return { ok: true, idempotent: true, order: latest.toObject() };
    }
    return mismatch("write_conflict", "Could not mark order paid");
  }

  const fromState = resolveRentalState({
    ...doc.toObject(),
    bookingStatus: doc.bookingStatus,
  });
  if (
    fromState !== RENTAL_STATE.CONFIRMED &&
    !applyRentalStateTransition(updated, RENTAL_STATE.CONFIRMED).ok
  ) {
    updated.bookingStatus = BOOKING_STATUS.BOOKING_CONFIRMED;
  }

  const paidPayment = rememberStripeEvent(
    persistStripeRefs(updated.payment, refs),
    { id: eventId, type: "checkout.session.completed" }
  );
  const completedHistory = archiveStripeSession(paidPayment, {
    status: STRIPE_SESSION_ARCHIVE.COMPLETED,
    at: paidAt,
  });
  updated.set("payment", completedHistory, { strict: false });
  if (isMarketplaceRequestMode(updated.bookingMode) && !updated.paidMarketplaceFeeSnapshot) {
    updated.set(
      "paidMarketplaceFeeSnapshot",
      capturePaidMarketplaceFeeSnapshot(updated, { now: paidAt }),
      { strict: false }
    );
  }
  if (isMarketplaceRequestMode(updated.bookingMode)) {
    attachBookingFinancialSnapshot(updated);
  }
  await updated.save();

  await finalizeMarketplaceHold(updated._id, { stripeSessionId: session.id });
  await recordAuditEvent({
    action: "RENTAL_PREPAYMENT_RECEIVED",
    severity: "critical",
    orderData: {
      orderId: updated._id,
      orderNumber: updated.orderNumber,
      carModel: updated.carModel,
    },
    metadata: {
      sessionId: session.id,
      amountMinor: check.amounts.amountMinor,
      currency: check.amounts.currency,
      priceChecksum: check.expectedChecksum,
    },
  });

  return { ok: true, idempotent: false, order: updated.toObject() };
}

export async function handleRentalCheckoutExpired(session) {
  const doc =
    (await findOrderForStripeObject(session)) ||
    (session?.metadata?.orderId || session?.client_reference_id
      ? await Order.findById(
          session.metadata?.orderId || session.client_reference_id
        )
      : null);
  if (!doc) return { ok: true, skipped: true };
  if (doc.payment?.status === "paid") return { ok: true, skipped: true, paid: true };
  if (!isCurrentStripeSession(doc, session?.id) && session?.id) {
    await recordAuditEvent({
      action: "RENTAL_PAYMENT_STALE_SESSION",
      severity: "low",
      result: "success",
      orderData: { orderId: doc._id, orderNumber: doc.orderNumber },
      metadata: {
        sessionId: session.id,
        currentSessionId: doc.payment?.providerPaymentId || "",
        reason: "expired_after_replacement",
      },
    });
    return { ok: true, skipped: true, reason: "other_session", stale: true };
  }
  return expireUnpaidMarketplacePayment({
    order: doc,
    sessionId: session?.id || "",
    reason: "checkout_expired",
    sendEmail: true,
  });
}

export async function handleRentalPaymentFailed(session) {
  return handleRentalCheckoutExpired({
    ...session,
    metadata: { ...(session?.metadata || {}), failed: "1" },
  });
}

export async function recordRentalRefundOrDispute(
  eventType,
  object,
  { eventId = "" } = {}
) {
  const refs = stripeObjectIds(object);
  let doc = await findOrderForStripeObject(object);
  if (!doc) {
    const fallbackId =
      object?.metadata?.orderId || object?.client_reference_id || "";
    if (fallbackId) doc = await Order.findById(fallbackId);
  }
  if (!doc) return { ok: true, skipped: true, reason: "order_not_found" };

  if (hasProcessedStripeEvent(doc.payment, eventId)) {
    return { ok: true, idempotent: true, order: doc.toObject() };
  }

  const now = new Date();
  let payment = persistStripeRefs(
    {
      ...(doc.payment && typeof doc.payment === "object" ? doc.payment : {}),
    },
    refs
  );
  payment = rememberStripeEvent(payment, { id: eventId, type: eventType });

  const paidMinor = Math.max(
    0,
    Number(payment.paidAmountMinor || payment.amountMinor || 0)
  );
  if (!payment.paidAmountMinor && paidMinor) {
    payment.paidAmountMinor = paidMinor;
  }

  let action = "RENTAL_DISPUTE_UPDATED";
  let notify = true;
  let refundKind = "";

  if (eventType.startsWith("charge.refunded") || eventType === "refund.created") {
    const incomingRefunded = Math.max(
      0,
      Number(object.amount_refunded || object.amount || 0)
    );
    const previousRefunded = Math.max(0, Number(payment.refundedAmountMinor || 0));
    const refundedMinor = Math.max(previousRefunded, incomingRefunded);
    const refundStatus = classifyRefundStatus(paidMinor, refundedMinor);
    const history = Array.isArray(payment.refundHistory)
      ? payment.refundHistory.slice()
      : [];
    history.push({
      eventId: eventId || "",
      stripeId: object?.id || "",
      amountMinor: incomingRefunded,
      at: now,
      kind: refundStatus,
    });
    payment.refundHistory = history.slice(-40);
    payment.refundedAmountMinor = refundedMinor;
    payment.netPaidAmountMinor = computeNetPaidMinor({
      paidAmountMinor: paidMinor,
      refundedAmountMinor: refundedMinor,
    });
    payment.refundStatus = refundStatus;
    payment.refundedAt = now;
    if (refundStatus === REFUND_STATUS.FULL) {
      payment.status = "refunded";
    }
    refundKind = refundStatus;
    action =
      refundStatus === REFUND_STATUS.FULL
        ? "RENTAL_REFUND_FULL"
        : "RENTAL_REFUND_PARTIAL";
  } else if (eventType === "charge.dispute.created") {
    const disputes = Array.isArray(payment.disputeHistory)
      ? payment.disputeHistory.slice()
      : [];
    disputes.push({
      eventId: eventId || "",
      disputeId: object.id || "",
      status: "open",
      at: now,
    });
    payment.disputeHistory = disputes.slice(-20);
    payment.disputeStatus = "open";
    payment.disputeId = object.id || payment.disputeId || "";
    payment.disputedAt = now;
    action = "RENTAL_DISPUTE_CREATED";
  } else if (eventType === "charge.dispute.updated") {
    payment.disputeStatus = object.status || payment.disputeStatus || "open";
    payment.disputeId = object.id || payment.disputeId || "";
    action = "RENTAL_DISPUTE_UPDATED";
    notify = object.status === "lost" || object.status === "won";
  } else if (eventType === "charge.dispute.closed") {
    payment.disputeStatus = object.status || "closed";
    payment.disputeId = object.id || payment.disputeId || "";
    payment.disputeResolvedAt = now;
    action = "RENTAL_DISPUTE_CLOSED";
  }

  doc.set("payment", payment, { strict: false });
  await doc.save();

  await recordAuditEvent({
    action,
    severity: "critical",
    orderData: { orderId: doc._id, orderNumber: doc.orderNumber },
    metadata: {
      eventType,
      eventId,
      stripeId: object?.id,
      refundStatus: payment.refundStatus || "",
      disputeStatus: payment.disputeStatus || "",
      paidAmountMinor: payment.paidAmountMinor,
      refundedAmountMinor: payment.refundedAmountMinor,
      netPaidAmountMinor: payment.netPaidAmountMinor,
    },
  });

  if (notify) {
    try {
      await notifySuperadmin({
        title: `⚠️ ${action} — order #${doc.orderNumber || doc._id}`,
        bodyLines: [
          `Stripe event: ${eventType}`,
          `Order ${doc._id}`,
          refundKind
            ? `Refund: ${refundKind}. Original payment kept. Booking was not auto-cancelled.`
            : `Dispute status: ${payment.disputeStatus || "—"}.`,
          "Further booking changes follow existing cancellation rules.",
        ],
        meta: { orderId: doc._id, type: action },
      });
    } catch (err) {
      console.error("[rental refund/dispute] notify failed", err?.message || err);
    }
  }

  return {
    ok: true,
    refundStatus: payment.refundStatus || REFUND_STATUS.NONE,
    disputeStatus: payment.disputeStatus || "",
    order: doc.toObject(),
  };
}

export async function markRentalPaidEmailsSent(orderId) {
  await Order.updateOne(
    { _id: orderId, "payment.paidEmailsSentAt": { $exists: false } },
    { $set: { "payment.paidEmailsSentAt": new Date() } }
  ).catch(() => {});
}
