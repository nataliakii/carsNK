/**
 * @jest-environment node
 */
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import {
  PRICE_BREAKDOWN_MISMATCH,
  assertAuthoritativePriceReconciled,
  formatReconciledBreakdownRows,
  marketplaceDeliveryDisplayLines,
  reconcileAuthoritativePriceBreakdown,
} from "../priceBreakdownReconciliation";
import { applyReplacementPriceCap } from "@/domain/booking/alternativeOfferCore";
import { evaluatePaymentLinkReissue } from "../reissueMarketplacePaymentLink";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { computePriceSnapshotChecksum } from "../priceSnapshotChecksum";

describe("authoritative price reconciliation", () => {
  test("1. €200 rental + €12 child seat + €25 return delivery = €237", () => {
    const rec = reconcileAuthoritativePriceBreakdown({
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      totalPrice: 237,
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 23700,
        baseRentalMinor: 20000,
        extrasMinor: 1200,
        insuranceMinor: 0,
        pickupFeeMinor: 0,
        returnFeeMinor: 2500,
        discountMinor: 0,
        otherFeesMinor: 0,
        lines: [
          { code: "BASE_RENTAL", label: "Rental", minor: 20000 },
          { code: "EXTRAS", label: "Child seats ×1", minor: 1200 },
          { code: "RETURN_FEE", label: "Return delivery", minor: 2500 },
        ],
      },
      locationSnapshot: {
        pickup: { kind: "office", name: "QA Office A Eixample", feeMajor: 0 },
        return: { kind: "delivery", name: "Barcelona", feeMajor: 25 },
      },
      priceBreakdown: {
        totalPrice: 212,
        baseRentalTotal: 200,
        childSeatsTotal: 12,
        deliveryIn: 0,
        deliveryOut: 0,
        deliveryTotal: 0,
      },
    });
    expect(rec.rentalMinor).toBe(20000);
    expect(rec.extrasMinor).toBe(1200);
    expect(rec.pickupFeeMinor).toBe(0);
    expect(rec.returnFeeMinor).toBe(2500);
    expect(rec.totalMinor).toBe(23700);
    expect(rec.calculatedComponentsMinor).toBe(23700);
    expect(rec.unexplainedDifferenceMinor).toBe(0);
    expect(rec.isReconciled).toBe(true);
    expect(assertAuthoritativePriceReconciled({
      authoritativePrice: {
        grossMinor: 23700,
        baseRentalMinor: 20000,
        extrasMinor: 1200,
        pickupFeeMinor: 0,
        returnFeeMinor: 2500,
      },
      locationSnapshot: {
        pickup: { kind: "office", feeMajor: 0 },
        return: { kind: "delivery", name: "Barcelona", feeMajor: 25 },
      },
    }).ok).toBe(true);
  });

  test("2. Pickup €25 + return €0 displayed separately", () => {
    const lines = marketplaceDeliveryDisplayLines({
      locationSnapshot: {
        pickup: { kind: "delivery", name: "Hotel Arts", feeMajor: 25 },
        return: { kind: "office", name: "Office", feeMajor: 0 },
      },
      pickupFeeMinor: 2500,
      returnFeeMinor: 0,
    });
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PICKUP_DELIVERY",
          label: "Delivery to Hotel Arts",
          minor: 2500,
        }),
        expect.objectContaining({
          code: "RETURN_OFFICE",
          free: true,
        }),
      ])
    );
  });

  test("3. two free office legs display as free", () => {
    const lines = marketplaceDeliveryDisplayLines({
      locationSnapshot: {
        pickup: { kind: "office", name: "Office A", feeMajor: 0 },
        return: { kind: "office", name: "Office B", feeMajor: 0 },
      },
      pickupFeeMinor: 0,
      returnFeeMinor: 0,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toMatch(/Pickup and return at office/);
    expect(lines[0].free).toBe(true);
  });

  test("4. platform booking fee is not added on top of gross", () => {
    const rec = reconcileAuthoritativePriceBreakdown({
      authoritativePrice: {
        grossMinor: 23700,
        baseRentalMinor: 20000,
        extrasMinor: 1200,
        pickupFeeMinor: 0,
        returnFeeMinor: 2500,
        prepaymentMinor: 2370,
        platformAmountMinor: 2370,
      },
    });
    expect(rec.totalMinor).toBe(23700);
    expect(rec.calculatedComponentsMinor).toBe(23700);
    expect(rec.platformFeeIsSplitNotCharge).toBe(true);
  });

  test("5. unknown legacy €25 difference is flagged, not called delivery", () => {
    const rec = reconcileAuthoritativePriceBreakdown({
      totalPrice: 237,
      priceBreakdown: {
        totalPrice: 212,
        baseRentalTotal: 200,
        childSeatsTotal: 12,
        deliveryIn: 0,
        deliveryOut: 0,
        deliveryTotal: 0,
      },
    });
    expect(rec.unclassifiedLegacyMinor).toBe(2500);
    expect(rec.isDisplayReconciled).toBe(true);
    expect(rec.isReconciled).toBe(false);
    const rows = formatReconciledBreakdownRows(rec);
    expect(rows.find((row) => row.legacy)).toMatchObject({
      label: "Unclassified legacy adjustment",
      minor: 2500,
    });
    expect(rows.some((row) => /delivery/i.test(row.label) && row.minor === 2500)).toBe(
      false
    );
  });

  test("6. new unreconciled order cannot create Stripe Checkout", () => {
    const result = assertAuthoritativePriceReconciled({
      authoritativePrice: {
        grossMinor: 23700,
        baseRentalMinor: 20000,
        extrasMinor: 1200,
        pickupFeeMinor: 0,
        returnFeeMinor: 0,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PRICE_BREAKDOWN_MISMATCH);
  });

  test("7. manual adjustment is explicitly labelled", () => {
    const rec = reconcileAuthoritativePriceBreakdown({
      authoritativePrice: {
        grossMinor: 45000,
        baseRentalMinor: 20000,
        extrasMinor: 1200,
        pickupFeeMinor: 0,
        returnFeeMinor: 2500,
        manualAdjustmentMinor: 21300,
      },
      priceCorrection: true,
    });
    const rows = formatReconciledBreakdownRows(rec);
    expect(rows.find((row) => row.code === "MANUAL_ADJUSTMENT")).toMatchObject({
      label: "Manual adjustment",
      minor: 21300,
    });
  });

  test("8. discounts reconcile correctly", () => {
    const rec = reconcileAuthoritativePriceBreakdown({
      authoritativePrice: {
        grossMinor: 18000,
        baseRentalMinor: 20000,
        extrasMinor: 0,
        pickupFeeMinor: 0,
        returnFeeMinor: 0,
        discountMinor: 2000,
      },
    });
    expect(rec.isReconciled).toBe(true);
    expect(rec.discountMinor).toBe(2000);
    expect(rec.totalMinor).toBe(18000);
  });

  test("10. customer/partner/admin totals use the same authoritative breakdown", () => {
    const source = {
      authoritativePrice: {
        grossMinor: 23700,
        baseRentalMinor: 20000,
        extrasMinor: 1200,
        pickupFeeMinor: 0,
        returnFeeMinor: 2500,
      },
      locationSnapshot: {
        pickup: { kind: "office", feeMajor: 0, name: "Office" },
        return: { kind: "delivery", feeMajor: 25, name: "Barcelona" },
      },
    };
    const admin = reconcileAuthoritativePriceBreakdown(source, { locale: "en" });
    const customer = reconcileAuthoritativePriceBreakdown(source, { locale: "es" });
    expect(admin.totalMinor).toBe(customer.totalMinor);
    expect(admin.returnFeeMinor).toBe(2500);
    expect(customer.returnFeeMinor).toBe(2500);
  });

  test("11. Greece legacy orders are not represented as marketplace delivery", () => {
    const rec = reconcileAuthoritativePriceBreakdown({
      bookingMode: BOOKING_MODES.OPS_CALENDAR,
      totalPrice: 150,
      priceBreakdown: {
        baseRentalTotal: 150,
        deliveryTotal: 0,
      },
    });
    expect(rec.totalMinor).toBe(15000);
    expect(rec.isReconciled).toBe(true);
  });

  test("12. transfers stay outside this helper — no transfer fields are required", () => {
    const rec = reconcileAuthoritativePriceBreakdown({
      transferId: "t1",
      totalPrice: 80,
      priceBreakdown: { baseRentalTotal: 80 },
    });
    expect(rec.totalMinor).toBe(8000);
  });
});

describe("checkout / reissue gates stay conservative", () => {
  test("paid reissue cannot reprice", () => {
    const order = {
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      partnerConfirmedAt: new Date(),
      payment: { status: "paid", amountMinor: 2370, currency: "EUR" },
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 23700,
        prepaymentMinor: 2370,
        balanceMinor: 21330,
      },
    };
    order.payment.priceChecksum = computePriceSnapshotChecksum(order);
    const result = evaluatePaymentLinkReissue(order);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("already_paid");
  });

  test("alternative paid cap keeps the paid platform fee", () => {
    const cap = applyReplacementPriceCap({
      calculatedGrossMinor: 45000,
      originalGrossMinor: 50000,
      feeBps: 1000,
      fixedPaidPlatformAmountMinor: 5000,
    });
    expect(cap.platformAmountMinor).toBe(5000);
    expect(cap.supplierBalanceMinor).toBe(40000);
    expect(cap.offeredGrossMinor).toBe(45000);
  });
});
