/**
 * @jest-environment node
 *
 * Configurable Spain marketplace Rovaro Booking Fee (basis points).
 * Tests 1–18 from the financial-model correction.
 */
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { applyReplacementPriceCap } from "@/domain/booking/alternativeOfferCore";
import { resolveConfirmationFinancials } from "@/domain/booking/partnerBookingConfirmation";
import { ROLE } from "@models/user";
import {
  rentalPaymentUpdatesFromPatch,
  RENTAL_PAYMENTS_SUPERADMIN_ONLY,
} from "@/domain/company/rentalPaymentSettingsPatch";
import {
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  marketplaceBookingFeeAuditMetadata,
  marketplacePlatformAmountMinor,
  parseMarketplaceBookingFeeBps,
  parseMarketplaceBookingFeePercent,
  resolveMarketplaceBookingFeeBps,
  snapshotMarketplaceBookingFeeBps,
} from "../marketplaceBookingFee";
import {
  assertNoSupplierPayout,
  marketplaceEmailCopy,
  marketplaceFinancialSplit,
  marketplaceFinancialSplitFromMajor,
} from "../marketplaceFinancialSplit";
import {
  resolvePrepaymentPercent,
} from "../rentalPricingService";
import { resolveRentalCheckoutAmount } from "../companyRentalPaymentPolicy";
import { buildRentalCheckoutMetadata } from "../rentalStripeCheckout";
import { computePriceSnapshotChecksum } from "../priceSnapshotChecksum";

const EUR_500_MINOR = 50000;

describe("1. default 10%: €500 → €50 / €450", () => {
  test("formula and split", () => {
    const resolved = resolveMarketplaceBookingFeeBps({});
    expect(resolved.bps).toBe(1000);
    expect(resolved.percent).toBe(10);
    expect(resolved.source).toBe("default");
    const split = marketplaceFinancialSplitFromMajor(500, "EUR");
    expect(split.platformAmountMinor).toBe(5000);
    expect(split.supplierBalanceMinor).toBe(45000);
    expect(split.stripeAmountMinor).toBe(5000);
    expect(split.payoutMinor).toBe(0);
  });
});

describe("2. company override 15%: €500 → €75 / €425", () => {
  test("uses company marketplaceBookingFeeBps", () => {
    const resolved = resolveMarketplaceBookingFeeBps({
      marketplaceBookingFeeBps: 1500,
    });
    expect(resolved.bps).toBe(1500);
    expect(resolved.percent).toBe(15);
    expect(resolved.source).toBe("override");
    const split = marketplaceFinancialSplitFromMajor(500, "EUR", { feeBps: 1500 });
    expect(split.platformAmountMinor).toBe(7500);
    expect(split.supplierBalanceMinor).toBe(42500);
  });
});

describe("3. decimal 12.5%: €500 → €62.50 / €437.50", () => {
  test("1250 bps", () => {
    expect(parseMarketplaceBookingFeePercent(12.5)).toEqual({ ok: true, bps: 1250 });
    const split = marketplaceFinancialSplitFromMajor(500, "EUR", { feeBps: 1250 });
    expect(split.platformAmountMinor).toBe(6250);
    expect(split.supplierBalanceMinor).toBe(43750);
  });
});

describe("4. delivery and extras are included before applying the percentage", () => {
  test("gross is the base for the fee", () => {
    const rental = 20000;
    const extras = 1200;
    const delivery = 2500;
    const grossMinor = rental + extras + delivery;
    expect(marketplacePlatformAmountMinor(grossMinor, 1000)).toBe(2370);
    expect(grossMinor - 2370).toBe(21330);
  });
});

