/**
 * @jest-environment node
 */
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { computePriceSnapshotChecksum } from "@/domain/orders/priceSnapshotChecksum";
import {
  evaluatePaymentLinkReissue,
  PAYMENT_LINK_REISSUE_REASONS,
  reissueMarketplacePaymentLink,
} from "../reissueMarketplacePaymentLink";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: { findById: jest.fn(), find: jest.fn() },
}));
jest.mock("@models/BookingHold", () => ({
  HOLD_STATUS: { ACTIVE: "active" },
  BookingHold: { findOne: jest.fn() },
}));
jest.mock("@/domain/booking/expiredHoldCleanup", () => ({
  cleanupExpiredHolds: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/booking/bookingHold", () => ({
  acquireMarketplaceHold: jest.fn(),
  attachStripeSessionToHold: jest.fn(),
  markHoldForRetry: jest.fn(),
  releaseMarketplaceHold: jest.fn(),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  clampStripeExpiresMinutes: (n) => n || 60,
  createRentalCheckoutSession: jest.fn(),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerNewPaymentLinkEmail: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/legal/legalSettingsService", () => ({
  loadLegalSettings: jest.fn().mockResolvedValue({
    paymentLinkExpirationMinutes: 60,
  }),
}));
jest.mock("@/domain/booking/availabilityEngine", () => ({
  AVAILABILITY_PURPOSE: { CONFIRM: "confirm" },
  evaluateRentalAvailability: jest.fn(() => ({ hardConflict: false })),
}));
jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  PARTNER_OPERATION_PURPOSE: { REISSUE: "reissue", CHECKOUT: "checkout" },
  PARTNER_OPERATION_ERROR: {
    COMPLIANCE_REQUIRED: "PARTNER_COMPLIANCE_REQUIRED",
    SUSPENDED: "PARTNER_SUSPENDED",
  },
  assertPartnerCanOperate: jest.fn(async () => ({ allowed: true })),
  auditPartnerComplianceBlock: jest.fn(async () => true),
}));

import { Order } from "@models/order";
import {
  acquireMarketplaceHold,
  releaseMarketplaceHold,
} from "@/domain/booking/bookingHold";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { sendCustomerNewPaymentLinkEmail } from "@/domain/orders/marketplaceBookingEmails";
import { assertPartnerCanOperate } from "@/domain/legal/partnerOperatingPolicy";

const authoritativePrice = {
  currency: "EUR",
  grossMinor: 100000,
  prepaymentMinor: 10000,
  balanceMinor: 90000,
};

