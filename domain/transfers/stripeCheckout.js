import Transfer, {
  TRANSFER_STATUS,
  normalizeTransferStatus,
} from "@models/Transfer";
import Company from "@models/company";
import { getBaseUrl } from "@config/domain";
import { getStripeMode, isStripeConfigured } from "@config/stripe";
import { assertStripeReady } from "@/lib/stripe";
import { BRAND } from "@config/brand";
import {
  resolveCompanyTransferPaymentPolicy,
  buildTransferCheckoutCharge,
  TRANSFER_COLLECTION_MODES,
} from "@/domain/transfers/companyPaymentPolicy";

async function loadClaimingCompany(doc) {
  const companyId = doc.assignedSupplierId || doc.claimedByCompanyId;
  if (!companyId) return null;
  return Company.findById(companyId).select("name transferServices").lean();
}

/**
 * Apply on-site (by fact) settlement after claim — no Stripe Checkout.
 */
export async function applyOnSiteTransferPayment(transferId, {
  policy = null,
  company = null,
} = {}) {
  const doc = await Transfer.findById(transferId);
  if (!doc) {
    return { ok: false, code: "not_found", message: "Transfer not found" };
  }

  const status = normalizeTransferStatus(doc.status);
  if (
    status !== TRANSFER_STATUS.CLAIMED &&
    status !== TRANSFER_STATUS.AWAITING_CUSTOMER_PAYMENT
  ) {
    return {
      ok: false,
      code: "invalid_status",
      message: `Cannot set on-site payment in status ${status}`,
    };
  }

  if (doc.payment?.status === "paid") {
    return { ok: true, idempotent: true, transfer: doc.toObject() };
  }

  const resolved =
    policy ||
    resolveCompanyTransferPaymentPolicy(company, {
      stripeConfigured: isStripeConfigured(),
    });

  const customer = Math.max(
    0,
    Math.round(Number(doc.quoteSnapshot?.customerPriceMinor) || 0)
  );
  const currency = String(
    doc.quoteSnapshot?.currency || doc.payment?.currency || "EUR"
  ).toUpperCase();

  const fromStatus = status;
  doc.payment = {
    ...(doc.payment?.toObject?.() || doc.payment || {}),
    method: "cash_driver",
    status: "not_required",
    amountMinor: 0,
    currency,
    provider: "",
    providerPaymentId: "",
    checkoutUrl: "",
    collectionMode: TRANSFER_COLLECTION_MODES.ON_SITE,
    onSiteAmountMinor: customer,
    notes: "Company collects payment on site / by fact",
  };
  doc.status = TRANSFER_STATUS.CONFIRMED;
  doc.statusEvents = doc.statusEvents || [];
  doc.statusEvents.push({
    from: fromStatus,
    to: TRANSFER_STATUS.CONFIRMED,
    at: new Date(),
    actor: "system",
    reason: "on_site_collection",
    metadata: {
      collectionMode: resolved.mode,
      companyId: String(doc.assignedSupplierId || doc.claimedByCompanyId || ""),
    },
  });
  await doc.save();

  return {
    ok: true,
    url: null,
    transfer: doc.toObject(),
    mode: resolved.mode,
    onSite: true,
  };
}

/**
 * Create (or reuse) a Stripe Checkout Session for a claimed transfer,
 * using the claiming company's payment policy.
 */
