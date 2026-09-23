/**
 * Spain marketplace gross-price revision.
 *
 * Before successful payment: recalculate the Rovaro fee from the snapshotted
 * booking-fee bps (never the company's current override).
 * After successful payment: the paid fee is immutable; only the supplier
 * balance moves with the revised gross.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import {
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import {
  marketplacePlatformAmountMinor,
  snapshotMarketplaceBookingFeeBps,
} from "@/domain/orders/marketplaceBookingFee";
import { marketplaceFinancialSplit } from "@/domain/orders/marketplaceFinancialSplit";

export const MARKETPLACE_PRICE_CORRECTED_AFTER_PAYMENT =
  "MARKETPLACE_PRICE_CORRECTED_AFTER_PAYMENT";

export const PRICE_CORRECTION_CODE = Object.freeze({
  NOT_MARKETPLACE: "not_marketplace",
  INVALID_AMOUNT: "invalid_amount",
  CURRENCY_MISMATCH: "currency_mismatch",
  BELOW_PAID_FEE: "below_paid_fee",
  ZERO_SUPPLIER_UNCONFIRMED: "zero_supplier_unconfirmed",
  NEGATIVE_SUPPLIER: "negative_supplier",
  REASON_REQUIRED: "reason_required",
  FORBIDDEN: "forbidden",
  TERMINAL: "terminal",
  REFUNDED: "refunded",
  ALREADY_PAID_REISSUE: "already_paid_reissue",
});

function integerMinor(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : null;
}

function nonNegMinor(value) {
  const n = integerMinor(value);
  return n != null && n >= 0 ? n : 0;
}

export function isMarketplaceFeePaid(order) {
  if (!isMarketplaceRequestMode(order?.bookingMode)) return false;
  if (String(order?.payment?.status || "") !== "paid") return false;
  return paidPlatformAmountMinor(order) > 0;
}

export function paidPlatformAmountMinor(order) {
  const snap = order?.paidMarketplaceFeeSnapshot;
  const fromSnap = integerMinor(snap?.platformAmountMinor ?? snap?.amountMinor);
  if (fromSnap != null && fromSnap > 0) return fromSnap;
  const pay = order?.payment || {};
  const fromPay = integerMinor(
    pay.paidAmountMinor ?? pay.amountMinor ?? pay.stripeAmountMinor
  );
  if (fromPay != null && fromPay > 0) return fromPay;
  const auth = order?.authoritativePrice || {};
  return nonNegMinor(
    auth.platformAmountMinor ?? auth.prepaymentMinor ?? auth.stripeAmountMinor
  );
}

export function capturePaidMarketplaceFeeSnapshot(order, { now = new Date() } = {}) {
  if (order?.paidMarketplaceFeeSnapshot?.platformAmountMinor) {
    return { ...order.paidMarketplaceFeeSnapshot };
  }
  const auth = order?.authoritativePrice || {};
  const pay = order?.payment || {};
  const split = marketplaceFinancialSplit({
    ...auth,
    currency: auth.currency || pay.currency || order?.currency || "EUR",
  });
  return {
    platformAmountMinor: split.platformAmountMinor,
    stripeAmountMinor: split.stripeAmountMinor,
    prepaymentMinor: split.prepaymentMinor,
    marketplaceBookingFeeBps: split.marketplaceBookingFeeBps,
    currency: split.currency,
    amountMinor: split.platformAmountMinor,
    providerPaymentId: String(pay.providerPaymentId || ""),
    paidAt: pay.paidAt || now,
    capturedAt: now,
  };
}

function isTerminalCorrectionState(order) {
  const status = String(order?.bookingStatus || "");
  const rental = resolveRentalState(order);
  if (
    status === BOOKING_STATUS.CUSTOMER_CANCELLED ||
    status === BOOKING_STATUS.SUPPLIER_CANCELLED ||
    status === BOOKING_STATUS.ADMIN_CANCELLED ||
    status === BOOKING_STATUS.SUPPLIER_DECLINED ||
    rental === RENTAL_STATE.CANCELLED ||
    rental === RENTAL_STATE.DECLINED
  ) {
    return true;
  }
  return false;
}

function isRefunded(order) {
  const status = String(order?.payment?.refundStatus || "");
  const payStatus = String(order?.payment?.status || "");
  return (
    status === "full" ||
    payStatus === "refunded" ||
    (Number(order?.payment?.refundedAmountMinor || 0) > 0 &&
      Number(order?.payment?.netPaidAmountMinor || 0) <= 0)
  );
}

export function splitMarketplaceGrossRevision({
  grossMinor,
  feeBps,
  currency = "EUR",
  fixedPaidPlatformAmountMinor = null,
} = {}) {
  const gross = nonNegMinor(grossMinor);
  const platform =
    fixedPaidPlatformAmountMinor != null
      ? nonNegMinor(fixedPaidPlatformAmountMinor)
      : marketplacePlatformAmountMinor(gross, feeBps);
  const supplier = gross - platform;
  return {
    currency: String(currency || "EUR").trim().toUpperCase() || "EUR",
    grossMinor: gross,
    marketplaceBookingFeeBps: Math.round(Number(feeBps) || 0),
    platformAmountMinor: platform,
    stripeAmountMinor: platform,
    prepaymentMinor: platform,
    supplierBalanceMinor: supplier,
    balanceMinor: supplier,
    payoutMinor: 0,
  };
}

/**
 * Pure preview / validation. Does not write or call Stripe.
 */
