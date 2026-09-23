/**
 * Per-company rental (car hire) payment policy.
 *
 * - stripeEnabled=false → company collects on site / by fact
 * - stripeEnabled=true → charge prepayment online via Stripe
 * - timing: before_confirm | after_confirm
 *
 * Spain MARKETPLACE_REQUEST bookings do NOT collect the Rovaro Booking Fee at
 * create. Stripe Checkout is created only after the car owner confirms
 * availability. Greece / ops-calendar company flags (stripeEnabled,
 * before_confirm / after_confirm) stay in force for non-marketplace orders.
 */

import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { marketplaceFinancialSplit } from "@/domain/orders/marketplaceFinancialSplit";

export const RENTAL_PAYMENT_TIMING = Object.freeze({
  BEFORE_CONFIRM: "before_confirm",
  AFTER_CONFIRM: "after_confirm",
});

export const RENTAL_COLLECTION_MODES = Object.freeze({
  STRIPE_PREPAYMENT: "stripe_prepayment",
  ON_SITE: "on_site",
});

export const PAYMENT_LINK_STATUS = Object.freeze({
  READY: "ready",
  NOT_REQUIRED: "not_required",
  NOT_CONFIGURED: "not_configured",
  AMOUNT_TOO_LOW: "amount_too_low",
  FAILED: "failed",
});

/**
 * @param {object|null|undefined} company
 */
export function getCompanyRentalPaymentFlags(company) {
  const rp = company?.rentalPayments || {};
  const timingRaw = String(rp.timing || RENTAL_PAYMENT_TIMING.AFTER_CONFIRM)
    .trim()
    .toLowerCase();
  const timing =
    timingRaw === RENTAL_PAYMENT_TIMING.BEFORE_CONFIRM
      ? RENTAL_PAYMENT_TIMING.BEFORE_CONFIRM
      : RENTAL_PAYMENT_TIMING.AFTER_CONFIRM;

  return {
    stripeEnabled: Boolean(rp.stripeEnabled),
    timing,
  };
}

/**
 * @param {object|null|undefined} company
 * @param {{ stripeConfigured?: boolean, bookingMode?: string }} [opts]
 */
export function resolveCompanyRentalPaymentPolicy(
  company,
  { stripeConfigured = true, bookingMode } = {}
) {
  const flags = getCompanyRentalPaymentFlags(company);
  const marketplace = isMarketplaceRequestMode(bookingMode);

  if (!stripeConfigured) {
    return {
      mode: RENTAL_COLLECTION_MODES.ON_SITE,
      stripeEnabled: false,
      useStripe: false,
      timing: marketplace
        ? RENTAL_PAYMENT_TIMING.BEFORE_CONFIRM
        : flags.timing,
      collectOnSite: true,
    };
  }

  if (marketplace) {
    return {
      mode: RENTAL_COLLECTION_MODES.STRIPE_PREPAYMENT,
      stripeEnabled: true,
      useStripe: true,
      timing: RENTAL_PAYMENT_TIMING.AFTER_CONFIRM,
      collectOnSite: false,
    };
  }

  if (!flags.stripeEnabled) {
    return {
      mode: RENTAL_COLLECTION_MODES.ON_SITE,
      stripeEnabled: false,
      useStripe: false,
      timing: flags.timing,
      collectOnSite: true,
    };
  }

  return {
    mode: RENTAL_COLLECTION_MODES.STRIPE_PREPAYMENT,
    stripeEnabled: true,
    useStripe: true,
    timing: flags.timing,
    collectOnSite: false,
  };
}

/**
 * Prepayment amount for Checkout (minor units).
 * @param {object} order
 * @returns {{ amountMinor: number, currency: string, balanceMinor: number }}
 */
export function resolveRentalCheckoutAmount(order) {
  const auth = order?.authoritativePrice || {};
  if (isMarketplaceRequestMode(order?.bookingMode)) {
    const split = marketplaceFinancialSplit({
      ...auth,
      currency: auth.currency || order?.currency || "EUR",
    });
    return {
      amountMinor: split.stripeAmountMinor,
      currency: split.currency,
      balanceMinor: split.supplierBalanceMinor,
      grossMinor: split.grossMinor,
      platformAmountMinor: split.platformAmountMinor,
      stripeAmountMinor: split.stripeAmountMinor,
      supplierBalanceMinor: split.supplierBalanceMinor,
      payoutMinor: split.payoutMinor,
      marketplaceBookingFeeBps: split.marketplaceBookingFeeBps,
      feePercent: split.feePercent,
    };
  }

  const currency = String(
    auth.currency || order?.currency || "EUR"
  )
    .trim()
    .toUpperCase();

  let prepaymentMinor = Math.round(Number(auth.prepaymentMinor) || 0);
  const grossMinor = Math.round(Number(auth.grossMinor) || 0);
  let balanceMinor = Math.round(Number(auth.balanceMinor) || 0);

  if (prepaymentMinor <= 0 && grossMinor > 0) {
    // Greece / ops: no configured prepayment % → nothing to charge online
    balanceMinor = grossMinor;
  }

  return {
    amountMinor: Math.max(0, prepaymentMinor),
    currency,
    balanceMinor: Math.max(0, balanceMinor),
    grossMinor: Math.max(0, grossMinor),
  };
}

/**
 * Should we create a Checkout link right after order create?
 * Public client bookings (including a superadmin testing the storefront)
 * still get a pay link. Internal/offline admin orders do not.
 */
export function shouldChargeRentalOnCreate(
  policy,
  {
    isAdminSession = false,
    offline = false,
    isClientOrder = false,
    bookingMode,
  } = {}
) {
  if (offline) return false;
  if (isAdminSession && !isClientOrder) return false;
  if (!policy?.useStripe) return false;
  if (isMarketplaceRequestMode(bookingMode)) return false;
  return policy.timing === RENTAL_PAYMENT_TIMING.BEFORE_CONFIRM;
}

/**
 * Should we create a Checkout link right after admin confirm?
 */
export function shouldChargeRentalOnConfirm(policy, { bookingMode } = {}) {
  if (!policy?.useStripe) return false;
  if (isMarketplaceRequestMode(bookingMode)) return false;
  return policy.timing === RENTAL_PAYMENT_TIMING.AFTER_CONFIRM;
}

/**
 * Block confirm until online prepayment is paid (before_confirm mode).
 */
export function isRentalConfirmBlockedByPayment(order, policy) {
  if (!policy?.useStripe) return false;
  if (policy.timing !== RENTAL_PAYMENT_TIMING.BEFORE_CONFIRM) return false;
  if (order?.payment?.status === "paid") return false;
  if (order?.payment?.status === "not_required") return false;
  const amount = resolveRentalCheckoutAmount(order).amountMinor;
  if (amount < 50) return false;
  return true;
}

export default resolveCompanyRentalPaymentPolicy;
