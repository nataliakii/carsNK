/**
 * @jest-environment node
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@models/MailLog", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  PRICE_CORRECTION_CODE,
  appendPriceRevision,
  capturePaidMarketplaceFeeSnapshot,
  isMarketplaceFeePaid,
  marketplacePaidSnapshotUnchanged,
  paidPlatformAmountMinor,
  previewMarketplaceGrossRevision,
  splitMarketplaceGrossRevision,
} from "../marketplacePriceCorrection";
import { marketplacePriceCorrectionCopy } from "../marketplaceBookingEmails";
import { evaluatePaymentLinkReissue } from "../reissueMarketplacePaymentLink";
import { applyReplacementPriceCap } from "@/domain/booking/alternativeOfferCore";
import { getOrderAccess } from "../orderAccessPolicy";

const EUR_500 = 50000;
const EUR_50 = 5000;
const EUR_450 = 45000;
const EUR_400 = 40000;
const EUR_550 = 55000;
const EUR_40 = 4000;
const EUR_360 = 36000;

function unpaidOrder(extra = {}) {
  return {
    _id: "64b7f2c3a1b2c3d4e5f60789",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
    currency: "EUR",
    totalPrice: 500,
    ownerId: "co1",
    authoritativePrice: {
      currency: "EUR",
      grossMinor: EUR_500,
      marketplaceBookingFeeBps: 1000,
      prepaymentMinor: EUR_50,
      platformAmountMinor: EUR_50,
      stripeAmountMinor: EUR_50,
      balanceMinor: EUR_450,
      supplierBalanceMinor: EUR_450,
      pricingVersion: 1,
    },
    payment: {
      status: "pending",
      provider: "stripe",
      providerPaymentId: "cs_unpaid",
      amountMinor: EUR_50,
      currency: "EUR",
    },
    ...extra,
  };
}

function paidOrder(extra = {}) {
  return unpaidOrder({
    partnerConfirmedAt: new Date("2026-09-22T09:00:00.000Z"),
    bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    payment: {
      status: "paid",
      provider: "stripe",
      providerPaymentId: "cs_paid",
      amountMinor: EUR_50,
      paidAmountMinor: EUR_50,
      currency: "EUR",
      paidAt: "2026-09-22T10:00:00.000Z",
    },
    paidMarketplaceFeeSnapshot: {
      platformAmountMinor: EUR_50,
      stripeAmountMinor: EUR_50,
      marketplaceBookingFeeBps: 1000,
      currency: "EUR",
      amountMinor: EUR_50,
      providerPaymentId: "cs_paid",
      paidAt: "2026-09-22T10:00:00.000Z",
    },
    ...extra,
  });
}

describe("marketplace price correction", () => {
  test("1. unpaid order price change recalculates the fee from snapshotted bps", () => {
    const preview = previewMarketplaceGrossRevision({
      order: unpaidOrder(),
      revisedGrossMinor: 40000,
      reason: "Quoted a lower rate",
      actorRole: "SUPERADMIN",
    });
    expect(preview.ok).toBe(true);
    expect(preview.paid).toBe(false);
    expect(preview.fixedPaidPlatformAmountMinor).toBe(EUR_40);
    expect(preview.revisedSupplierBalanceMinor).toBe(EUR_360);
    expect(preview.nextAuthoritativePrice.marketplaceBookingFeeBps).toBe(1000);
  });

  test("2. unpaid revision records that the old checkout must be invalidated and no new session is created", () => {
    const preview = previewMarketplaceGrossRevision({
      order: unpaidOrder(),
      revisedGrossMinor: 40000,
      reason: "Quoted a lower rate",
      actorRole: "SUPERADMIN",
    });
    expect(preview.createsCheckoutSession).toBe(false);
    expect(preview.createsRefund).toBe(false);
  });

  test("3. paid order price reduction keeps the paid fee unchanged", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 45000,
      reason: "Customer discount after payment",
      actorRole: "SUPERADMIN",
    });
    expect(preview.ok).toBe(true);
    expect(preview.fixedPaidPlatformAmountMinor).toBe(EUR_50);
    expect(preview.revisedSupplierBalanceMinor).toBe(EUR_400);
    expect(preview.nextAuthoritativePrice.platformAmountMinor).toBe(EUR_50);
    expect(preview.nextAuthoritativePrice.stripeAmountMinor).toBe(EUR_50);
    expect(preview.nextAuthoritativePrice.marketplaceBookingFeeBps).toBe(1000);
  });

  test("4. paid order price increase keeps the paid fee unchanged", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: EUR_550,
      reason: "Extra day",
      actorRole: "SUPERADMIN",
    });
    expect(preview.fixedPaidPlatformAmountMinor).toBe(EUR_50);
    expect(preview.revisedSupplierBalanceMinor).toBe(50000);
  });

  test("5. only supplier balance changes after payment", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 45000,
      reason: "Correction",
      actorRole: "SUPERADMIN",
    });
    expect(preview.nextAuthoritativePrice.platformAmountMinor).toBe(EUR_50);
    expect(preview.nextAuthoritativePrice.supplierBalanceMinor).toBe(EUR_400);
    expect(preview.nextAuthoritativePrice.grossMinor).toBe(45000);
  });

  test("6. no new Stripe session is created after paid correction", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 45000,
      reason: "Correction",
      actorRole: "SUPERADMIN",
    });
    expect(preview.createsCheckoutSession).toBe(false);
  });

  test("7. no automatic refund is created", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 45000,
      reason: "Correction",
      actorRole: "SUPERADMIN",
    });
    expect(preview.createsRefund).toBe(false);
  });

  test("8. original payment snapshot remains unchanged", () => {
    const before = paidOrder();
    const snapshot = capturePaidMarketplaceFeeSnapshot(before);
    const after = {
      ...before,
      paidMarketplaceFeeSnapshot: snapshot,
      authoritativePrice: {
        ...before.authoritativePrice,
        grossMinor: 45000,
        supplierBalanceMinor: EUR_400,
      },
    };
    expect(marketplacePaidSnapshotUnchanged(before, after)).toBe(true);
    expect(after.paidMarketplaceFeeSnapshot.platformAmountMinor).toBe(EUR_50);
    expect(after.paidMarketplaceFeeSnapshot.providerPaymentId).toBe("cs_paid");
  });

  test("9. revision history is append-only", () => {
    const first = { revisedGrossMinor: 45000, timestamp: "t1" };
    const second = { revisedGrossMinor: 48000, timestamp: "t2" };
    const history = appendPriceRevision(appendPriceRevision([], first), second);
    expect(history).toHaveLength(2);
    expect(history[0].revisedGrossMinor).toBe(45000);
    expect(history[1].revisedGrossMinor).toBe(48000);
  });

  test("10. missing reason is rejected", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 45000,
      reason: "   ",
      actorRole: "SUPERADMIN",
    });
    expect(preview.ok).toBe(false);
    expect(preview.code).toBe(PRICE_CORRECTION_CODE.REASON_REQUIRED);
  });

  test("11. rental-company ADMIN cannot correct a paid authoritative price", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 45000,
      reason: "Please",
      actorRole: "ADMIN",
    });
    expect(preview.ok).toBe(false);
    expect(preview.code).toBe(PRICE_CORRECTION_CODE.FORBIDDEN);
    const access = getOrderAccess({
      role: "ADMIN",
      isClientOrder: true,
      confirmed: true,
      isPast: false,
      timeBucket: "FUTURE",
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      partnerConfirmed: true,
      paymentStatus: "paid",
    });
    expect(access.canEditTotalPrice).toBe(false);
    expect(access.canCorrectMarketplacePrice).toBe(false);
  });

  test("12. SUPERADMIN can correct it with a reason", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 45000,
      reason: "Agreed discount",
      actorRole: "SUPERADMIN",
    });
    expect(preview.ok).toBe(true);
  });

  test("13. total below the paid fee is rejected", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 4000,
      reason: "Too low",
      actorRole: "SUPERADMIN",
    });
    expect(preview.ok).toBe(false);
    expect(preview.code).toBe(PRICE_CORRECTION_CODE.BELOW_PAID_FEE);
  });

  test("14. currency change is rejected", () => {
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: 45000,
      reason: "USD",
      actorRole: "SUPERADMIN",
      currency: "USD",
    });
    expect(preview.ok).toBe(false);
    expect(preview.code).toBe(PRICE_CORRECTION_CODE.CURRENCY_MISMATCH);
  });

  test("15. customer and partner receive the correct concise amounts", () => {
    const en = marketplacePriceCorrectionCopy("en");
    const es = marketplacePriceCorrectionCopy("es");
    expect(en.customerIntro).toBe("Your rental total has been updated.");
    expect(en.alreadyPaidOnline).toBe("Already paid online");
    expect(en.payRentalCompany).toBe("Pay the rental company");
    expect(en.updatedRentalTotal).toBe("Updated rental total");
    expect(en.alreadyPaidToRovaro).toBe("Already paid to Rovaro");
    expect(en.collectFromCustomer).toBe("Collect from customer");
    expect(es.customerIntro).toMatch(/actualizado/i);
    expect(es.alreadyPaidOnline).toBe("Ya pagado online");
    expect(es.payRentalCompany).toMatch(/empresa de alquiler/i);
    expect(es.collectFromCustomer).toBe("Cobrar al cliente");
  });

  test("16. alternative bookings follow the same paid-fee invariant", () => {
    const cap = applyReplacementPriceCap({
      calculatedGrossMinor: 45000,
      originalGrossMinor: EUR_500,
      feeBps: 1000,
      fixedPaidPlatformAmountMinor: EUR_50,
    });
    expect(cap.platformAmountMinor).toBe(EUR_50);
    expect(cap.supplierBalanceMinor).toBe(EUR_400);
  });

  test("17. payment-link reissue cannot reprice a paid order", () => {
    const order = paidOrder();
    const result = evaluatePaymentLinkReissue(order);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("already_paid");
  });

  test("18. Greece rentals and transfers remain unchanged by this helper", () => {
    const greece = previewMarketplaceGrossRevision({
      order: { bookingMode: BOOKING_MODES.OPS_CALENDAR, totalPrice: 200 },
      revisedGrossMinor: 18000,
      reason: "n/a",
      actorRole: "SUPERADMIN",
    });
    expect(greece.code).toBe(PRICE_CORRECTION_CODE.NOT_MARKETPLACE);
    expect(isMarketplaceFeePaid({ bookingMode: BOOKING_MODES.OPS_CALENDAR, payment: { status: "paid" } })).toBe(
      false
    );
    expect(
      splitMarketplaceGrossRevision({
        grossMinor: EUR_500,
        feeBps: 1000,
      }).platformAmountMinor
    ).toBe(EUR_50);
  });

  test("9b. post-payment correction keeps the paid platform fee fixed", () => {
    expect(paidPlatformAmountMinor(paidOrder())).toBe(EUR_50);
    const preview = previewMarketplaceGrossRevision({
      order: paidOrder(),
      revisedGrossMinor: EUR_550,
      reason: "Add extra",
      actorRole: "SUPERADMIN",
    });
    expect(preview.nextAuthoritativePrice.prepaymentMinor).toBe(EUR_50);
    expect(preview.nextAuthoritativePrice.platformAmountMinor).toBe(EUR_50);
  });
});