export function previewMarketplaceGrossRevision({
  order,
  revisedGrossMinor,
  reason,
  actorRole = "",
  confirmZeroSupplierBalance = false,
  currency: requestedCurrency,
  now = new Date(),
} = {}) {
  if (!isMarketplaceRequestMode(order?.bookingMode)) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.NOT_MARKETPLACE,
      message: "Price correction applies only to Spain marketplace bookings.",
    };
  }
  if (String(actorRole || "").toUpperCase() !== "SUPERADMIN") {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.FORBIDDEN,
      message: "Only a SUPERADMIN can correct a marketplace total.",
    };
  }
  if (!String(reason || "").trim()) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.REASON_REQUIRED,
      message: "A reason is required.",
    };
  }
  if (isTerminalCorrectionState(order)) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.TERMINAL,
      message: "This booking cannot be price-corrected in its current state.",
    };
  }
  if (isRefunded(order)) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.REFUNDED,
      message: "A refunded booking cannot be price-corrected.",
    };
  }

  const revised = integerMinor(revisedGrossMinor);
  if (revised == null || revised < 0) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.INVALID_AMOUNT,
      message: "Enter a valid non-negative total.",
    };
  }

  const auth = order?.authoritativePrice || {};
  const paid = isMarketplaceFeePaid(order);
  const snapshotBps = snapshotMarketplaceBookingFeeBps(order).bps;
  const previousSplit = marketplaceFinancialSplit({
    ...auth,
    currency: auth.currency || order?.currency || "EUR",
    grossMinor: nonNegMinor(auth.grossMinor || Math.round(Number(order?.totalPrice || 0) * 100)),
  });
  const currency = previousSplit.currency;
  const paidCurrency = String(
    order?.paidMarketplaceFeeSnapshot?.currency ||
      order?.payment?.currency ||
      currency
  )
    .trim()
    .toUpperCase();
  const incomingCurrency = requestedCurrency
    ? String(requestedCurrency).trim().toUpperCase()
    : "";
  if (incomingCurrency && incomingCurrency !== currency) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.CURRENCY_MISMATCH,
      message: "Currency cannot change after the booking is priced.",
    };
  }
  if (paid && paidCurrency && paidCurrency !== currency) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.CURRENCY_MISMATCH,
      message: "Currency cannot change after the booking is priced.",
    };
  }

  const paidPlatform = paid ? paidPlatformAmountMinor(order) : null;
  if (paid && paidPlatform > 0 && revised < paidPlatform) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.BELOW_PAID_FEE,
      message: "The new total cannot be below the amount already paid online.",
    };
  }

  const nextSplit = splitMarketplaceGrossRevision({
    grossMinor: revised,
    feeBps: snapshotBps,
    currency,
    fixedPaidPlatformAmountMinor: paid ? paidPlatform : null,
  });

  if (nextSplit.supplierBalanceMinor < 0) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.NEGATIVE_SUPPLIER,
      message: "The amount to collect cannot be negative.",
    };
  }
  if (nextSplit.supplierBalanceMinor === 0 && !confirmZeroSupplierBalance) {
    return {
      ok: false,
      code: PRICE_CORRECTION_CODE.ZERO_SUPPLIER_UNCONFIRMED,
      message: "Confirm that the rental company should collect €0.",
    };
  }

  const revision = {
    previousGrossMinor: previousSplit.grossMinor,
    revisedGrossMinor: nextSplit.grossMinor,
    fixedPaidPlatformAmountMinor: paid
      ? paidPlatform
      : nextSplit.platformAmountMinor,
    previousSupplierBalanceMinor: previousSplit.supplierBalanceMinor,
    revisedSupplierBalanceMinor: nextSplit.supplierBalanceMinor,
    currency,
    reason: String(reason).trim().slice(0, 500),
    actor: "",
    timestamp: now,
    pricingVersion: Number(auth.pricingVersion || order?.pricingVersion || 1) + 1,
    paid,
    marketplaceBookingFeeBps: snapshotBps,
  };

  const nextAuthoritativePrice = {
    ...auth,
    currency,
    grossMinor: nextSplit.grossMinor,
    prepaymentMinor: nextSplit.prepaymentMinor,
    balanceMinor: nextSplit.balanceMinor,
    platformAmountMinor: nextSplit.platformAmountMinor,
    stripeAmountMinor: nextSplit.stripeAmountMinor,
    supplierBalanceMinor: nextSplit.supplierBalanceMinor,
    marketplaceBookingFeeBps: snapshotBps,
    feePercent: Number((snapshotBps / 100).toFixed(2)),
    prepaymentPercent: Number((snapshotBps / 100).toFixed(2)),
    pricingVersion: revision.pricingVersion,
    calculatedAt: now,
    manualAdjustmentMinor: nextSplit.grossMinor - previousSplit.grossMinor
      + (integerMinor(auth.manualAdjustmentMinor) || 0),
  };

  return {
    ok: true,
    paid,
    previousGrossMinor: previousSplit.grossMinor,
    revisedGrossMinor: nextSplit.grossMinor,
    fixedPaidPlatformAmountMinor: revision.fixedPaidPlatformAmountMinor,
    previousSupplierBalanceMinor: previousSplit.supplierBalanceMinor,
    revisedSupplierBalanceMinor: nextSplit.supplierBalanceMinor,
    currency,
    marketplaceBookingFeeBps: snapshotBps,
    createsCheckoutSession: false,
    createsRefund: false,
    nextAuthoritativePrice,
    revision,
    nextTotalMajor: nextSplit.grossMinor / 100,
  };
}

export function appendPriceRevision(existing, revision) {
  const history = Array.isArray(existing) ? existing.slice() : [];
  history.push({ ...revision });
  return history;
}

export function marketplacePaidSnapshotUnchanged(before, after) {
  const a = before?.paidMarketplaceFeeSnapshot || {};
  const b = after?.paidMarketplaceFeeSnapshot || {};
  if (!a.platformAmountMinor && !b.platformAmountMinor) return true;
  return (
    Number(a.platformAmountMinor) === Number(b.platformAmountMinor) &&
    Number(a.stripeAmountMinor) === Number(b.stripeAmountMinor) &&
    Number(a.marketplaceBookingFeeBps) === Number(b.marketplaceBookingFeeBps) &&
    String(a.providerPaymentId || "") === String(b.providerPaymentId || "") &&
    String(a.paidAt || "") === String(b.paidAt || "")
  );
}
