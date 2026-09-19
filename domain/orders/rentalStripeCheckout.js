import { Order } from "@models/order";
import Company from "@models/company";
import { getBaseUrl } from "@config/domain";
import { getStripeMode, isStripeConfigured } from "@config/stripe";
import { assertStripeReady } from "@/lib/stripe";
import { BRAND } from "@config/brand";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import {
  resolveCompanyRentalPaymentPolicy,
  resolveRentalCheckoutAmount,
  RENTAL_COLLECTION_MODES,
} from "@/domain/orders/companyRentalPaymentPolicy";

async function loadOrderCompany(order) {
  const ownerId = order?.ownerId;
  if (!ownerId) return null;
  return Company.findById(ownerId)
    .select("name email rentalPayments prepaymentPercent")
    .lean();
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

/**
 * Create Stripe Checkout for rental prepayment.
 */
export async function createRentalCheckoutSession(
  orderId,
  { forceNew = false, company: companyHint = null, emailCustomer = false } = {}
) {
  const doc = await Order.findById(orderId);
  if (!doc) {
    return { ok: false, code: "not_found", message: "Order not found" };
  }

  if (doc.payment?.status === "paid") {
    return {
      ok: false,
      code: "already_paid",
      message: "Order prepayment already paid",
      order: doc.toObject(),
    };
  }

  const company = companyHint || (await loadOrderCompany(doc));
  const policy = resolveCompanyRentalPaymentPolicy(company, {
    stripeConfigured: isStripeConfigured(),
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

  const amounts = resolveRentalCheckoutAmount(doc);
  if (amounts.amountMinor < 50) {
    return {
      ok: false,
      code: "prepayment_too_low",
      message:
        "Prepayment is 0 or too low for Stripe. Set company prepayment % or collect on site.",
    };
  }

  const mode = getStripeMode();
  const idempotencyKey =
    doc.payment?.idempotencyKey ||
    `rental_pay_${String(doc._id)}_${mode}_${amounts.amountMinor}`;

  if (
    !forceNew &&
    doc.payment?.provider === "stripe" &&
    doc.payment?.checkoutUrl &&
    doc.payment?.providerPaymentId
  ) {
    return {
      ok: true,
      reused: true,
      url: doc.payment.checkoutUrl,
      sessionId: doc.payment.providerPaymentId,
      order: doc.toObject(),
      mode: policy.mode,
      timing: policy.timing,
    };
  }

  const stripe = assertStripeReady(mode);
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const brandName = BRAND?.name || "Rental";
  const orderRef = String(doc._id);
  const carLabel = [doc.carModel, doc.regNumber].filter(Boolean).join(" ");

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: doc.email || undefined,
      client_reference_id: orderRef,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: amounts.currency.toLowerCase(),
            unit_amount: amounts.amountMinor,
            product_data: {
              name: `${brandName} — rental prepayment`,
              description: carLabel
                ? `Prepayment for ${carLabel}`
                : "Car rental prepayment",
              metadata: { orderId: orderRef },
            },
          },
        },
      ],
      metadata: {
        kind: "rental",
        orderId: orderRef,
        stripeMode: mode,
        collectionMode: policy.mode,
        timing: policy.timing,
        onSiteAmountMinor: String(amounts.balanceMinor || 0),
      },
      success_url: `${baseUrl}/order/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/order/pay/cancel?order=${orderRef}`,
    },
    {
      idempotencyKey: forceNew
        ? `${idempotencyKey}_${Date.now()}`
        : idempotencyKey,
    }
  );

  doc.set(
    "payment",
    {
      ...(doc.payment && typeof doc.payment === "object" ? doc.payment : {}),
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
      notes:
        amounts.balanceMinor > 0
          ? `Balance on site: ${amounts.balanceMinor} ${amounts.currency}`
          : "",
    },
    { strict: false }
  );
  await doc.save();

  if (emailCustomer) {
    const email = String(doc.email || "").trim();
    if (email.includes("@") && session.url) {
      try {
        await sendEmailDirect({
          title: `${brandName} — pay rental prepayment`,
          message: [
            `Hi ${doc.customerName || "there"},`,
            `Please pay the prepayment for your rental${carLabel ? ` (${carLabel})` : ""}:`,
            session.url,
            amounts.balanceMinor > 0
              ? `The remaining balance is paid on site at pickup.`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
          to: [email],
        });
      } catch (err) {
        console.error("[rental checkout] email failed", err?.message || err);
      }
    }
  }

  return {
    ok: true,
    reused: false,
    url: session.url,
    sessionId: session.id,
    order: doc.toObject(),
    mode: policy.mode,
    timing: policy.timing,
  };
}

export async function markRentalPaidFromCheckoutSession(session) {
  if (!session || session.payment_status !== "paid") {
    return { ok: false, code: "not_paid", message: "Session not paid" };
  }

  const orderId = session.metadata?.orderId || session.client_reference_id || "";
  if (!orderId) {
    return { ok: false, code: "missing_order", message: "No orderId on session" };
  }

  const doc = await Order.findById(orderId);
  if (!doc) {
    return { ok: false, code: "not_found", message: "Order not found" };
  }

  if (doc.payment?.status === "paid") {
    return { ok: true, idempotent: true, order: doc.toObject() };
  }

  const onSiteAmountMinor = Number(
    session.metadata?.onSiteAmountMinor ?? doc.payment?.onSiteAmountMinor ?? 0
  );

  doc.set(
    "payment",
    {
      ...(doc.payment && typeof doc.payment === "object" ? doc.payment : {}),
      status: "paid",
      amountMinor:
        Number(session.amount_total) || Number(doc.payment?.amountMinor) || 0,
      currency: String(
        session.currency || doc.payment?.currency || "EUR"
      ).toUpperCase(),
      provider: "stripe",
      providerPaymentId: session.id,
      collectionMode:
        session.metadata?.collectionMode ||
        doc.payment?.collectionMode ||
        RENTAL_COLLECTION_MODES.STRIPE_PREPAYMENT,
      onSiteAmountMinor,
      timing: session.metadata?.timing || doc.payment?.timing || "",
      paidAt: new Date(),
      notes:
        onSiteAmountMinor > 0
          ? `Prepayment paid. Balance on site: ${onSiteAmountMinor}`
          : "Prepayment paid in full",
    },
    { strict: false }
  );
  await doc.save();

  return { ok: true, idempotent: false, order: doc.toObject() };
}