function baseOrder(overrides = {}) {
  const order = {
    _id: "64b7f2c3a1b2c3d4e5f60789",
    source: "PLATFORM",
    my_order: true,
    orderNumber: "20260921",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PAYMENT_EXPIRED,
    partnerConfirmedAt: new Date("2026-09-21T18:00:00.000Z"),
    companyEmailDecision: "accepted",
    car: "car-1",
    ownerId: "co-1",
    email: "ana@example.com",
    carModel: "Seat Leon",
    pickupAtUtc: "2026-10-01T10:00:00.000Z",
    returnAtUtc: "2026-10-05T10:00:00.000Z",
    authoritativePrice,
    payment: {
      status: "expired",
      provider: "stripe",
      providerPaymentId: "cs_old",
      checkoutUrl: "",
      amountMinor: 10000,
      currency: "EUR",
      expiresAt: new Date("2026-09-21T19:00:00.000Z"),
    },
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
  order.partnerConfirmMeta = { priceChecksum: order.payment.priceChecksum };
  return order;
}

describe("evaluatePaymentLinkReissue", () => {
  test("blocks an active link from being unnecessarily reissued", () => {
    const order = baseOrder({
      bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
      payment: {
        status: "pending",
        provider: "stripe",
        providerPaymentId: "cs_live",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_live",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        priceChecksum: "",
      },
    });
    order.payment.priceChecksum = computePriceSnapshotChecksum(order);
    const result = evaluatePaymentLinkReissue(order);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("session_active");
    expect(result.canResend).toBe(true);
  });

  test("allows an expired link to be reissued", () => {
    const result = evaluatePaymentLinkReissue(baseOrder());
    expect(result.ok).toBe(true);
  });

  test("does not classify missing Stripe sessions as expired payment links", () => {
    const result = evaluatePaymentLinkReissue(
      baseOrder({
        payment: {
          status: "failed",
          provider: "stripe",
          providerPaymentId: "",
          checkoutUrl: "",
          expiresAt: new Date("2026-09-21T19:00:00.000Z"),
          priceChecksum: "",
        },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("payment_link_not_expired");
  });

  test("rental company ADMIN path is not evaluated here — eligibility is marketplace-only", () => {
    const greece = baseOrder({ bookingMode: "OPS_CALENDAR" });
    expect(evaluatePaymentLinkReissue(greece).code).toBe("not_marketplace");
  });
});

describe("reissueMarketplacePaymentLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Order.find.mockResolvedValue([]);
    acquireMarketplaceHold.mockResolvedValue({ ok: true, hold: {} });
    createRentalCheckoutSession.mockResolvedValue({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_new",
      sessionId: "cs_new",
      expiresAt: new Date("2026-09-21T22:00:00.000Z"),
    });
    sendCustomerNewPaymentLinkEmail.mockResolvedValue({ ok: true });
  });

  test("reissue keeps the identical price snapshot", async () => {
    const order = baseOrder();
    const checksum = order.payment.priceChecksum;
    Order.findById.mockResolvedValue(order);
    const result = await reissueMarketplacePaymentLink({
      orderId: order._id,
      reason: PAYMENT_LINK_REISSUE_REASONS.PAYMENT_LINK_EXPIRED,
      actorEmail: "root@rovaro.autos",
    });
    expect(result.ok).toBe(true);
    expect(result.priceChecksum).toBe(checksum);
    expect(createRentalCheckoutSession).toHaveBeenCalledWith(
      String(order._id),
      expect.objectContaining({ forceNew: true })
    );
    expect(sendCustomerNewPaymentLinkEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentUrl: "https://checkout.stripe.com/c/pay/cs_new",
        stripeSessionId: "cs_new",
      })
    );
  });

  test("refuses a second click while the new session is active", async () => {
    const active = baseOrder({
      bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
      payment: {
        status: "pending",
        provider: "stripe",
        providerPaymentId: "cs_new",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_new",
        expiresAt: new Date(Date.now() + 40 * 60 * 1000),
        reissueIdempotencyKey: "idem-1",
      },
    });
    active.payment.priceChecksum = computePriceSnapshotChecksum(active);
    Order.findById.mockResolvedValue(active);
    const result = await reissueMarketplacePaymentLink({
      orderId: active._id,
      reason: PAYMENT_LINK_REISSUE_REASONS.TECHNICAL_RETRY,
      idempotencyKey: "idem-1",
    });
    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("returns the active replacement link state instead of creating a duplicate session", async () => {
    const active = baseOrder({
      bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
      payment: {
        status: "pending",
        provider: "stripe",
        providerPaymentId: "cs_new",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_new",
        expiresAt: new Date(Date.now() + 40 * 60 * 1000),
      },
    });
    active.payment.priceChecksum = computePriceSnapshotChecksum(active);
    Order.findById.mockResolvedValue(active);
    const result = await reissueMarketplacePaymentLink({
      orderId: active._id,
      reason: PAYMENT_LINK_REISSUE_REASONS.PAYMENT_LINK_EXPIRED,
      idempotencyKey: "different-click",
    });
    expect(result.ok).toBe(true);
    expect(result.reused).toBe(true);
    expect(result.sessionId).toBe("cs_new");
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("company admin cannot reissue another company's booking", async () => {
    const order = baseOrder({ ownerId: "co-1" });
    Order.findById.mockResolvedValue(order);
    const result = await reissueMarketplacePaymentLink({
      orderId: order._id,
      reason: PAYMENT_LINK_REISSUE_REASONS.PAYMENT_LINK_EXPIRED,
      actorRole: "admin",
      actorCompanyId: "co-2",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("does not create or email a replacement if payment lands before checkout creation", async () => {
    const expired = baseOrder();
    const paid = baseOrder({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: {
        status: "paid",
        provider: "stripe",
        providerPaymentId: "cs_paid",
        checkoutUrl: "",
        amountMinor: 10000,
        currency: "EUR",
      },
    });
    paid.payment.priceChecksum = computePriceSnapshotChecksum(paid);
    Order.findById
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(paid);
    const result = await reissueMarketplacePaymentLink({
      orderId: expired._id,
      reason: PAYMENT_LINK_REISSUE_REASONS.PAYMENT_LINK_EXPIRED,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("already_paid");
    expect(releaseMarketplaceHold).toHaveBeenCalledWith(expired._id, {
      reason: "paid_before_reissue_checkout",
    });
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(sendCustomerNewPaymentLinkEmail).not.toHaveBeenCalled();
  });

  test("11. payment-link reissue is blocked after suspension", async () => {
    const order = baseOrder();
    Order.findById.mockResolvedValue(order);
    assertPartnerCanOperate.mockResolvedValueOnce({
      allowed: false,
      error: "PARTNER_SUSPENDED",
      code: "PARTNER_SUSPENDED",
      partnerMessage: "Trading is suspended.",
    });
    const result = await reissueMarketplacePaymentLink({
      orderId: order._id,
      reason: PAYMENT_LINK_REISSUE_REASONS.PAYMENT_LINK_EXPIRED,
      actorEmail: "root@rovaro.autos",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("PARTNER_SUSPENDED");
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
    expect(order.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_EXPIRED);
  });

  test("12. existing paid BOOKING_CONFIRMED order is not mutated", async () => {
    const paid = baseOrder({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: {
        status: "paid",
        provider: "stripe",
        providerPaymentId: "cs_paid",
        checkoutUrl: "https://pay",
        amountMinor: 10000,
        currency: "EUR",
      },
    });
    paid.payment.priceChecksum = computePriceSnapshotChecksum(paid);
    Order.findById.mockResolvedValue(paid);
    const result = await reissueMarketplacePaymentLink({
      orderId: paid._id,
      reason: PAYMENT_LINK_REISSUE_REASONS.TECHNICAL_RETRY,
    });
    expect(result.ok).toBe(false);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(paid.save).not.toHaveBeenCalled();
    expect(paid.bookingStatus).toBe(BOOKING_STATUS.BOOKING_CONFIRMED);
    expect(paid.payment.status).toBe("paid");
  });
});
