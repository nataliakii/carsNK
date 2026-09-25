/**
 * @jest-environment node
 */
jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve({ name: "Test" }) }),
    })),
  },
}));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));
jest.mock("@/domain/legal/legalSettingsService", () => ({
  loadLegalSettings: jest.fn().mockResolvedValue({ paymentLinkExpirationMinutes: 60 }),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/booking/bookingHold", () => ({
  acquireMarketplaceHold: jest.fn().mockResolvedValue({ ok: true }),
  attachStripeSessionToHold: jest.fn().mockResolvedValue(true),
  markHoldForRetry: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  clampStripeExpiresMinutes: (n) => n,
  createRentalCheckoutSession: jest.fn(),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerPaymentRequestEmail: jest.fn().mockResolvedValue({ ok: true }),
}));

import { Order } from "@models/order";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { sendCustomerPaymentRequestEmail } from "@/domain/orders/marketplaceBookingEmails";
import { startMarketplacePaymentAfterAvailability } from "../startMarketplacePaymentAfterAvailability";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

describe("startMarketplacePaymentAfterAvailability", () => {
  test("does not start Checkout for an internal booking even in marketplace mode", async () => {
    const result = await startMarketplacePaymentAfterAvailability({
      order: {
        _id: "o-int",
        my_order: false,
        source: "INTERNAL",
        bookingMode: "MARKETPLACE_REQUEST",
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      },
    });
    expect(result.code).toBe("not_platform_booking");
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(sendCustomerPaymentRequestEmail).not.toHaveBeenCalled();
  });

  test("creates checkout and emails the customer after availability", async () => {
    createRentalCheckoutSession.mockResolvedValue({
      ok: true,
      url: "https://pay.example/cs",
      sessionId: "cs_1",
      expiresAt: new Date(),
    });
    const saved = {
      _id: "o1",
      my_order: true,
      source: "PLATFORM",
      bookingMode: "MARKETPLACE_REQUEST",
      bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      payment: {},
      save: jest.fn().mockResolvedValue(true),
      toObject: () => ({ _id: "o1" }),
      set: jest.fn(),
    };
    Order.findById.mockResolvedValue(saved);

    const result = await startMarketplacePaymentAfterAvailability({
      order: {
        _id: "o1",
        car: "car1",
        my_order: true,
        source: "PLATFORM",
        bookingMode: "MARKETPLACE_REQUEST",
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
        payment: {},
      },
      actorEmail: "maria@partner.test",
    });

    expect(result.ok).toBe(true);
    expect(result.paymentUrl).toBe("https://pay.example/cs");
    expect(createRentalCheckoutSession).toHaveBeenCalled();
    expect(sendCustomerPaymentRequestEmail).toHaveBeenCalled();
  });

  test("a failed payment email does not roll back the awaiting-payment status", async () => {
    createRentalCheckoutSession.mockResolvedValue({
      ok: true,
      url: "https://pay.example/cs",
      sessionId: "cs_2",
      expiresAt: new Date(),
    });
    sendCustomerPaymentRequestEmail.mockResolvedValueOnce({
      ok: false,
      code: "send_failed",
    });
    const saved = {
      _id: "o2",
      my_order: true,
      source: "PLATFORM",
      bookingMode: "MARKETPLACE_REQUEST",
      bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      payment: { status: "pending" },
      save: jest.fn().mockResolvedValue(true),
      toObject() {
        return { ...this, save: undefined, toObject: undefined, set: undefined };
      },
      set(path, value) {
        this[path] = value;
      },
    };
    Order.findById.mockResolvedValue(saved);

    const result = await startMarketplacePaymentAfterAvailability({
      order: {
        _id: "o2",
        car: "car1",
        my_order: true,
        source: "PLATFORM",
        bookingMode: "MARKETPLACE_REQUEST",
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
        payment: { status: "pending" },
      },
    });

    expect(result.ok).toBe(true);
    expect(saved.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_PROCESSING);
    expect(saved.payment.status).toBe("pending");
    expect(result.mailed).toBe(false);
  });
});
