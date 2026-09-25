/**
 * What a superadmin may put in front of a customer, and for how much, when she
 * sends a payment link by hand.
 *
 * Rehoming a declined booking is a manual process: Rovaro moves the customer to
 * another supplier, agrees the vehicle off-platform, and then needs a payment
 * link on its own timing at an amount that fits the situation. This module
 * answers the two questions that surround that send — what is the canonical
 * amount, and is the amount she typed acceptable — and nothing else. It does
 * not create sessions, send mail or write to the database.
 *
 * Reused, never duplicated:
 *   fee rate per company → domain/orders/marketplaceBookingFee.js
 *   canonical amounts    → domain/orders/bookingFinancialSnapshot.js
 *   the revision itself  → domain/orders/marketplacePriceCorrection.js
 *
 * Pure: no mongoose, no session, no React.
 */

import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import {
  bpsToPercentNumber,
  formatMarketplaceFeePercent,
  marketplacePlatformAmountMinor,
  marketplaceSupplierBalanceMinor,
} from "@/domain/orders/marketplaceBookingFee";
import { resolveBookingFinancialSnapshot } from "@/domain/orders/bookingFinancialSnapshot";
import { previewMarketplaceGrossRevision } from "@/domain/orders/marketplacePriceCorrection";

export const MANUAL_PAYMENT_LINK_CODE = Object.freeze({
  NOT_PLATFORM: "not_platform_booking",
  NOT_MARKETPLACE: "not_marketplace",
  NO_CANONICAL_AMOUNT: "no_canonical_amount",
  INVALID_AMOUNT: "invalid_amount",
  ZERO_AMOUNT: "zero_amount",
  BELOW_MINIMUM_CHARGE: "below_minimum_charge",
  ABSURD_AMOUNT: "absurd_amount",
  CURRENCY_MISMATCH: "currency_mismatch",
  REASON_REQUIRED: "reason_required",
});

/**
 * Stripe refuses a Checkout Session below its per-currency minimum, so an
 * amount whose booking fee lands under it would produce a link that cannot be
 * paid. Refused here rather than at Stripe, where the failure is opaque.
 */
export const MIN_CHARGEABLE_MINOR = 50;

/**
 * A hand-typed total is a fat-finger risk in both directions. €50,000 is far
 * above any rental Rovaro brokers, so a larger figure is a typo, not a price.
 */
export const MAX_MANUAL_GROSS_MINOR = 5_000_000;

/** Request-body keys that carry the superadmin's price authority. */
export const SUPERADMIN_AMOUNT_KEYS = Object.freeze({
  grossMinor: "superadminGrossMinor",
  reason: "superadminAmountReason",
});

