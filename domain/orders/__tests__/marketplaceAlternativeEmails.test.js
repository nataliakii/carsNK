/**
 * @jest-environment node
 */
import { ALTERNATIVE_EMAIL_COPY } from "../marketplaceAlternativeEmails";
import { marketplaceEmailCopy, marketplaceSplitLabels } from "../marketplaceFinancialSplit";

describe("alternative offer email copy", () => {
  test("EN and ES both describe requested/proposed cars, cap and a View Offer CTA", () => {
    for (const locale of ["en", "es"]) {
      const t = ALTERNATIVE_EMAIL_COPY[locale];
      expect(t.offeredSubject.toLowerCase()).toMatch(/rovaro/);
      expect(t.viewOffer).toBeTruthy();
      expect(t.requested).toBeTruthy();
      expect(t.proposed).toBeTruthy();
      expect(t.sameOrBetter).toBeTruthy();
      expect(t.prepayment).not.toMatch(/10%/);
      expect(t.remaining).not.toMatch(/90%/);
      expect(t.discount).toBeTruthy();
      expect(t.payCta).toBeTruthy();
    }
  });

  test("runtime overlay uses compact pay-now copy", () => {
    expect(marketplaceSplitLabels("en", 1500).payNow).toBe("Pay now");
    expect(marketplaceSplitLabels("en", 1500).payAtPickup).toBe("Pay at pickup");
    expect(marketplaceEmailCopy("en", 1250).payCta).toBe("Pay now");
  });
});
