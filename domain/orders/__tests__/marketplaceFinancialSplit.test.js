/**
 * @jest-environment node
 *
 * Spain marketplace 10%/90% split. Stripe charges 10% into Rovaro's own
 * account; Rovaro retains it; the supplier collects 90% from the customer.
 * No Connect, no supplier payout, no second commission.
 */
import {
  assertNoSupplierPayout,
  marketplaceFinancialSplit,
  marketplaceFinancialSplitFromMajor,
  marketplaceSplitLabels,
} from "../marketplaceFinancialSplit";
import { applyReplacementPriceCap } from "@/domain/booking/alternativeOfferCore";
import { resolveConfirmationFinancials } from "@/domain/booking/partnerBookingConfirmation";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { resolveRentalCheckoutAmount } from "../companyRentalPaymentPolicy";
import { buildRentalCheckoutMetadata } from "../rentalStripeCheckout";
import {
  calculateAuthoritativeRentalPrice,
} from "../rentalPricingService";
import { sendPaidConfirmationEmails } from "../marketplaceBookingEmails";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import MailLog from "@models/MailLog";
import Company from "@models/company";

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
jest.mock("@models/user", () => ({
  ROLE: { ADMIN: 1, SUPERADMIN: 2 },
  User: {
    find: jest.fn().mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              email: "owner@a.test",
              ownerId: "64b7f2c3a1b2c3d4e5f60788",
              disabledAt: null,
              lastLoginAt: new Date(),
            },
          ]),
      }),
    }),
  },
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/delivery/calculateDeliveryPrice", () => ({
  calculateDeliveryPrice: jest.fn().mockResolvedValue({
    deliveryIn: 40,
    deliveryOut: 30,
    deliveryTotal: 70,
  }),
}));

const EUR_500_MINOR = 50000;
const EUR_50_MINOR = 5000;
const EUR_450_MINOR = 45000;

function euro500Order(extra = {}) {
  return {
    _id: "64b7f2c3a1b2c3d4e5f60789",
    orderNumber: "20260922180000",
    ownerId: "64b7f2c3a1b2c3d4e5f60788",
    email: "ana@example.com",
    customerName: "Ana",
    phone: "+34600000000",
    carModel: "Seat Leon",
    clientLang: "en",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    authoritativePrice: {
      currency: "EUR",
      grossMinor: EUR_500_MINOR,
      prepaymentMinor: EUR_50_MINOR,
      balanceMinor: EUR_450_MINOR,
    },
    ...extra,
  };
}