describe("5–8. SUPERADMIN can write; ADMIN cannot; invalid rejected", () => {
  const superadmin = { role: ROLE.SUPERADMIN };
  const companyAdmin = { role: ROLE.ADMIN };

  test("5. rental-company ADMIN cannot change the percentage", () => {
    const result = rentalPaymentUpdatesFromPatch(
      { marketplaceBookingFeeBps: 1500 },
      companyAdmin
    );
    expect(result.status).toBe(403);
    expect(result.error).toBe(RENTAL_PAYMENTS_SUPERADMIN_ONLY);
  });

  test("6. SUPERADMIN can set an override", () => {
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: 1500 }, superadmin)
    ).toEqual({ ok: true, updates: { marketplaceBookingFeeBps: 1500 } });
  });

  test("7. SUPERADMIN can reset to default", () => {
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: null }, superadmin)
        .updates.marketplaceBookingFeeBps
    ).toBeNull();
  });

  test("8. invalid values are rejected", () => {
    expect(parseMarketplaceBookingFeeBps(Number.NaN).ok).toBe(false);
    expect(parseMarketplaceBookingFeeBps(-100).ok).toBe(false);
    expect(parseMarketplaceBookingFeePercent(-1).ok).toBe(false);
    expect(parseMarketplaceBookingFeePercent(101).error).toMatch(/100%/);
    expect(parseMarketplaceBookingFeePercent(0.5).error).toMatch(/1%/);
    expect(parseMarketplaceBookingFeePercent(31).error).toMatch(/30%/);
  });
});

describe("9. AuditLog metadata contains old/new basis points", () => {
  test("override change", () => {
    const meta = marketplaceBookingFeeAuditMetadata({
      companyId: "co1",
      previousBps: 1000,
      newBps: 1500,
      actorEmail: "super@rovaro.autos",
      actorUserId: "u1",
      reason: "Spain partner contract",
    });
    expect(meta).toEqual(
      expect.objectContaining({
        companyId: "co1",
        previousBps: 1000,
        newBps: 1500,
        source: "override",
        actorEmail: "super@rovaro.autos",
        actorUserId: "u1",
        reason: "Spain partner contract",
      })
    );
    expect(meta.changedAt).toMatch(/^\d{4}-/);
  });

  test("reset to default", () => {
    expect(
      marketplaceBookingFeeAuditMetadata({
        companyId: "co1",
        previousBps: 1500,
        newBps: null,
      }).source
    ).toBe("default");
  });
});

describe("10. existing order remains 10% after company changes to 15%", () => {
  test("stored snapshot amounts are kept", () => {
    const order = {
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      authoritativePrice: {
        currency: "EUR",
        grossMinor: EUR_500_MINOR,
        marketplaceBookingFeeBps: 1000,
        platformAmountMinor: 5000,
        prepaymentMinor: 5000,
        supplierBalanceMinor: 45000,
        balanceMinor: 45000,
        stripeAmountMinor: 5000,
      },
    };
    const companyNow = { marketplaceBookingFeeBps: 1500 };
    expect(resolveMarketplaceBookingFeeBps(companyNow).bps).toBe(1500);
    const split = marketplaceFinancialSplit(order.authoritativePrice);
    expect(split.marketplaceBookingFeeBps).toBe(1000);
    expect(split.platformAmountMinor).toBe(5000);
    expect(split.supplierBalanceMinor).toBe(45000);
    const checkout = resolveRentalCheckoutAmount(order);
    expect(checkout.amountMinor).toBe(5000);
    expect(checkout.marketplaceBookingFeeBps).toBe(1000);
  });
});

describe("11. payment-link reissue retains the original percentage", () => {
  test("checkout amount comes from the order snapshot", () => {
    const order = {
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      authoritativePrice: {
        currency: "EUR",
        grossMinor: EUR_500_MINOR,
        marketplaceBookingFeeBps: 1250,
        platformAmountMinor: 6250,
        prepaymentMinor: 6250,
        supplierBalanceMinor: 43750,
        stripeAmountMinor: 6250,
      },
    };
    const amounts = resolveRentalCheckoutAmount(order);
    expect(amounts.amountMinor).toBe(6250);
    expect(amounts.marketplaceBookingFeeBps).toBe(1250);
  });
});

