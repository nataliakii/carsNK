/**
 * Canonical Rovaro Booking Fee snapshot.
 *
 * One calculation for Checkout, webhook checks, emails, the Orders table,
 * exports, and refunds. The rate comes from the stored snapshot, or from
 * the configured platform/company fee when a snapshot does not exist yet.
 * Templates must not hardcode a percentage.
 *
 * Paid amounts already stored on an order are never rewritten from a later
 * change to the company or platform setting.
 */

import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { toMinorUnits } from "@/domain/money/minorUnits";
import {
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  bpsToPercentNumber,
  marketplacePlatformAmountMinor,
  resolveMarketplaceBookingFeeBps,
  snapshotMarketplaceBookingFeeBps,
} from "@/domain/orders/marketplaceBookingFee";

export const BOOKING_FEE_CALCULATION_VERSION = 1;

function minor(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function emptySnapshot() {
  return {
    calculationVersion: BOOKING_FEE_CALCULATION_VERSION,
    currency: "EUR",
    feeBps: null,
    feePercent: null,
    grossMinor: 0,
    bookingFeeMinor: 0,
    supplierBalanceMinor: 0,
    source: "empty",
  };
}

function isCompleteSnapshot(value) {
  return (
    value &&
    Number(value.calculationVersion) > 0 &&
    minor(value.grossMinor) > 0 &&
    Number.isFinite(Number(value.bookingFeeMinor))
  );
}

/**
 * Configured fee applied to a gross. Used for new bookings.
 */
export function buildBookingFinancialSnapshot({
  grossMinor,
  currency = "EUR",
  feeBps = DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
} = {}) {
  const gross = Math.max(0, Math.round(Number(grossMinor) || 0));
  const bps = Math.round(Number(feeBps) || DEFAULT_MARKETPLACE_BOOKING_FEE_BPS);
  const bookingFeeMinor = marketplacePlatformAmountMinor(gross, bps);
  const supplierBalanceMinor = Math.max(0, gross - bookingFeeMinor);
  return {
    calculationVersion: BOOKING_FEE_CALCULATION_VERSION,
    currency: String(currency || "EUR").trim().toUpperCase() || "EUR",
    feeBps: bps,
    feePercent: bpsToPercentNumber(bps),
    grossMinor: gross,
    bookingFeeMinor,
    supplierBalanceMinor,
    source: "configured",
  };
}

/**
 * Freeze the quote that was already calculated. Does not run a second rate.
 */
export function bookingFinancialSnapshotFromQuote(quote) {
  if (!quote) return emptySnapshot();
  const built = buildBookingFinancialSnapshot({
    grossMinor: quote.grossMinor,
    currency: quote.currency,
    feeBps:
      quote.marketplaceBookingFeeBps ?? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  });
  const quotedFee = minor(
    quote.platformAmountMinor ?? quote.prepaymentMinor ?? quote.stripeAmountMinor
  );
  if (quotedFee > 0 && quotedFee !== built.bookingFeeMinor) {
    return {
      ...built,
      bookingFeeMinor: quotedFee,
      supplierBalanceMinor: Math.max(0, built.grossMinor - quotedFee),
      feeBps: quote.marketplaceBookingFeeBps ?? built.feeBps,
      feePercent:
        quote.feePercent != null ? Number(quote.feePercent) : built.feePercent,
      source: "quote",
    };
  }
  return built;
}

function snapshotFromStoredAmounts(order) {
  const auth = order?.authoritativePrice || {};
  const paid = order?.paidMarketplaceFeeSnapshot || {};
  const currency = String(
    auth.currency || paid.currency || order?.currency || "EUR"
  )
    .trim()
    .toUpperCase() || "EUR";
  let grossMinor = minor(auth.grossMinor ?? paid.grossMinor);
  if (!grossMinor && order?.totalPrice != null) {
    grossMinor = toMinorUnits(order.totalPrice, currency) || 0;
  }
  if (!grossMinor) return null;

  const feeSnap = snapshotMarketplaceBookingFeeBps({
    ...auth,
    authoritativePrice: auth,
    marketplaceBookingFeeBps:
      auth.marketplaceBookingFeeBps ?? paid.marketplaceBookingFeeBps,
  });
  const bookingFeeMinor = minor(
    auth.platformAmountMinor ??
      auth.prepaymentMinor ??
      auth.stripeAmountMinor ??
      paid.platformAmountMinor
  );
  if (!bookingFeeMinor && feeSnap.source === "default") return null;
  const fee =
    bookingFeeMinor || marketplacePlatformAmountMinor(grossMinor, feeSnap.bps);
  // The stored gross and fee are the authoritative pair, so the balance always
  // follows supplierMinor = grossMinor - platformMinor. A consistent stored
  // balance is identical to this; one that disagrees is stale and would
  // understate what the customer still owes the rental company.
  const supplier = Math.max(0, grossMinor - fee);
  return {
    calculationVersion: BOOKING_FEE_CALCULATION_VERSION,
    currency,
    feeBps: feeSnap.bps,
    feePercent: bpsToPercentNumber(feeSnap.bps),
    grossMinor,
    bookingFeeMinor: fee,
    supplierBalanceMinor: supplier,
    source: "stored_amounts",
  };
}

/**
 * @param {object|null|undefined} order
 * @param {{ company?: object, platformSettings?: object, feeBps?: number }} [opts]
 *   feeBps / company / platformSettings apply only when the order has no stored amounts.
 */
export function resolveBookingFinancialSnapshot(order, opts = {}) {
  if (!order) return emptySnapshot();
  if (isCompleteSnapshot(order.bookingFinancialSnapshot)) {
    const stored = order.bookingFinancialSnapshot;
    return {
      calculationVersion: Number(stored.calculationVersion),
      currency: String(stored.currency || "EUR").toUpperCase(),
      feeBps: Number(stored.feeBps),
      feePercent: Number(stored.feePercent),
      grossMinor: minor(stored.grossMinor),
      bookingFeeMinor: Math.round(Number(stored.bookingFeeMinor) || 0),
      supplierBalanceMinor: Math.round(Number(stored.supplierBalanceMinor) || 0),
      source: "snapshot",
    };
  }

  const marketplace = isMarketplaceRequestMode(order.bookingMode);
  const stored = snapshotFromStoredAmounts(order);
  if (stored) return stored;
  if (!marketplace) return emptySnapshot();

  const grossMinor =
    stored?.grossMinor ||
    minor(order?.authoritativePrice?.grossMinor) ||
    toMinorUnits(order?.totalPrice, order?.currency || "EUR") ||
    0;
  if (!grossMinor) return emptySnapshot();

  const fee =
    opts.feeBps != null
      ? { bps: Math.round(Number(opts.feeBps)) }
      : resolveMarketplaceBookingFeeBps(opts.company, opts.platformSettings);
  return buildBookingFinancialSnapshot({
    grossMinor,
    currency: order?.authoritativePrice?.currency || order?.currency || "EUR",
    feeBps: fee.bps,
  });
}

export function formatSnapshotMoney(minorUnits, currency = "EUR") {
  const amount = (Number(minorUnits) || 0) / 100;
  const formatted = amount.toFixed(2);
  if (String(currency || "EUR").toUpperCase() === "EUR") return `€${formatted}`;
  return `${String(currency || "").toUpperCase()} ${formatted}`;
}

/**
 * Refund the snapshotted Booking Fee, never more than Stripe captured.
 */
export function bookingFeeMinorForRefund(order) {
  const captured = Math.round(
    Number(order?.payment?.netPaidAmountMinor) > 0
      ? Number(order.payment.netPaidAmountMinor)
      : Number(order?.payment?.paidAmountMinor || order?.payment?.amountMinor || 0)
  );
  if (!Number.isFinite(captured) || captured <= 0) return 0;
  const snap = resolveBookingFinancialSnapshot(order);
  if (snap.bookingFeeMinor > 0) return Math.min(snap.bookingFeeMinor, captured);
  return captured;
}

/**
 * Remember the resolved snapshot on the order document without a second save.
 * Does not replace a snapshot that is already stored.
 */
export function attachBookingFinancialSnapshot(order, opts = {}) {
  if (!order) return emptySnapshot();
  if (isCompleteSnapshot(order.bookingFinancialSnapshot)) {
    return resolveBookingFinancialSnapshot(order);
  }
  const snap = resolveBookingFinancialSnapshot(order, opts);
  if (!snap.grossMinor) return snap;
  if (typeof order.set === "function") {
    order.set("bookingFinancialSnapshot", snap, { strict: false });
  } else {
    order.bookingFinancialSnapshot = snap;
  }
  return snap;
}
