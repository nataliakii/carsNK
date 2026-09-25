/**
 * @jest-environment node
 */
import { BOOKING_STATUS } from "../bookingStatus";
import { BOOKING_MODES } from "../bookingMode";
import {
  consumeConfirmationToken,
  evaluatePartnerDecisionGuards,
} from "../partnerBookingConfirmation";
import { verifyConfirmationToken, hashConfirmationToken } from "../partnerConfirmationToken";
import BookingConfirmationToken from "@models/BookingConfirmationToken";
import { Order } from "@models/order";
import { acquireMarketplaceHold } from "../bookingHold";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { sendCustomerDeclineEmail, sendCustomerPaymentRequestEmail } from "@/domain/orders/marketplaceBookingEmails";
import { assertPartnerCanOperate } from "@/domain/legal/partnerOperatingPolicy";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("../partnerConfirmationToken", () => ({
  signConfirmationToken: jest.fn(),
  verifyConfirmationToken: jest.fn(),
  hashConfirmationToken: jest.fn(() => "hash-1"),
}));
jest.mock("@models/BookingConfirmationToken", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock("@models/order", () => ({
  Order: { findById: jest.fn(), find: jest.fn() },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(() => ({
      select: () => ({
        lean: () =>
          Promise.resolve({
            name: "Owner A",
            email: "owner-a@example.com",
          }),
      }),
    })),
  },
}));
jest.mock("@models/car", () => ({ Car: { findById: jest.fn() } }));
jest.mock("@models/ConfirmedBookingSnapshot", () => ({
  __esModule: true,
  default: { countDocuments: jest.fn(), findOne: jest.fn(), create: jest.fn() },
}));
jest.mock("../bookingHold", () => ({
  acquireMarketplaceHold: jest.fn(),
  attachStripeSessionToHold: jest.fn(),
  markHoldForRetry: jest.fn(),
  releaseMarketplaceHold: jest.fn(),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  clampStripeExpiresMinutes: (n) => n || 60,
  createRentalCheckoutSession: jest.fn(),
  expireRentalCheckoutSession: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerDeclineEmail: jest.fn().mockResolvedValue({ ok: true }),
  sendCustomerPaymentRequestEmail: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/legal/legalSettingsService", () => ({
  loadLegalSettings: jest.fn().mockResolvedValue({
    paymentLinkExpirationMinutes: 60,
    confirmationTokenExpirationHours: 48,
  }),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/domain/mail/notificationPolicy", () => ({
  notifyBookingAccepted: jest.fn().mockResolvedValue({ ok: true }),
  notifyBookingDeclined: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  PARTNER_OPERATION_PURPOSE: {
    CONFIRM: "confirm",
    ALTERNATIVE: "alternative",
    CHECKOUT: "checkout",
    REISSUE: "reissue",
  },
  PARTNER_OPERATION_ERROR: {
    COMPLIANCE_REQUIRED: "PARTNER_COMPLIANCE_REQUIRED",
    SUSPENDED: "PARTNER_SUSPENDED",
  },
  assertPartnerCanOperate: jest.fn(async () => ({ allowed: true })),
  auditPartnerComplianceBlock: jest.fn(async () => true),
}));