function integerMinor(value) {
  if (value == null || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : null;
}

function normaliseCurrency(value, fallback = "EUR") {
  const code = String(value || "").trim().toUpperCase();
  return code || fallback;
}

/**
 * The amount the button offers before she touches it: the order's own snapshot
 * and the rate that snapshot was taken at, never a fresh calculation and never
 * a literal percentage.
 *
 * @param {object|null} order
 * @param {{ company?: object, platformSettings?: object }} [opts]
 */
export function prefillManualPaymentLinkAmount(order, opts = {}) {
  const snapshot = resolveBookingFinancialSnapshot(order, opts);
  const currency = normaliseCurrency(snapshot.currency);
  const grossMinor = Math.max(0, integerMinor(snapshot.grossMinor) || 0);
  const feeBps = Number(snapshot.feeBps) > 0 ? Math.round(Number(snapshot.feeBps)) : 0;
  const bookingFeeMinor =
    integerMinor(snapshot.bookingFeeMinor) ??
    marketplacePlatformAmountMinor(grossMinor, feeBps);

  return {
    currency,
    grossMinor,
    feeBps,
    feePercent: feeBps > 0 ? bpsToPercentNumber(feeBps) : null,
    feePercentLabel: feeBps > 0 ? formatMarketplaceFeePercent(feeBps) : "",
    bookingFeeMinor,
    supplierBalanceMinor: marketplaceSupplierBalanceMinor(grossMinor, bookingFeeMinor),
    /** Where the numbers came from: snapshot, stored_amounts, quote, configured. */
    source: snapshot.source,
    available: grossMinor > 0,
  };
}

function refuse(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

/**
 * Is this amount safe to charge, and does it need to be flagged to her?
 *
 * A changed amount is routed through `previewMarketplaceGrossRevision`, so the
 * split, the currency rule and the already-paid floor stay in the one module
 * that owns price revisions. This function adds only the guards that belong to
 * a hand-typed figure: zero, absurd, and under Stripe's floor.
 *
 * @param {{
 *   order: object,
 *   requestedGrossMinor?: number|null,
 *   requestedCurrency?: string,
 *   reason?: string,
 *   confirmZeroSupplierBalance?: boolean,
 *   company?: object,
 *   platformSettings?: object,
 *   now?: Date,
 * }} input
 */
export function evaluateManualPaymentLinkAmount({
  order,
  requestedGrossMinor = null,
  requestedCurrency = "",
  reason = "",
  confirmZeroSupplierBalance = false,
  company,
  platformSettings,
  now = new Date(),
} = {}) {
  if (!isPlatformBooking(order)) {
    return refuse(
      MANUAL_PAYMENT_LINK_CODE.NOT_PLATFORM,
      "Internal company bookings carry no Rovaro payment."
    );
  }
  if (!isMarketplaceRequestMode(order?.bookingMode)) {
    return refuse(
      MANUAL_PAYMENT_LINK_CODE.NOT_MARKETPLACE,
      "Payment links belong to marketplace bookings only."
    );
  }

  const prefill = prefillManualPaymentLinkAmount(order, {
    company,
    platformSettings,
  });
  if (!prefill.available) {
    return refuse(
      MANUAL_PAYMENT_LINK_CODE.NO_CANONICAL_AMOUNT,
      "This booking has no priced total to charge against.",
      { prefill }
    );
  }

  const requested = integerMinor(requestedGrossMinor);
  const changed = requested != null && requested !== prefill.grossMinor;

  if (requested == null) {
    return {
      ok: true,
      changed: false,
      prefill,
      grossMinor: prefill.grossMinor,
      currency: prefill.currency,
      bookingFeeMinor: prefill.bookingFeeMinor,
      supplierBalanceMinor: prefill.supplierBalanceMinor,
      feeBps: prefill.feeBps,
      flags: noFlags(),
      revision: null,
    };
  }

  const incomingCurrency = normaliseCurrency(requestedCurrency, prefill.currency);
  if (incomingCurrency !== prefill.currency) {
    return refuse(
      MANUAL_PAYMENT_LINK_CODE.CURRENCY_MISMATCH,
      "The currency cannot change after the booking is priced.",
      { prefill }
    );
  }
  if (requested <= 0) {
    return refuse(
      MANUAL_PAYMENT_LINK_CODE.ZERO_AMOUNT,
      "A payment link needs an amount above zero. To charge nothing, do not send a link.",
      { prefill }
    );
  }
  if (requested > MAX_MANUAL_GROSS_MINOR) {
    return refuse(
      MANUAL_PAYMENT_LINK_CODE.ABSURD_AMOUNT,
      "That total is far above any rental Rovaro brokers. Check the figure.",
      { prefill }
    );
  }
  if (changed && !String(reason || "").trim()) {
    return refuse(
      MANUAL_PAYMENT_LINK_CODE.REASON_REQUIRED,
      "Changing the amount needs a reason, so the order reconciles afterwards.",
      { prefill }
    );
  }

  if (!changed) {
    return {
      ok: true,
      changed: false,
      prefill,
      grossMinor: prefill.grossMinor,
      currency: prefill.currency,
      bookingFeeMinor: prefill.bookingFeeMinor,
      supplierBalanceMinor: prefill.supplierBalanceMinor,
      feeBps: prefill.feeBps,
      flags: noFlags(),
      revision: null,
    };
  }

  const preview = previewMarketplaceGrossRevision({
    order,
    revisedGrossMinor: requested,
    reason,
    actorRole: "SUPERADMIN",
    confirmZeroSupplierBalance,
    currency: incomingCurrency,
    now,
  });
  if (!preview.ok) {
    return { ok: false, code: preview.code, message: preview.message, prefill };
  }

  const bookingFeeMinor = Math.max(
    0,
    preview.revisedGrossMinor - preview.revisedSupplierBalanceMinor
  );
  if (bookingFeeMinor > 0 && bookingFeeMinor < MIN_CHARGEABLE_MINOR) {
    return refuse(
      MANUAL_PAYMENT_LINK_CODE.BELOW_MINIMUM_CHARGE,
      "The booking payment would be too small for the card processor to accept.",
      { prefill }
    );
  }

  return {
    ok: true,
    changed: true,
    prefill,
    grossMinor: preview.revisedGrossMinor,
    currency: preview.currency,
    bookingFeeMinor,
    supplierBalanceMinor: preview.revisedSupplierBalanceMinor,
    feeBps: preview.marketplaceBookingFeeBps,
    flags: {
      ...noFlags(),
      // She is entitled to discount the booking, but the fee moves with the
      // gross, so a lower total quietly lowers what Rovaro earns on a contract
      // that was negotiated at this rate. Surfaced, never blocked.
      feeReductionMinor: Math.max(0, prefill.bookingFeeMinor - bookingFeeMinor),
      belowContractedFee: bookingFeeMinor < prefill.bookingFeeMinor,
      reducesSupplierBalance:
        preview.revisedSupplierBalanceMinor < prefill.supplierBalanceMinor,
      alreadyPaid: preview.paid === true,
    },
    revision: preview.revision,
  };
}

function noFlags() {
  return {
    feeReductionMinor: 0,
    belowContractedFee: false,
    reducesSupplierBalance: false,
    alreadyPaid: false,
  };
}

/**
 * Map an already-authorised request body into the trusted amount override.
 *
 * Only a caller that has checked the session and the capability may call this.
 * It reads exactly the two declared keys, so a body cannot smuggle a price in
 * under another name, and the orchestrator never reads the body itself.
 *
 * @param {object} body
 * @returns {{ grossMinor: number, reason: string }|null}
 */
export function superadminAmountFromTrustedBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body[SUPERADMIN_AMOUNT_KEYS.grossMinor];
  const grossMinor = integerMinor(raw);
  if (grossMinor == null) return null;
  return {
    grossMinor,
    reason: String(body[SUPERADMIN_AMOUNT_KEYS.reason] || "").trim(),
  };
}

/**
 * Everything a money display needs to say "this is an override, not the
 * calculated price". Reads the recorded revisions; invents nothing.
 *
 * @param {object|null} order
 */
export function resolvePriceOverrideNotice(order) {
  const revisions = Array.isArray(order?.priceRevisions)
    ? order.priceRevisions.filter(Boolean)
    : [];
  if (!revisions.length) {
    return { overridden: false, count: 0 };
  }
  const latest = revisions[revisions.length - 1];
  const currency = normaliseCurrency(
    latest.currency || order?.authoritativePrice?.currency || order?.currency
  );
  return {
    overridden: true,
    count: revisions.length,
    currency,
    previousGrossMinor: integerMinor(latest.previousGrossMinor) || 0,
    revisedGrossMinor: integerMinor(latest.revisedGrossMinor) || 0,
    originalGrossMinor: integerMinor(revisions[0]?.previousGrossMinor) || 0,
    actor: String(latest.actor || ""),
    at: latest.timestamp || null,
    reason: String(latest.reason || ""),
    paid: latest.paid === true,
  };
}
