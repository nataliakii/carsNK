/**
 * @jest-environment node
 */
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { contractorOrderMoneyRow } from "@/domain/admin/rovaroContractorAdmin";
import { resolveRentalCheckoutAmount } from "../companyRentalPaymentPolicy";
import {
  BOOKING_FEE_CALCULATION_VERSION,
  bookingFeeMinorForRefund,
  buildBookingFinancialSnapshot,
  formatSnapshotMoney,
  resolveBookingFinancialSnapshot,
} from "../bookingFinancialSnapshot";
import { renderCustomerBookingConfirmedEmail } from "@/app/ui/email/templates/customerBookingConfirmed";
import { DEFAULT_MARKETPLACE_BOOKING_FEE_BPS } from "../marketplaceBookingFee";
import { bookingPaymentAmounts } from "@/domain/bookings/bookingEmailPolicy";
import { buildPublicBookingView } from "@/domain/booking/publicBookingView";

const EUR_165_MINOR = 16500;

function order165(extra = {}) {
  return {
    my_order: true,
    source: "PLATFORM",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    currency: "EUR",
    totalPrice: 165,
    ...extra,
  };
}

/** A booking with no bookingFinancialSnapshot, resolved from stored amounts. */
function storedAmountsOrder(authoritativePrice, extra = {}) {
  return {
    my_order: true,
    source: "PLATFORM",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    currency: "EUR",
    totalPrice: (Number(authoritativePrice.grossMinor) || 0) / 100,
    publicReference: "RVR-7K4P9",
    bookingStatus: "BOOKING_CONFIRMED",
    carModel: "Seat Leon",
    authoritativePrice: { currency: "EUR", ...authoritativePrice },
    ...extra,
  };
}

describe("booking financial snapshot", () => {
  test("configured 10% of €165 is a €16.50 Booking Fee and €148.50 supplier balance", () => {
    expect(DEFAULT_MARKETPLACE_BOOKING_FEE_BPS).toBe(1000);
    const snap = buildBookingFinancialSnapshot({
      grossMinor: EUR_165_MINOR,
      currency: "EUR",
      feeBps: DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
    });
    expect(snap.calculationVersion).toBe(BOOKING_FEE_CALCULATION_VERSION);
    expect(snap.feeBps).toBe(1000);
    expect(snap.feePercent).toBe(10);
    expect(snap.grossMinor).toBe(16500);
    expect(snap.bookingFeeMinor).toBe(1650);
    expect(snap.supplierBalanceMinor).toBe(14850);
    expect(formatSnapshotMoney(snap.bookingFeeMinor, "EUR")).toBe("€16.50");
    expect(formatSnapshotMoney(snap.supplierBalanceMinor, "EUR")).toBe("€148.50");
    expect(formatSnapshotMoney(snap.grossMinor, "EUR")).toBe("€165.00");
  });

  test("a new marketplace booking uses the configured fee, not a hardcoded template rate", () => {
    const snap = resolveBookingFinancialSnapshot(order165(), {
      platformSettings: { marketplaceBookingFeeBps: 1000 },
    });
    expect(snap.bookingFeeMinor).toBe(1650);
    expect(snap.supplierBalanceMinor).toBe(14850);
    expect(snap.feePercent).toBe(10);
    const checkout = resolveRentalCheckoutAmount(order165(), {
      platformSettings: { marketplaceBookingFeeBps: 1000 },
    });
    expect(checkout.amountMinor).toBe(snap.bookingFeeMinor);
    expect(checkout.balanceMinor).toBe(snap.supplierBalanceMinor);
    expect(checkout.grossMinor).toBe(snap.grossMinor);
  });

  test("a stored 11% paid snapshot is not rewritten to 10%", () => {
    const paid = order165({
      authoritativePrice: {
        currency: "EUR",
        grossMinor: 16500,
        marketplaceBookingFeeBps: 1100,
        platformAmountMinor: 1815,
        prepaymentMinor: 1815,
        supplierBalanceMinor: 14685,
        balanceMinor: 14685,
      },
      bookingFinancialSnapshot: {
        calculationVersion: 1,
        currency: "EUR",
        feeBps: 1100,
        feePercent: 11,
        grossMinor: 16500,
        bookingFeeMinor: 1815,
        supplierBalanceMinor: 14685,
      },
      payment: { status: "paid", paidAmountMinor: 1815, amountMinor: 1815 },
    });
    const snap = resolveBookingFinancialSnapshot(paid, { feeBps: 1000 });
    expect(snap.source).toBe("snapshot");
    expect(snap.bookingFeeMinor).toBe(1815);
    expect(snap.supplierBalanceMinor).toBe(14685);
    expect(snap.feeBps).toBe(1100);
    expect(bookingFeeMinorForRefund(paid)).toBe(1815);
  });

  test("orders table and customer email match the stored snapshot", () => {
    const snap = buildBookingFinancialSnapshot({
      grossMinor: EUR_165_MINOR,
      feeBps: 1000,
    });
    const order = order165({
      bookingFinancialSnapshot: snap,
      authoritativePrice: {
        currency: "EUR",
        grossMinor: snap.grossMinor,
        marketplaceBookingFeeBps: snap.feeBps,
        platformAmountMinor: snap.bookingFeeMinor,
        supplierBalanceMinor: snap.supplierBalanceMinor,
      },
    });
    const row = contractorOrderMoneyRow(order);
    expect(row.rentalTotal).toBe(165);
    expect(row.bookingFee).toBe(16.5);
    expect(row.dueToCompany).toBe(148.5);
    const email = renderCustomerBookingConfirmedEmail({
      vehicleName: "Seat Leon",
      shortDateRange: "1–5 Oct",
      pickupWhen: "1 Oct 10:00",
      returnWhen: "5 Oct 10:00",
      pickupLocation: "Barcelona",
      returnLocation: "Barcelona",
      total: formatSnapshotMoney(snap.grossMinor, snap.currency),
      bookingFee: formatSnapshotMoney(snap.bookingFeeMinor, snap.currency),
      supplierBalance: formatSnapshotMoney(snap.supplierBalanceMinor, snap.currency),
      supplierName: "Test Spanish Company",
      supplierPhone: "+34111",
      supplierEmail: "desk@example.com",
      collectionInstructions: "Meet at the office",
      publicReference: "RVR-7K4P9",
      detailsUrl: "https://rovaro.autos/en/booking/RVR-7K4P9?access=opaque",
    });
    const blob = `${email.html}\n${email.text}`;
    expect(blob).toContain("€165.00");
    expect(blob).toContain("€16.50");
    expect(blob).toContain("€148.50");
    expect(blob).toContain("Total rental price");
    expect(blob).toContain("Paid to Rovaro");
    expect(blob).toContain("Pay to the rental company");
    expect(row.bookingFee * 100).toBe(snap.bookingFeeMinor);
    expect(row.dueToCompany * 100).toBe(snap.supplierBalanceMinor);
  });
});

