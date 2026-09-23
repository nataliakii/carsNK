/**
 * Spain marketplace money split.
 *
 * Stripe charges the customer the snapshotted Rovaro Booking Fee (default
 * 10% = 1000 bps of the authoritative gross) into Rovaro's own Stripe
 * account. Rovaro retains that fee in full. The supplier collects the
 * remaining balance directly from the customer and must never collect 100%
 * again. There is no Stripe Connect, no supplier payout, and no second
 * commission.
 *
 *   platformMinor = round(grossMinor * feeBps / 10000)
 *   supplierMinor = grossMinor - platformMinor
 *
 * Stored `authoritativePrice` minor units are preferred when present so a
 * snapshot is never rewritten from the company's current setting.
 */

import { toMinorUnits } from "@/domain/money/minorUnits";
import {
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  marketplacePlatformAmountMinor,
  snapshotMarketplaceBookingFeeBps,
} from "@/domain/orders/marketplaceBookingFee";

export const MARKETPLACE_PAYOUT_MINOR = 0;

function minor(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * @param {object} [source] authoritativePrice, quote, or financials
 * @param {{ feeBps?: number }} [opts] only used when amounts are not stored
 */
export function marketplaceFinancialSplit(source = {}, opts = {}) {
  const currency = String(source.currency || "EUR").trim().toUpperCase() || "EUR";
  const grossMinor = minor(source.grossMinor);
  const storedPlatform = minor(
    source.prepaymentMinor ?? source.platformAmountMinor ?? source.stripeAmountMinor
  );
  const storedSupplier = minor(
    source.balanceMinor ?? source.supplierBalanceMinor
  );

  const snapshot = snapshotMarketplaceBookingFeeBps({
    ...source,
    marketplaceBookingFeeBps:
      source.marketplaceBookingFeeBps ?? opts.feeBps,
    authoritativePrice: source,
  });
  const feeBps = storedPlatform
    ? snapshot.bps
    : Number(opts.feeBps) > 0
      ? Math.round(Number(opts.feeBps))
      : snapshot.bps;

  const platformAmountMinor = storedPlatform
    ? storedPlatform
    : marketplacePlatformAmountMinor(grossMinor, feeBps);
  const supplierBalanceMinor = storedSupplier
    ? storedSupplier
    : Math.max(0, grossMinor - platformAmountMinor);

  const feePercent = Number((feeBps / 100).toFixed(2));
  const supplierBalancePercent = Number(((10000 - feeBps) / 100).toFixed(2));

  return {
    currency,
    marketplaceBookingFeeBps: feeBps,
    feePercent,
    supplierBalanceBps: 10000 - feeBps,
    supplierBalancePercent,
    prepaymentPercent: feePercent,
    grossMinor,
    prepaymentMinor: platformAmountMinor,
    balanceMinor: supplierBalanceMinor,
    stripeAmountMinor: platformAmountMinor,
    platformAmountMinor,
    supplierBalanceMinor,
    payoutMinor: MARKETPLACE_PAYOUT_MINOR,
  };
}

/** Integer split from a major-unit gross (display only). */
export function marketplaceFinancialSplitFromMajor(
  grossMajor,
  currency = "EUR",
  { feeBps } = {}
) {
  const grossMinor = toMinorUnits(grossMajor, currency) || 0;
  return marketplaceFinancialSplit({ grossMinor, currency, marketplaceBookingFeeBps: feeBps }, { feeBps });
}

export function formatMarketplaceEuro(minor) {
  const amount = (Number(minor) || 0) / 100;
  const formatted = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2);
  return `€${formatted}`;
}

export function marketplaceFeeNotice(locale = "en", amountMinor) {
  const amount = formatMarketplaceEuro(amountMinor);
  const lang = String(locale || "en").slice(0, 2);
  if (lang === "es") {
    return `${amount} tasa de reserva Rovaro · No reembolsable`;
  }
  return `${amount} Rovaro booking fee · Non-refundable`;
}

export function marketplaceSplitLabels(locale = "en") {
  const lang = String(locale || "en").slice(0, 2);
  if (lang === "es") {
    return {
      total: "Total",
      payNow: "Pagar ahora",
      payAtPickup: "Pagar en la recogida",
      paidToRovaro: "Pagado a Rovaro",
      collectFromCustomer: "Cobrar al cliente",
      paidOnline: "Pagar ahora",
      remaining: "Pagar en la recogida",
      creditNote: "",
      youCollect: "",
      paidOnlineShort: "Tasa de reserva Rovaro",
      bookingTerms: "Condiciones de reserva",
      partnerTerms: "Condiciones para partners",
      feeHelper:
        "El cliente paga este importe online. La empresa de alquiler cobra el resto.",
    };
  }
  return {
    total: "Total",
    payNow: "Pay now",
    payAtPickup: "Pay at pickup",
    paidToRovaro: "Paid to Rovaro",
    collectFromCustomer: "Collect from customer",
    paidOnline: "Pay now",
    remaining: "Pay at pickup",
    creditNote: "",
    youCollect: "",
    paidOnlineShort: "Rovaro booking fee",
    bookingTerms: "Booking Terms",
    partnerTerms: "Partner terms",
    feeHelper:
      "Customer pays this amount online. The rental company collects the rest.",
  };
}

export function marketplaceEmailCopy(locale = "en") {
  const labels = marketplaceSplitLabels(locale);
  const lang = String(locale || "en").slice(0, 2);
  if (lang === "es") {
    return {
      payCta: "Pagar ahora",
      paymentIntro:
        "La empresa de alquiler confirmó tu coche. Paga ahora para completar la reserva.",
      remainingNote: "Tasa de reserva Rovaro · No reembolsable",
      reissueIntro: "Nuevo enlace de pago para tu reserva. El importe no ha cambiado.",
      paidTen: labels.payNow,
      paidNinety: labels.payAtPickup,
      nextSteps: "Lleva el carnet a la recogida. Paga el resto allí.",
      paidPartnerIntro: "El cliente pagó a Rovaro. Cobra el resto en la entrega.",
      refundIntro: "Rovaro ha reembolsado la tasa de reserva de esta reserva.",
    };
  }
  return {
    payCta: "Pay now",
    paymentIntro:
      "The rental company confirmed your car. Pay now to complete the booking.",
    remainingNote: "Rovaro booking fee · Non-refundable",
    reissueIntro: "Here is a new payment link. The amount is unchanged.",
    paidTen: labels.payNow,
    paidNinety: labels.payAtPickup,
    nextSteps: "Bring your licence to pickup. Pay the rest there.",
    paidPartnerIntro: "The customer paid Rovaro. Collect the rest at pickup.",
    refundIntro: "Rovaro has refunded the booking fee for this booking.",
  };
}

export function assertNoSupplierPayout(payload) {
  const text = JSON.stringify(payload || {});
  return (
    !/transfer_data|application_fee|on_behalf_of|"destination"/.test(text) &&
    Number(payload?.payoutMinor || 0) === 0
  );
}