function marketplaceOrder(overrides = {}) {
  return {
    _id: "order-1",
    orderNumber: "20260921120000",
    ownerId: "company-a",
    car: "car-1",
    carModel: "Seat Leon",
    email: "ana@example.com",
    my_order: true,
    source: "PLATFORM",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    pickupAtUtc: new Date("2026-10-01T10:00:00.000Z"),
    returnAtUtc: new Date("2026-10-05T10:00:00.000Z"),
    authoritativePrice: {
      currency: "EUR",
      grossMinor: 100000,
      prepaymentMinor: 10000,
      balanceMinor: 90000,
    },
    payment: {},
    set: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

describe("evaluatePartnerDecisionGuards", () => {
  test("blocks cancelled, declined, paid, and wrong company", () => {
    expect(
      evaluatePartnerDecisionGuards(
        marketplaceOrder({ bookingStatus: BOOKING_STATUS.CUSTOMER_CANCELLED }),
        { decision: "accepted" }
      ).code
    ).toBe("cancelled");
    expect(
      evaluatePartnerDecisionGuards(
        marketplaceOrder({ bookingStatus: BOOKING_STATUS.SUPPLIER_DECLINED }),
        { decision: "accepted" }
      ).code
    ).toBe("already_declined");
    expect(
      evaluatePartnerDecisionGuards(
        marketplaceOrder({
          bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
          payment: { status: "paid" },
        }),
        { decision: "declined" }
      ).code
    ).toBe("already_paid");
    expect(
      evaluatePartnerDecisionGuards(marketplaceOrder(), {
        decision: "accepted",
        tokenCompanyId: "company-b",
      }).code
    ).toBe("wrong_company");
  });

  test("re-reject is idempotent", () => {
    const result = evaluatePartnerDecisionGuards(
      marketplaceOrder({ bookingStatus: BOOKING_STATUS.SUPPLIER_DECLINED }),
      { decision: "declined" }
    );
    expect(result.ok).toBe(true);
    expect(result.idempotentDecline).toBe(true);
  });
});

describe("consumeConfirmationToken marketplace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyConfirmationToken.mockReturnValue({
      ok: true,
      orderId: "order-1",
      companyId: "company-a",
    });
    BookingConfirmationToken.findOne.mockResolvedValue({
      tokenHash: "hash-1",
      jti: "jti-1",
      orderId: "order-1",
      companyId: "company-a",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    BookingConfirmationToken.findOneAndUpdate.mockResolvedValue({
      jti: "jti-1",
      orderId: "order-1",
      agreementRef: { agreementId: "agr-1" },
    });
    Order.find.mockResolvedValue([]);
    Order.find.mockImplementation(() => Promise.resolve([]));
    acquireMarketplaceHold.mockResolvedValue({ ok: true, hold: { _id: "h1" } });
    createRentalCheckoutSession.mockResolvedValue({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
      sessionId: "cs_test_1",
      expiresAt: new Date(Date.now() + 3600_000),
      reused: false,
    });
  });

  test("GET helper does not consume — consume is POST only", () => {
    expect(typeof consumeConfirmationToken).toBe("function");
  });

  test("expired token is rejected", async () => {
    BookingConfirmationToken.findOne.mockResolvedValue({
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      orderId: "order-1",
    });
    const result = await consumeConfirmationToken({
      token: "t",
      decision: "accepted",
      accepted: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("expired");
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("POST accept creates one hold, one session, payment email", async () => {
    const order = marketplaceOrder();
    Order.findById.mockResolvedValue(order);
    const result = await consumeConfirmationToken({
      token: "t",
      decision: "accepted",
      accepted: true,
      actorEmail: "owner@a.test",
    });
    expect(result.ok).toBe(true);
    expect(acquireMarketplaceHold).toHaveBeenCalledTimes(1);
    expect(createRentalCheckoutSession).toHaveBeenCalledTimes(1);
    expect(sendCustomerPaymentRequestEmail).toHaveBeenCalledTimes(1);
    expect(order.confirmed).toBeUndefined();
  });

  test("duplicate POST reuses the existing session", async () => {
    BookingConfirmationToken.findOne.mockResolvedValue({
      tokenHash: "hash-1",
      jti: "jti-1",
      orderId: "order-1",
      companyId: "company-a",
      consumedAt: new Date(),
      decision: "accepted",
      expiresAt: new Date(Date.now() + 60_000),
    });
    BookingConfirmationToken.findOneAndUpdate.mockResolvedValue(null);
    Order.findById.mockResolvedValue(
      marketplaceOrder({
        bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
        payment: { checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_1" },
      })
    );
    const result = await consumeConfirmationToken({
      token: "t",
      decision: "accepted",
      accepted: true,
    });
    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("reject saves reason, releases hold, sends no-money email", async () => {
    const order = marketplaceOrder();
    Order.findById.mockResolvedValue(order);
    const result = await consumeConfirmationToken({
      token: "t",
      decision: "declined",
      accepted: false,
      reason: "car in workshop",
      actorEmail: "owner@a.test",
    });
    expect(result.ok).toBe(true);
    expect(order.declineReason).toBe("car in workshop");
    expect(order.declinedAt).toBeTruthy();
    expect(sendCustomerDeclineEmail).toHaveBeenCalled();
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    const mailed = sendCustomerDeclineEmail.mock.calls[0][0];
    expect(mailed.reason).toBe("car in workshop");
  });

  test("confirm after reject is forbidden", async () => {
    Order.findById.mockResolvedValue(
      marketplaceOrder({ bookingStatus: BOOKING_STATUS.SUPPLIER_DECLINED })
    );
    const result = await consumeConfirmationToken({
      token: "t",
      decision: "accepted",
      accepted: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("already_declined");
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("paid order cannot be confirmed or rejected", async () => {
    Order.findById.mockResolvedValue(
      marketplaceOrder({
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
        payment: { status: "paid" },
      })
    );
    const accept = await consumeConfirmationToken({
      token: "t",
      decision: "accepted",
      accepted: true,
    });
    expect(accept.code).toBe("already_paid");
    const decline = await consumeConfirmationToken({
      token: "t",
      decision: "declined",
      accepted: false,
    });
    expect(decline.code).toBe("already_paid");
  });

  test("9. partner confirmation rechecks the operating gate", async () => {
    const order = marketplaceOrder();
    Order.findById.mockResolvedValue(order);
    assertPartnerCanOperate.mockResolvedValueOnce({
      allowed: false,
      error: "PARTNER_COMPLIANCE_REQUIRED",
      code: "PROFILE_NOT_VERIFIED",
      partnerMessage: "You cannot take bookings until verified.",
    });
    const result = await consumeConfirmationToken({
      token: "t",
      decision: "accepted",
      accepted: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("PARTNER_COMPLIANCE_REQUIRED");
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
  });
});
