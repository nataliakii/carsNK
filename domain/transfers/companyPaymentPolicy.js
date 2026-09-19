/**
 * Per-company transfer payment policy.
 *
 * Companies choose independently:
 * - collect platform commission via Stripe
 * - collect the company (supplier) amount via Stripe
 * - otherwise the company collects on site / by fact (cash/card with driver)
 *
 * Global Stripe keys must still be configured; these flags only gate usage.
 */

export const TRANSFER_COLLECTION_MODES = Object.freeze({
  /** Full customer price online via Stripe. */
  STRIPE_FULL: "stripe_full",
  /** Only platform margin online; company amount on site. */
  STRIPE_PLATFORM_ONLY: "stripe_platform_only",
  /** Only supplier payout online; platform fee handled separately / waived online. */
  STRIPE_COMPANY_ONLY: "stripe_company_only",
  /** No online charge — company collects by fact. */
  ON_SITE: "on_site",
});

/**
 * Normalize payment flags from company.transferServices.payments (or legacy).
 * @param {object|null|undefined} company
 */
export function getCompanyTransferPaymentFlags(company) {
  const payments = company?.transferServices?.payments || {};
  return {
    stripeForPlatformFee: Boolean(payments.stripeForPlatformFee),
    stripeForCompanyAmount: Boolean(payments.stripeForCompanyAmount),
  };
}

/**
 * @param {object|null|undefined} company
 * @param {{ stripeConfigured?: boolean }} [opts]
 * @returns {{
 *   mode: string,
 *   stripeForPlatformFee: boolean,
 *   stripeForCompanyAmount: boolean,
 *   useStripe: boolean,
 *   collectOnSite: boolean,
 * }}
 */
export function resolveCompanyTransferPaymentPolicy(
  company,
  { stripeConfigured = true } = {}
) {
  const flags = getCompanyTransferPaymentFlags(company);
  const wantPlatform = flags.stripeForPlatformFee;
  const wantCompany = flags.stripeForCompanyAmount;

  if (!stripeConfigured || (!wantPlatform && !wantCompany)) {
    return {
      mode: TRANSFER_COLLECTION_MODES.ON_SITE,
      stripeForPlatformFee: false,
      stripeForCompanyAmount: false,
      useStripe: false,
      collectOnSite: true,
    };
  }

  if (wantPlatform && wantCompany) {
    return {
      mode: TRANSFER_COLLECTION_MODES.STRIPE_FULL,
      stripeForPlatformFee: true,
      stripeForCompanyAmount: true,
      useStripe: true,
      collectOnSite: false,
    };
  }

  if (wantPlatform) {
    return {
      mode: TRANSFER_COLLECTION_MODES.STRIPE_PLATFORM_ONLY,
      stripeForPlatformFee: true,
      stripeForCompanyAmount: false,
      useStripe: true,
      /** Remainder is collected by the company on site. */
      collectOnSite: true,
    };
  }

  return {
    mode: TRANSFER_COLLECTION_MODES.STRIPE_COMPANY_ONLY,
    stripeForPlatformFee: false,
    stripeForCompanyAmount: true,
    useStripe: true,
    collectOnSite: false,
  };
}

/**
 * Build Stripe Checkout line items + total from quote + policy.
 * Amounts below Stripe's practical minimum (50) are skipped.
 *
 * @param {object} quoteSnapshot
 * @param {ReturnType<typeof resolveCompanyTransferPaymentPolicy>} policy
 * @returns {{
 *   ok: boolean,
 *   code?: string,
 *   message?: string,
 *   amountMinor: number,
 *   currency: string,
 *   lineItems: Array<{name: string, description?: string, amountMinor: number}>,
 *   onSiteAmountMinor: number,
 * }}
 */
export function buildTransferCheckoutCharge(quoteSnapshot, policy) {
  const currency = String(quoteSnapshot?.currency || "EUR")
    .trim()
    .toUpperCase();
  const customer = Math.max(
    0,
    Math.round(Number(quoteSnapshot?.customerPriceMinor) || 0)
  );
  const platform = Math.max(
    0,
    Math.round(Number(quoteSnapshot?.platformMarginMinor) || 0)
  );
  const supplier = Math.max(
    0,
    Math.round(Number(quoteSnapshot?.supplierPayoutMinor) || 0)
  );

  if (!policy?.useStripe) {
    return {
      ok: true,
      amountMinor: 0,
      currency,
      lineItems: [],
      onSiteAmountMinor: customer,
    };
  }

  /** @type {Array<{name: string, description?: string, amountMinor: number}>} */
  const lineItems = [];

  if (policy.mode === TRANSFER_COLLECTION_MODES.STRIPE_FULL) {
    if (customer < 50) {
      return {
        ok: false,
        code: "invalid_amount",
        message: "Customer price is too low for Stripe Checkout",
        amountMinor: 0,
        currency,
        lineItems: [],
        onSiteAmountMinor: customer,
      };
    }
    lineItems.push({
      name: "Transfer",
      description: "Full transfer payment",
      amountMinor: customer,
    });
    return {
      ok: true,
      amountMinor: customer,
      currency,
      lineItems,
      onSiteAmountMinor: 0,
    };
  }

  if (policy.mode === TRANSFER_COLLECTION_MODES.STRIPE_PLATFORM_ONLY) {
    if (platform < 50) {
      return {
        ok: false,
        code: "platform_fee_too_low",
        message:
          "Platform commission is too low for a separate Stripe charge — use on-site or full Stripe",
        amountMinor: 0,
        currency,
        lineItems: [],
        onSiteAmountMinor: customer,
      };
    }
    lineItems.push({
      name: "Platform fee",
      description: "Platform commission for this transfer",
      amountMinor: platform,
    });
    return {
      ok: true,
      amountMinor: platform,
      currency,
      lineItems,
      onSiteAmountMinor: Math.max(0, customer - platform),
    };
  }

  if (policy.mode === TRANSFER_COLLECTION_MODES.STRIPE_COMPANY_ONLY) {
    if (supplier < 50) {
      return {
        ok: false,
        code: "company_amount_too_low",
        message: "Company amount is too low for Stripe Checkout",
        amountMinor: 0,
        currency,
        lineItems: [],
        onSiteAmountMinor: customer,
      };
    }
    lineItems.push({
      name: "Transfer service",
      description: "Amount for the transfer company",
      amountMinor: supplier,
    });
    return {
      ok: true,
      amountMinor: supplier,
      currency,
      lineItems,
      onSiteAmountMinor: Math.max(0, customer - supplier),
    };
  }

  return {
    ok: true,
    amountMinor: 0,
    currency,
    lineItems: [],
    onSiteAmountMinor: customer,
  };
}

export default resolveCompanyTransferPaymentPolicy;