describe("€500 marketplace 10%/90% split", () => {
  test("Stripe amount = €50, platform amount = €50, supplier balance = €450, no payout", () => {
    const split = marketplaceFinancialSplitFromMajor(500, "EUR");
    expect(split.grossMinor).toBe(EUR_500_MINOR);
    expect(split.stripeAmountMinor).toBe(EUR_50_MINOR);
    expect(split.platformAmountMinor).toBe(EUR_50_MINOR);
    expect(split.supplierBalanceMinor).toBe(EUR_450_MINOR);
    expect(split.payoutMinor).toBe(0);
    expect(split.prepaymentPercent).toBe(10);
    expect(split.supplierBalancePercent).toBe(90);
    expect(split.stripeAmountMinor + split.supplierBalanceMinor).toBe(
      split.grossMinor
    );
    expect(assertNoSupplierPayout(split)).toBe(true);
  });

  test("preserves a stored authoritative snapshot instead of rewriting it", () => {
    const split = marketplaceFinancialSplit({
      currency: "EUR",
      grossMinor: EUR_500_MINOR,
      prepaymentMinor: EUR_50_MINOR,
      balanceMinor: EUR_450_MINOR,
    });
    expect(split.stripeAmountMinor).toBe(EUR_50_MINOR);
    expect(split.platformAmountMinor).toBe(EUR_50_MINOR);
    expect(split.supplierBalanceMinor).toBe(EUR_450_MINOR);
    expect(split.payoutMinor).toBe(0);
  });

  test("integer minor-unit formula matches round(gross * 10 / 100)", () => {
    expect(Math.round((EUR_500_MINOR * 10) / 100)).toBe(EUR_50_MINOR);
    const odd = marketplaceFinancialSplit({ grossMinor: 45500, currency: "EUR" });
    expect(odd.platformAmountMinor).toBe(Math.round((45500 * 10) / 100));
    expect(odd.supplierBalanceMinor).toBe(45500 - odd.platformAmountMinor);
  });

  test("checkout amount and confirmation financials use the same split", () => {
    const order = euro500Order();
    const checkout = resolveRentalCheckoutAmount(order);
    const confirmation = resolveConfirmationFinancials(order);
    expect(checkout.amountMinor).toBe(EUR_50_MINOR);
    expect(checkout.platformAmountMinor).toBe(EUR_50_MINOR);
    expect(checkout.stripeAmountMinor).toBe(EUR_50_MINOR);
    expect(checkout.balanceMinor).toBe(EUR_450_MINOR);
    expect(checkout.payoutMinor).toBe(0);
    expect(confirmation.stripeAmountMinor).toBe(EUR_50_MINOR);
    expect(confirmation.platformAmountMinor).toBe(EUR_50_MINOR);
    expect(confirmation.supplierBalanceMinor).toBe(EUR_450_MINOR);
    expect(confirmation.payoutMinor).toBe(0);
  });

  test("Stripe metadata has no Connect / payout fields and payoutMinor is 0", () => {
    const order = euro500Order();
    const amounts = resolveRentalCheckoutAmount(order);
    const meta = buildRentalCheckoutMetadata(order, amounts, {
      mode: "test",
      policy: { mode: "stripe_prepayment", timing: "after_confirm" },
      priceChecksum: "checksum",
    });
    expect(meta.stripeAmountMinor).toBe(String(EUR_50_MINOR));
    expect(meta.platformAmountMinor).toBe(String(EUR_50_MINOR));
    expect(meta.supplierBalanceMinor).toBe(String(EUR_450_MINOR));
    expect(meta.payoutMinor).toBe("0");
    expect(meta).not.toHaveProperty("transfer_data");
    expect(meta).not.toHaveProperty("application_fee");
    expect(meta).not.toHaveProperty("application_fee_amount");
    expect(meta).not.toHaveProperty("on_behalf_of");
    expect(meta).not.toHaveProperty("destination");
    expect(assertNoSupplierPayout(meta)).toBe(true);
    expect(assertNoSupplierPayout({ transfer_data: { destination: "acct_1" } })).toBe(
      false
    );
  });

  test("alternative vehicle flow uses the same 10%/90% calculation", () => {
    const cap = applyReplacementPriceCap({
      calculatedGrossMinor: EUR_500_MINOR,
      originalGrossMinor: EUR_500_MINOR,
    });
    expect(cap.offeredGrossMinor).toBe(EUR_500_MINOR);
    expect(cap.prepaymentMinor).toBe(EUR_50_MINOR);
    expect(cap.stripeAmountMinor).toBe(EUR_50_MINOR);
    expect(cap.platformAmountMinor).toBe(EUR_50_MINOR);
    expect(cap.balanceMinor).toBe(EUR_450_MINOR);
    expect(cap.supplierBalanceMinor).toBe(EUR_450_MINOR);
    expect(cap.payoutMinor).toBe(0);
  });

  test("delivery fees and extras are included in gross before calculating 10%", async () => {
    const quote = await calculateAuthoritativeRentalPrice({
      car: {
        ownerId: "co1",
        calculateTotalRentalPricePerDay: jest.fn().mockResolvedValue({
          total: 430,
          days: 2,
          breakdown: {
            baseRentalTotal: 400,
            kaskoTotal: 20,
            childSeatsTotal: 10,
            secondDriverTotal: 0,
            insurance: "CDW",
          },
        }),
      },
      pickupAtUtc: new Date("2026-06-10T07:00:00.000Z"),
      returnAtUtc: new Date("2026-06-13T07:00:00.000Z"),
      timezone: "Europe/Madrid",
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      insurance: "CDW",
      childSeats: 1,
      quotedPickupFeeMinor: 4000,
      quotedReturnFeeMinor: 3000,
    });
    expect(quote.grossMinor).toBe(EUR_500_MINOR);
    expect(quote.extrasMinor + quote.insuranceMinor).toBe(3000);
    expect(quote.pickupFeeMinor + quote.returnFeeMinor).toBe(7000);
    expect(quote.prepaymentPercent).toBe(10);
    expect(quote.prepaymentMinor).toBe(EUR_50_MINOR);
    expect(quote.balanceMinor).toBe(EUR_450_MINOR);
    const split = marketplaceFinancialSplit(quote);
    expect(split.stripeAmountMinor).toBe(EUR_50_MINOR);
    expect(split.platformAmountMinor).toBe(EUR_50_MINOR);
    expect(split.supplierBalanceMinor).toBe(EUR_450_MINOR);
    expect(split.payoutMinor).toBe(0);
  });
});

