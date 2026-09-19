/**
 * @jest-environment node
 */
import {
  resolveCompanyTransferPaymentPolicy,
  buildTransferCheckoutCharge,
  TRANSFER_COLLECTION_MODES,
} from "../companyPaymentPolicy.js";

const quote = {
  customerPriceMinor: 10000,
  platformMarginMinor: 2000,
  supplierPayoutMinor: 8000,
  currency: "EUR",
};

function company(payments) {
  return { transferServices: { payments } };
}

describe("companyPaymentPolicy", () => {
  test("default / both off → on_site", () => {
    const p = resolveCompanyTransferPaymentPolicy(company({}));
    expect(p.mode).toBe(TRANSFER_COLLECTION_MODES.ON_SITE);
    expect(p.useStripe).toBe(false);
  });

  test("stripe not configured forces on_site", () => {
    const p = resolveCompanyTransferPaymentPolicy(
      company({ stripeForPlatformFee: true, stripeForCompanyAmount: true }),
      { stripeConfigured: false }
    );
    expect(p.mode).toBe(TRANSFER_COLLECTION_MODES.ON_SITE);
  });

  test("both flags → stripe_full charge", () => {
    const p = resolveCompanyTransferPaymentPolicy(
      company({ stripeForPlatformFee: true, stripeForCompanyAmount: true })
    );
    expect(p.mode).toBe(TRANSFER_COLLECTION_MODES.STRIPE_FULL);
    const charge = buildTransferCheckoutCharge(quote, p);
    expect(charge.ok).toBe(true);
    expect(charge.amountMinor).toBe(10000);
    expect(charge.onSiteAmountMinor).toBe(0);
  });

  test("platform only → fee online, rest on site", () => {
    const p = resolveCompanyTransferPaymentPolicy(
      company({ stripeForPlatformFee: true, stripeForCompanyAmount: false })
    );
    expect(p.mode).toBe(TRANSFER_COLLECTION_MODES.STRIPE_PLATFORM_ONLY);
    const charge = buildTransferCheckoutCharge(quote, p);
    expect(charge.amountMinor).toBe(2000);
    expect(charge.onSiteAmountMinor).toBe(8000);
  });

  test("company only → supplier amount online", () => {
    const p = resolveCompanyTransferPaymentPolicy(
      company({ stripeForPlatformFee: false, stripeForCompanyAmount: true })
    );
    expect(p.mode).toBe(TRANSFER_COLLECTION_MODES.STRIPE_COMPANY_ONLY);
    const charge = buildTransferCheckoutCharge(quote, p);
    expect(charge.amountMinor).toBe(8000);
    expect(charge.onSiteAmountMinor).toBe(2000);
  });
});