describe("12. alternative offer retains the booking’s snapshotted bps", () => {
  test("new gross is recapped with original bps, not the company’s 15%", () => {
    const cap = applyReplacementPriceCap({
      calculatedGrossMinor: 60000,
      originalGrossMinor: EUR_500_MINOR,
      feeBps: 1000,
    });
    expect(cap.offeredGrossMinor).toBe(EUR_500_MINOR);
    expect(cap.marketplaceBookingFeeBps).toBe(1000);
    expect(cap.prepaymentMinor).toBe(5000);
    expect(cap.balanceMinor).toBe(45000);
    const higher = applyReplacementPriceCap({
      calculatedGrossMinor: 40000,
      originalGrossMinor: EUR_500_MINOR,
      feeBps: 1000,
    });
    expect(higher.offeredGrossMinor).toBe(40000);
    expect(higher.prepaymentMinor).toBe(4000);
    expect(higher.marketplaceBookingFeeBps).toBe(1000);
  });
});

describe("13. Stripe metadata contains bps and immutable amounts", () => {
  test("buildRentalCheckoutMetadata", () => {
    const order = {
      _id: "order-1",
      ownerId: "company-a",
      car: "car-1",
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      authoritativePrice: {
        currency: "EUR",
        grossMinor: EUR_500_MINOR,
        marketplaceBookingFeeBps: 1500,
        platformAmountMinor: 7500,
        prepaymentMinor: 7500,
        supplierBalanceMinor: 42500,
        stripeAmountMinor: 7500,
      },
      payment: {},
    };
    order.payment.priceChecksum = computePriceSnapshotChecksum(order);
    const amounts = resolveRentalCheckoutAmount(order);
    const meta = buildRentalCheckoutMetadata(order, amounts, {
      mode: "test",
      policy: { mode: "stripe_prepayment", timing: "after_confirm" },
      priceChecksum: order.payment.priceChecksum,
    });
    expect(meta.marketplaceBookingFeeBps).toBe("1500");
    expect(meta.platformAmountMinor).toBe("7500");
    expect(meta.stripeAmountMinor).toBe("7500");
    expect(meta.grossMinor).toBe("50000");
    expect(meta.supplierBalanceMinor).toBe("42500");
    expect(meta.payoutMinor).toBe("0");
    expect(JSON.stringify(meta)).not.toMatch(
      /transfer_data|application_fee|on_behalf_of/
    );
  });
});

describe("14. customer and partner emails use compact amounts", () => {
  test("15%", () => {
    const en = marketplaceEmailCopy("en", 1500);
    expect(en.payCta).toBe("Pay now");
    expect(en.paidTen).toBe("Pay now");
    expect(en.paidNinety).toBe("Pay at pickup");
    expect(en.paidPartnerIntro).toMatch(/Collect the rest at pickup/);
    const es = marketplaceEmailCopy("es", 1250);
    expect(es.payCta).toBe("Pagar ahora");
  });
});

describe("15. partner copy stays operational", () => {
  test("partner copy", () => {
    const blob = JSON.stringify(marketplaceEmailCopy("en", 1500));
    expect(blob).toMatch(/Collect the rest at pickup/);
    expect(blob).not.toMatch(/settlement|Stripe Connect|payout/i);
  });
});

describe("16. Greece rentals remain unchanged", () => {
  test("legacy company.prepaymentPercent still drives OPS_CALENDAR", () => {
    expect(
      resolvePrepaymentPercent({
        bookingMode: BOOKING_MODES.OPS_CALENDAR,
        company: { prepaymentPercent: 20, marketplaceBookingFeeBps: 1500 },
      })
    ).toBe(20);
    expect(
      resolvePrepaymentPercent({
        bookingMode: BOOKING_MODES.OPS_CALENDAR,
        company: {},
      })
    ).toBe(0);
  });
});