describe("€500 marketplace emails", () => {
  const originalInternal = process.env.MAIL_INTERNAL_TO;
  const originalCountry = process.env.NEXT_PUBLIC_SITE_COUNTRY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    process.env.MAIL_INTERNAL_TO = "admin@rovaro.autos";
    MailLog.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    });
    sendEmailDirect.mockResolvedValue({ messageId: "m1" });
    Company.findById.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            email: "owner@a.test",
            name: "Owner A",
            emailPreferences: null,
            langAdmin: "en",
          }),
      }),
    });
  });

  afterAll(() => {
    if (originalInternal === undefined) delete process.env.MAIL_INTERNAL_TO;
    else process.env.MAIL_INTERNAL_TO = originalInternal;
    if (originalCountry === undefined) delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
    else process.env.NEXT_PUBLIC_SITE_COUNTRY = originalCountry;
  });

  test("partner email instructs the supplier to collect only €450", async () => {
    await sendPaidConfirmationEmails({ order: euro500Order() });
    const partnerCall = sendEmailDirect.mock.calls.find((call) =>
      String(call[0].title || "").includes("customer details are now available")
    );
    expect(partnerCall).toBeTruthy();
    const blob = `${partnerCall[0].html}\n${partnerCall[0].message}`;
    expect(blob).toMatch(/paid the Rovaro booking fee/i);
    expect(blob).toContain("EUR 450.00");
    expect(blob).toContain("EUR 500.00");
    expect(blob).toMatch(/remaining balance/i);
    expect(blob).not.toMatch(/transfer to the supplier|settlement|Stripe Connect/i);
  });

  test("customer email says €450 remains payable to the supplier", async () => {
    await sendPaidConfirmationEmails({ order: euro500Order() });
    const customerCall = sendEmailDirect.mock.calls.find((call) =>
      call[0].to.includes("ana@example.com")
    );
    expect(customerCall).toBeTruthy();
    const blob = `${customerCall[0].html}\n${customerCall[0].message}`;
    expect(blob).toContain("Pay at pickup");
    expect(blob).toContain("EUR 450.00");
    expect(blob).toContain("Pay now");
    expect(blob).toContain("EUR 50.00");
    expect(blob).toContain("Total");
    expect(blob).toContain("EUR 500.00");
    expect(blob).toContain("Pay the rest there");
  });
});

describe("marketplace labels", () => {
  test("EN/ES surfaces use the compact three lines", () => {
    expect(marketplaceSplitLabels("en")).toMatchObject({
      total: "Total",
      payNow: "Pay now",
      payAtPickup: "Pay at pickup",
      paidToRovaro: "Paid to Rovaro",
      collectFromCustomer: "Collect from customer",
    });
    expect(marketplaceSplitLabels("es")).toMatchObject({
      total: "Total",
      payNow: "Pagar ahora",
      payAtPickup: "Pagar en la recogida",
      paidToRovaro: "Pagado a Rovaro",
      collectFromCustomer: "Cobrar al cliente",
    });
  });
});