describe("stored amounts that contradict gross minus fee", () => {
  const CORRUPT_AUTH = {
    grossMinor: 43700,
    marketplaceBookingFeeBps: 1000,
    platformAmountMinor: 4370,
    prepaymentMinor: 4370,
    supplierBalanceMinor: 100,
    balanceMinor: 100,
  };

  test("a stale stored supplier balance is corrected to gross minus fee", () => {
    const snap = resolveBookingFinancialSnapshot(storedAmountsOrder(CORRUPT_AUTH));
    expect(snap.source).toBe("stored_amounts");
    expect(snap.grossMinor).toBe(43700);
    expect(snap.bookingFeeMinor).toBe(4370);
    expect(snap.supplierBalanceMinor).toBe(39330);
    expect(snap.bookingFeeMinor + snap.supplierBalanceMinor).toBe(snap.grossMinor);
    expect(contractorOrderMoneyRow(storedAmountsOrder(CORRUPT_AUTH)).dueToCompany).toBe(
      393.3
    );
  });

  test("a consistent stored triple resolves exactly as the corrected one", () => {
    const consistent = resolveBookingFinancialSnapshot(
      storedAmountsOrder({
        ...CORRUPT_AUTH,
        supplierBalanceMinor: 39330,
        balanceMinor: 39330,
      })
    );
    expect(consistent.supplierBalanceMinor).toBe(39330);
    expect(consistent).toEqual(
      resolveBookingFinancialSnapshot(storedAmountsOrder(CORRUPT_AUTH))
    );
  });

  test("a paid 11% booking kept only as stored amounts is preserved exactly", () => {
    const historical = storedAmountsOrder(
      {
        grossMinor: 16500,
        marketplaceBookingFeeBps: 1100,
        platformAmountMinor: 1815,
        prepaymentMinor: 1815,
        supplierBalanceMinor: 14685,
        balanceMinor: 14685,
      },
      {
        paidMarketplaceFeeSnapshot: {
          currency: "EUR",
          marketplaceBookingFeeBps: 1100,
          platformAmountMinor: 1815,
          amountMinor: 1815,
        },
        payment: { status: "paid", paidAmountMinor: 1815, amountMinor: 1815 },
      }
    );
    expect(resolveBookingFinancialSnapshot(historical, { feeBps: 1000 })).toEqual({
      calculationVersion: BOOKING_FEE_CALCULATION_VERSION,
      currency: "EUR",
      feeBps: 1100,
      feePercent: 11,
      grossMinor: 16500,
      bookingFeeMinor: 1815,
      supplierBalanceMinor: 14685,
      source: "stored_amounts",
    });
    expect(bookingFeeMinorForRefund(historical)).toBe(1815);
  });

  test("the customer email and public booking page show the corrected balance", () => {
    expect(bookingPaymentAmounts(storedAmountsOrder(CORRUPT_AUTH))).toMatchObject({
      bookingPayment: "€43.70",
      payableToSupplier: "€393.30",
      total: "€437.00",
    });
    const view = buildPublicBookingView(storedAmountsOrder(CORRUPT_AUTH), {
      name: "Test Spanish Company",
    });
    expect(view.supplierBalance).toBe("€393.30");
    expect(view.bookingFee).toBe("€43.70");
    expect(view.total).toBe("€437.00");
  });
});
