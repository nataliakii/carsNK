/**
 * @jest-environment node
 *
 * Stripe Checkout is not created after marketplace compliance is lost.
 * Stripe SDK is mocked — no live sessions.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: { findById: jest.fn() },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(() => ({
      select: () => ({
        lean: () =>
          Promise.resolve({
            _id: "company-a",
            rentalPayments: { stripeEnabled: true },
          }),
      }),
    })),
  },
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn(),
}));
jest.mock("@/domain/booking/bookingHold", () => ({
  finalizeMarketplaceHold: jest.fn(),
}));
jest.mock("@/domain/booking/expireMarketplacePayment", () => ({
  expireUnpaidMarketplacePayment: jest.fn(),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerPaymentRequestEmail: jest.fn(),
}));
jest.mock("@config/stripe", () => ({
  getStripeMode: () => "test",
  isStripeConfigured: () => true,
}));
const stripeCreate = jest.fn();
jest.mock("@/lib/stripe", () => ({
  assertStripeReady: jest.fn(() => ({
    checkout: { sessions: { create: stripeCreate, expire: jest.fn() } },
  })),
}));
jest.mock("@/domain/legal/legalSettingsService", () => ({
  loadLegalSettings: jest.fn().mockResolvedValue({
    paymentLinkExpirationMinutes: 60,
  }),
}));
jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  PARTNER_OPERATION_PURPOSE: { CHECKOUT: "checkout" },
  assertPartnerCanOperate: jest.fn(),
  auditPartnerComplianceBlock: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/orders/invalidateMarketplaceCheckout", () => ({
  invalidateMarketplaceCheckoutsForOrderRecord: jest.fn().mockResolvedValue([{ ok: true }]),
}));

import { Order } from "@models/order";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { assertPartnerCanOperate } from "@/domain/legal/partnerOperatingPolicy";
import { invalidateMarketplaceCheckoutsForOrderRecord } from "@/domain/orders/invalidateMarketplaceCheckout";
import { createRentalCheckoutSession } from "../rentalStripeCheckout";
import { computePriceSnapshotChecksum } from "../priceSnapshotChecksum";

function marketplaceOrder(overrides = {}) {
  const order = {
    _id: "order-1",
    orderNumber: "20260922120000",
    ownerId: "company-a",
    car: "car-1",
    carModel: "Seat Leon",
    email: "ana@example.com",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PAYMENT_PENDING,
    authoritativePrice: {
      prepaymentMinor: 10000,
      grossMinor: 100000,
      balanceMinor: 90000,
      currency: "EUR",
    },
    payment: { status: "pending" },
    toObject() {
      return { ...this };
    },
    set(key, value) {
      this[key] = value;
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  order.payment.priceChecksum = computePriceSnapshotChecksum(order);
  return order;
}

describe("createRentalCheckoutSession compliance gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("10. Stripe Checkout is not created after compliance is lost", async () => {
    const order = marketplaceOrder();
    Order.findById.mockResolvedValue(order);
    assertPartnerCanOperate.mockResolvedValue({
      allowed: false,
      error: "PARTNER_COMPLIANCE_REQUIRED",
      code: "AGREEMENT_OUTDATED",
      partnerMessage: "Sign the current agreement.",
    });
    const result = await createRentalCheckoutSession("order-1", { forceNew: true });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("PARTNER_COMPLIANCE_REQUIRED");
    expect(stripeCreate).not.toHaveBeenCalled();
    expect(order.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_PENDING);
    expect(order.save).not.toHaveBeenCalled();
    expect(invalidateMarketplaceCheckoutsForOrderRecord).not.toHaveBeenCalled();
  });

  test("does not reuse an open Checkout URL after the operating gate fails", async () => {
    const order = marketplaceOrder({
      payment: {
        status: "pending",
        provider: "stripe",
        providerPaymentId: "cs_open",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_open",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    Order.findById.mockResolvedValue(order);
    assertPartnerCanOperate.mockResolvedValue({
      allowed: false,
      error: "PARTNER_COMPLIANCE_REQUIRED",
      code: "PARTNER_SUSPENDED",
      partnerMessage: "This company cannot take bookings.",
    });
    const result = await createRentalCheckoutSession("order-1");
    expect(result.ok).toBe(false);
    expect(result.reused).toBeUndefined();
    expect(stripeCreate).not.toHaveBeenCalled();
    expect(invalidateMarketplaceCheckoutsForOrderRecord).toHaveBeenCalledWith(
      order,
      expect.objectContaining({ reason: "PARTNER_SUSPENDED" })
    );
  });

  test("Greece ops-calendar checkout skips the Spain operating gate", async () => {
    const order = marketplaceOrder({
      bookingMode: BOOKING_MODES.OPS_CALENDAR,
    });
    Order.findById.mockResolvedValue(order);
    stripeCreate.mockResolvedValue({
      id: "cs_gr",
      url: "https://checkout.stripe.com/c/pay/cs_gr",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    await createRentalCheckoutSession("order-1", { forceNew: true });
    expect(assertPartnerCanOperate).not.toHaveBeenCalled();
  });
});
