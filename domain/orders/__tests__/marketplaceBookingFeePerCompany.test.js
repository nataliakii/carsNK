/**
 * @jest-environment node
 *
 * The Rovaro Booking Fee percentage is negotiated per company. 10% is only the
 * platform default, and 30% must behave exactly as well as 10% everywhere the
 * rate is resolved, split or shown to a human.
 *
 * The other half of the rule: a rate already captured on a booking is history.
 * Changing what a company is on today may never restate what it was charged.
 */

import {
  MARKETPLACE_BOOKING_FEE_SOURCE,
  MAX_MARKETPLACE_BOOKING_FEE_BPS,
  MIN_MARKETPLACE_BOOKING_FEE_BPS,
  MarketplaceBookingFeeError,
  assertMarketplaceBookingFee,
  marketplacePlatformAmountMinor,
  parseMarketplaceBookingFeeBps,
  resolveBookingFeeBps,
} from "../marketplaceBookingFee";
import {
  formatSnapshotMoney,
  resolveBookingFinancialSnapshot,
} from "../bookingFinancialSnapshot";
import { marketplaceFinancialSplitFromMajor } from "../marketplaceFinancialSplit";
import {
  bookingPaymentAmounts,
  stripeBookingProductTitle,
} from "@/domain/bookings/bookingEmailPolicy";

const RENTAL_602_MINOR = 60200;

/** The real historical capture: €61.85 is 11% of €562.27. */
const PAID_AT_ELEVEN_PERCENT = Object.freeze({
  payment: { status: "paid", paidAmountMinor: 6185 },
  bookingFinancialSnapshot: {
    calculationVersion: 1,
    currency: "EUR",
    feeBps: 1100,
    feePercent: 11,
    grossMinor: 56227,
    bookingFeeMinor: 6185,
    supplierBalanceMinor: 50042,
    source: "configured",
  },
  carModel: "Seat Leon",
});

describe("a company on the platform default resolves to 10%", () => {
  test("no company override and no platform override", () => {
    const fee = resolveBookingFeeBps({ company: {} });
    expect(fee.bps).toBe(1000);
    expect(fee.percent).toBe(10);
    expect(fee.percentLabel).toBe("10");
    expect(fee.source).toBe(MARKETPLACE_BOOKING_FEE_SOURCE.DEFAULT);
    expect(fee.isDefault).toBe(true);
    expect(fee.isNegotiated).toBe(false);
  });

  test("an unset company inherits the platform rate, not the module default", () => {
    const fee = resolveBookingFeeBps({
      company: { marketplaceBookingFeeBps: null },
      platformSettings: { marketplaceBookingFeeBps: 1200 },
    });
    expect(fee.bps).toBe(1200);
    expect(fee.source).toBe(MARKETPLACE_BOOKING_FEE_SOURCE.PLATFORM);
    expect(fee.isNegotiated).toBe(false);
  });
});

describe("a company negotiated at 30% resolves to 30%", () => {
  const company = { marketplaceBookingFeeBps: 3000 };

  test("the resolver reports the negotiated rate and its supplier half", () => {
    const fee = resolveBookingFeeBps({ company });
    expect(fee.bps).toBe(3000);
    expect(fee.percent).toBe(30);
    expect(fee.percentLabel).toBe("30");
    expect(fee.supplierPercentLabel).toBe("70");
    expect(fee.source).toBe(MARKETPLACE_BOOKING_FEE_SOURCE.OVERRIDE);
    expect(fee.isNegotiated).toBe(true);
  });

  test("a €602.00 rental splits €180.60 / €421.40", () => {
    const fee = resolveBookingFeeBps({ company });
    const split = marketplaceFinancialSplitFromMajor(602, "EUR", {
      feeBps: fee.bps,
    });
    expect(split.grossMinor).toBe(RENTAL_602_MINOR);
    expect(split.platformAmountMinor).toBe(18060);
    expect(split.supplierBalanceMinor).toBe(42140);
    expect(split.platformAmountMinor + split.supplierBalanceMinor).toBe(
      RENTAL_602_MINOR
    );
    expect(split.feePercent).toBe(30);
    expect(split.supplierBalancePercent).toBe(70);
    expect(split.payoutMinor).toBe(0);
  });

  test("the Stripe product title says 30%, not 10%", () => {
    const order = {
      bookingMode: "MARKETPLACE_REQUEST",
      carModel: "Seat Leon",
      authoritativePrice: {
        currency: "EUR",
        grossMinor: RENTAL_602_MINOR,
        marketplaceBookingFeeBps: 3000,
        platformAmountMinor: 18060,
      },
    };
    expect(stripeBookingProductTitle({ order })).toBe(
      "30% booking payment — Seat Leon"
    );
  });

  test("nothing clamps or rounds towards 10% across the whole range", () => {
    for (const bps of [
      MIN_MARKETPLACE_BOOKING_FEE_BPS,
      500,
      1000,
      1750,
      2250,
      MAX_MARKETPLACE_BOOKING_FEE_BPS,
    ]) {
      const fee = resolveBookingFeeBps({
        company: { marketplaceBookingFeeBps: bps },
      });
      expect(fee.bps).toBe(bps);
      expect(marketplacePlatformAmountMinor(RENTAL_602_MINOR, bps)).toBe(
        Math.round((RENTAL_602_MINOR * bps) / 10000)
      );
    }
  });
});