export async function createTransferCheckoutSession(
  transferId,
  { forceNew = false, company: companyHint = null } = {}
) {
  const doc = await Transfer.findById(transferId);
  if (!doc) {
    return { ok: false, code: "not_found", message: "Transfer not found" };
  }

  const status = normalizeTransferStatus(doc.status);
  const allowed = new Set([
    TRANSFER_STATUS.CLAIMED,
    TRANSFER_STATUS.AWAITING_CUSTOMER_PAYMENT,
  ]);
  if (!allowed.has(status)) {
    return {
      ok: false,
      code: "invalid_status",
      message: `Cannot collect payment in status ${status}`,
    };
  }

  if (doc.payment?.status === "paid") {
    return {
      ok: false,
      code: "already_paid",
      message: "Transfer is already paid",
      transfer: doc.toObject(),
    };
  }

  const company = companyHint || (await loadClaimingCompany(doc));
  const policy = resolveCompanyTransferPaymentPolicy(company, {
    stripeConfigured: isStripeConfigured(),
  });

  if (!policy.useStripe) {
    return applyOnSiteTransferPayment(transferId, { policy, company });
  }

  if (!isStripeConfigured()) {
    return {
      ok: false,
      code: "stripe_not_configured",
      message: "Stripe is not configured for the current mode",
    };
  }

  const charge = buildTransferCheckoutCharge(doc.quoteSnapshot, policy);
  if (!charge.ok) {
    return {
      ok: false,
      code: charge.code,
      message: charge.message,
    };
  }

  const amountMinor = charge.amountMinor;
  const currency = charge.currency.toLowerCase();
  const mode = getStripeMode();
  const idempotencyKey =
    doc.payment?.idempotencyKey ||
    `transfer_pay_${String(doc._id)}_${policy.mode}_${mode}_${amountMinor}`;

  if (
    !forceNew &&
    doc.payment?.provider === "stripe" &&
    doc.payment?.providerPaymentId &&
    doc.payment?.checkoutUrl &&
    doc.payment?.collectionMode === policy.mode
  ) {
    return {
      ok: true,
      reused: true,
      url: doc.payment.checkoutUrl,
      sessionId: doc.payment.providerPaymentId,
      transfer: doc.toObject(),
      mode: policy.mode,
      stripeMode: mode,
      onSiteAmountMinor: doc.payment.onSiteAmountMinor || 0,
    };
  }

  const stripe = assertStripeReady(mode);
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const brandName = BRAND?.name || "Transfer";
  const transferRef = String(doc._id);
  const routeLabel = `${doc.from} → ${doc.to}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: doc.email || undefined,
      client_reference_id: transferRef,
      line_items: charge.lineItems.map((item) => ({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: item.amountMinor,
          product_data: {
            name: `${brandName} — ${item.name}`,
            description: item.description
              ? `${item.description} (${routeLabel})`
              : routeLabel,
            metadata: { transferId: transferRef },
          },
        },
      })),
      metadata: {
        kind: "transfer",
        transferId: transferRef,
        stripeMode: mode,
        collectionMode: policy.mode,
        onSiteAmountMinor: String(charge.onSiteAmountMinor || 0),
      },
      success_url: `${baseUrl}/transfer/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/transfer/pay/cancel?transfer=${transferRef}`,
    },
    {
      idempotencyKey: forceNew
        ? `${idempotencyKey}_${Date.now()}`
        : idempotencyKey,
    }
  );

  const fromStatus = status;
  const toStatus = TRANSFER_STATUS.AWAITING_CUSTOMER_PAYMENT;

  doc.payment = {
    ...(doc.payment?.toObject?.() || doc.payment || {}),
    method:
      policy.mode === TRANSFER_COLLECTION_MODES.STRIPE_FULL
        ? "online_full"
        : "online_partial",
    status: "pending",
    amountMinor,
    currency: charge.currency,
    provider: "stripe",
    providerPaymentId: session.id,
    checkoutUrl: session.url || "",
    collectionMode: policy.mode,
    onSiteAmountMinor: charge.onSiteAmountMinor,
    idempotencyKey,
    notes:
      charge.onSiteAmountMinor > 0
        ? `On-site remainder: ${charge.onSiteAmountMinor} ${charge.currency}`
        : "",
  };

  if (fromStatus !== toStatus) {
    doc.status = toStatus;
    doc.statusEvents = doc.statusEvents || [];
    doc.statusEvents.push({
      from: fromStatus,
      to: toStatus,
      at: new Date(),
      actor: "system",
      reason: "stripe_checkout_created",
      metadata: {
        sessionId: session.id,
        mode,
        collectionMode: policy.mode,
      },
    });
  }

  await doc.save();

  return {
    ok: true,
    reused: false,
    url: session.url,
    sessionId: session.id,
    transfer: doc.toObject(),
    mode: policy.mode,
    stripeMode: mode,
    onSiteAmountMinor: charge.onSiteAmountMinor,
  };
}

/**
 * Apply a successful Stripe Checkout Session to a transfer (webhook / success page).
 */
export async function markTransferPaidFromCheckoutSession(session) {
  if (!session || session.payment_status !== "paid") {
    return { ok: false, code: "not_paid", message: "Session not paid" };
  }

  const transferId =
    session.metadata?.transferId || session.client_reference_id || "";
  if (!transferId) {
    return {
      ok: false,
      code: "missing_transfer",
      message: "No transferId on session",
    };
  }

  const doc = await Transfer.findById(transferId);
  if (!doc) {
    return { ok: false, code: "not_found", message: "Transfer not found" };
  }

  if (doc.payment?.status === "paid") {
    return {
      ok: true,
      idempotent: true,
      transfer: doc.toObject(),
    };
  }

  const fromStatus = normalizeTransferStatus(doc.status);
  const amountMinor =
    Number(session.amount_total) ||
    Number(doc.payment?.amountMinor) ||
    0;
  const onSiteAmountMinor = Number(
    session.metadata?.onSiteAmountMinor ?? doc.payment?.onSiteAmountMinor ?? 0
  );
  const collectionMode =
    session.metadata?.collectionMode ||
    doc.payment?.collectionMode ||
    TRANSFER_COLLECTION_MODES.STRIPE_FULL;

  doc.payment = {
    ...(doc.payment?.toObject?.() || doc.payment || {}),
    status: "paid",
    amountMinor,
    currency: String(
      session.currency || doc.payment?.currency || "EUR"
    ).toUpperCase(),
    provider: "stripe",
    providerPaymentId: session.id,
    collectionMode,
    onSiteAmountMinor,
    paidAt: new Date(),
    notes:
      onSiteAmountMinor > 0
        ? `Paid online. On-site remainder: ${onSiteAmountMinor}`
        : doc.payment?.notes || "",
  };

  if (fromStatus !== TRANSFER_STATUS.CONFIRMED) {
    doc.status = TRANSFER_STATUS.CONFIRMED;
    doc.statusEvents = doc.statusEvents || [];
    doc.statusEvents.push({
      from: fromStatus,
      to: TRANSFER_STATUS.CONFIRMED,
      at: new Date(),
      actor: "system",
      reason: "stripe_checkout_paid",
      metadata: {
        sessionId: session.id,
        paymentIntent: session.payment_intent || null,
        collectionMode,
        onSiteAmountMinor,
      },
    });
  }

  await doc.save();

  return {
    ok: true,
    idempotent: false,
    transfer: doc.toObject(),
  };
}