describe("17–18. transfers unchanged; no Connect or supplier payout", () => {
  test("marketplace split payout is always 0", () => {
    const split = marketplaceFinancialSplitFromMajor(500, "EUR", { feeBps: 1500 });
    expect(split.payoutMinor).toBe(0);
    expect(assertNoSupplierPayout(split)).toBe(true);
    expect(assertNoSupplierPayout({ transfer_data: { destination: "acct" } })).toBe(
      false
    );
  });

  test("Greece confirmation financials do not use marketplace fee on OPS orders without snapshot", () => {
    const order = {
      bookingMode: BOOKING_MODES.OPS_CALENDAR,
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 10000,
        prepaymentPercent: 0,
        prepaymentMinor: 0,
        balanceMinor: 10000,
      },
    };
    const checkout = resolveRentalCheckoutAmount(order);
    expect(checkout.amountMinor).toBe(0);
    expect(checkout.balanceMinor).toBe(10000);
  });
});

describe("platform default vs company override", () => {
  test("company without override uses platform default when provided", () => {
    const resolved = resolveMarketplaceBookingFeeBps(
      {},
      { marketplaceBookingFeeBps: 1200 }
    );
    expect(resolved.bps).toBe(1200);
    expect(resolved.percent).toBe(12);
    expect(resolved.source).toBe("platform");
  });

  test("company with 12% override beats platform default", () => {
    const resolved = resolveMarketplaceBookingFeeBps(
      { marketplaceBookingFeeBps: 1200 },
      { marketplaceBookingFeeBps: 800 }
    );
    expect(resolved.bps).toBe(1200);
    expect(resolved.source).toBe("override");
  });

  test("null company override falls through to platform then 10%", () => {
    expect(
      resolveMarketplaceBookingFeeBps({ marketplaceBookingFeeBps: null }).bps
    ).toBe(1000);
    expect(
      resolveMarketplaceBookingFeeBps(
        { marketplaceBookingFeeBps: null },
        { marketplaceBookingFeeBps: 1500 }
      ).bps
    ).toBe(1500);
  });
});

describe("canonical identity for legal tokens", () => {
  test("empty optional VAT works for non-VAT sole trader tokens", () => {
    const { buildTokenValues } = require("@/domain/legal/tokens");
    const values = buildTokenValues({
      settings: {
        businessProfile: {
          businessAddress: "1 Example Road, Dublin",
          vatNumber: "",
          vatRegistered: false,
        },
      },
    });
    expect(values["operator.businessAddress"]).toBe("1 Example Road, Dublin");
    expect(values["operator.legalName"]).toBe("Nataliia Kirejeva");
    expect(values["operator.platformBrand"]).toBe("Rovaro");
    expect(JSON.stringify(values)).not.toMatch(/VAT number:\s*[A-Z0-9]/i);
  });
});

describe("legacy snapshot derivation", () => {
  test("missing bps is derived from stored amounts, not current company config", () => {
    const snap = snapshotMarketplaceBookingFeeBps({
      authoritativePrice: {
        grossMinor: 50000,
        platformAmountMinor: 5000,
      },
    });
    expect(snap.bps).toBe(1000);
    expect(snap.derived).toBe(true);
  });

  test("unsafe derivation falls back to documented default for display only", () => {
    const snap = snapshotMarketplaceBookingFeeBps({ authoritativePrice: {} });
    expect(snap.bps).toBe(DEFAULT_MARKETPLACE_BOOKING_FEE_BPS);
  });
});

describe("confirmation financials prefer stored snapshot", () => {
  test("does not reprice when company override would be 15%", () => {
    const result = resolveConfirmationFinancials({
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 50000,
        marketplaceBookingFeeBps: 1000,
        platformAmountMinor: 5000,
        prepaymentMinor: 5000,
        supplierBalanceMinor: 45000,
        balanceMinor: 45000,
      },
    });
    expect(result.marketplaceBookingFeeBps).toBe(1000);
    expect(result.platformAmountMinor).toBe(5000);
  });
});