describe("a paid order captured at 11% keeps 11% and €61.85", () => {
  test("the snapshot wins over the company's rate today", () => {
    const fee = resolveBookingFeeBps({
      order: PAID_AT_ELEVEN_PERCENT,
      company: { marketplaceBookingFeeBps: 1000 },
      platformSettings: { marketplaceBookingFeeBps: 3000 },
    });
    expect(fee.bps).toBe(1100);
    expect(fee.percentLabel).toBe("11");
    expect(fee.source).toBe(MARKETPLACE_BOOKING_FEE_SOURCE.SNAPSHOT);
  });

  test("the financial snapshot still reads €61.85", () => {
    const snap = resolveBookingFinancialSnapshot(PAID_AT_ELEVEN_PERCENT, {
      company: { marketplaceBookingFeeBps: 1000 },
    });
    expect(snap.feeBps).toBe(1100);
    expect(snap.feePercent).toBe(11);
    expect(snap.bookingFeeMinor).toBe(6185);
    expect(formatSnapshotMoney(snap.bookingFeeMinor, snap.currency)).toBe(
      "€61.85"
    );
    expect(snap.supplierBalanceMinor).toBe(50042);
  });

  test("every human-facing rendering uses the captured rate", () => {
    const amounts = bookingPaymentAmounts(PAID_AT_ELEVEN_PERCENT);
    expect(amounts.feePercentLabel).toBe("11");
    expect(amounts.bookingPayment).toBe("€61.85");
    expect(stripeBookingProductTitle({ order: PAID_AT_ELEVEN_PERCENT })).toBe(
      "11% booking payment — Seat Leon"
    );
  });

  test("a legacy order with no stored bps derives its own rate, not 10%", () => {
    const legacy = {
      bookingMode: "MARKETPLACE_REQUEST",
      payment: { status: "paid" },
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 56227,
        platformAmountMinor: 6185,
      },
    };
    const fee = resolveBookingFeeBps({
      order: legacy,
      company: { marketplaceBookingFeeBps: 1000 },
    });
    expect(fee.bps).toBe(1100);
    expect(fee.source).toBe(MARKETPLACE_BOOKING_FEE_SOURCE.DERIVED);
    expect(resolveBookingFinancialSnapshot(legacy).bookingFeeMinor).toBe(6185);
  });
});

describe("an invalid stored rate is rejected, never defaulted to 10%", () => {
  test.each([
    ["above the negotiable maximum", 4000],
    ["below the negotiable minimum", 50],
    ["not a number", "thirty"],
    ["fractional basis points", 1000.5],
    ["negative", -1000],
  ])("%s is refused on write", (_label, value) => {
    expect(parseMarketplaceBookingFeeBps(value).ok).toBe(false);
  });

  test("a company already holding junk resolves as invalid with no bps", () => {
    const fee = resolveBookingFeeBps({
      company: { marketplaceBookingFeeBps: 9999999 },
    });
    expect(fee.source).toBe(MARKETPLACE_BOOKING_FEE_SOURCE.INVALID);
    expect(fee.bps).toBeNull();
    expect(fee.percentLabel).toBe("");
    expect(fee.error).toBeTruthy();
  });

  test("money paths fail loudly rather than charging 10%", () => {
    const fee = resolveBookingFeeBps({
      company: { marketplaceBookingFeeBps: "thirty" },
    });
    expect(() => assertMarketplaceBookingFee(fee)).toThrow(
      MarketplaceBookingFeeError
    );
    expect(() =>
      marketplacePlatformAmountMinor(RENTAL_602_MINOR, "thirty")
    ).toThrow(MarketplaceBookingFeeError);
  });

  test("a deliberately unset rate is not junk and still resolves", () => {
    for (const value of [null, undefined, ""]) {
      const fee = resolveBookingFeeBps({
        company: { marketplaceBookingFeeBps: value },
      });
      expect(fee.source).not.toBe(MARKETPLACE_BOOKING_FEE_SOURCE.INVALID);
      expect(fee.bps).toBe(1000);
    }
  });
});
