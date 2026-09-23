/**
 * @jest-environment node
 *
 * Request → confirm session → webhook → confirm → duplicate harmless →
 * stale session ignored. Stripe is mocked; no live charges.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: {
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn(),
}));
jest.mock("@/domain/booking/bookingHold", () => ({
  finalizeMarketplaceHold: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/booking/expireMarketplacePayment", () => ({
  expireUnpaidMarketplacePayment: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerPaymentRequestEmail: jest.fn(),
}));
jest.mock("@config/stripe", () => ({
  getStripeMode: () => "test",
  isStripeConfigured: () => false,
}));
jest.mock("@/lib/stripe", () => ({ assertStripeReady: jest.fn() }));
jest.mock("@/domain/legal/legalSettingsService", () => ({
  loadLegalSettings: jest.fn().mockResolvedValue({}),
}));

import { Order } from "@models/order";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { expireUnpaidMarketplacePayment } from "@/domain/booking/expireMarketplacePayment";
import {
  evaluateRentalPaidSession,
  handleRentalCheckoutExpired,
  markRentalPaidFromCheckoutSession,
} from "../rentalStripeCheckout";
import { computePriceSnapshotChecksum } from "../priceSnapshotChecksum";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

function pendingOrder() {
  const order = {
    _id: "order-1",
    orderNumber: "200",
    ownerId: "company-a",
    car: "car-1",
    bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
    authoritativePrice: {
      prepaymentMinor: 10000,
      grossMinor: 100000,
      balanceMinor: 90000,
      currency: "EUR",
    },
    payment: {
      status: "pending",
      provider: "stripe",
      providerPaymentId: "cs_new",
      amountMinor: 10000,
      currency: "EUR",
      sessionHistory: [{ sessionId: "cs_old", status: "replaced" }],
    },
    set(key, value) {
      this[key] = value;
    },
    save: jest.fn().mockResolvedValue(true),
    toObject() {
      return { ...this, payment: { ...this.payment } };
    },
  };
  order.payment.priceChecksum = computePriceSnapshotChecksum(order);
  return order;
}

describe("marketplace Stripe flow (fixtures)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("signed paid webhook confirms; duplicate is harmless; old session cannot confirm", async () => {
    const order = pendingOrder();
    const session = {
      id: "cs_new",
      payment_status: "paid",
      amount_total: 10000,
      currency: "eur",
      payment_intent: "pi_1",
      metadata: {
        kind: "rental",
        orderId: "order-1",
        companyId: "company-a",
        priceChecksum: order.payment.priceChecksum,
        prepaymentMinor: "10000",
      },
    };

    expect(evaluateRentalPaidSession(session, order).ok).toBe(true);

    const paidDoc = {
      ...order,
      payment: { ...order.payment, status: "paid" },
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      set: order.set,
      save: order.save,
      toObject: () => ({
        _id: "order-1",
        payment: { status: "paid" },
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      }),
    };
    Order.findOne.mockResolvedValue(order);
    Order.findOneAndUpdate.mockResolvedValue(paidDoc);

    const first = await markRentalPaidFromCheckoutSession(session, {
      eventId: "evt_1",
    });
    expect(first.ok).toBe(true);
    expect(first.idempotent).toBe(false);

    Order.findOne.mockResolvedValue(paidDoc);
    const replay = await markRentalPaidFromCheckoutSession(session, {
      eventId: "evt_1",
    });
    expect(replay.ok).toBe(true);
    expect(replay.idempotent).toBe(true);

    const stale = evaluateRentalPaidSession({ ...session, id: "cs_old" }, order);
    expect(stale.ok).toBe(false);
    expect(stale.code).toBe("stale_session");
    expect(stale.received).toBe(true);
  });

  test("expired current session releases the hold", async () => {
    const order = pendingOrder();
    Order.findOne.mockResolvedValue(order);
    Order.findById.mockResolvedValue(order);
    await handleRentalCheckoutExpired({
      id: "cs_new",
      object: "checkout.session",
      metadata: { kind: "rental", orderId: "order-1" },
    });
    expect(expireUnpaidMarketplacePayment).toHaveBeenCalled();
  });

  test("expired replaced session is ignored and audited", async () => {
    const order = pendingOrder();
    Order.findOne.mockResolvedValue(order);
    Order.findById.mockResolvedValue(order);
    const result = await handleRentalCheckoutExpired({
      id: "cs_old",
      object: "checkout.session",
      metadata: { kind: "rental", orderId: "order-1" },
    });
    expect(result.stale).toBe(true);
    expect(expireUnpaidMarketplacePayment).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RENTAL_PAYMENT_STALE_SESSION" })
    );
  });

  test("14. stale webhook cannot confirm an invalidated session", async () => {
    const order = pendingOrder();
    order.payment.status = "expired";
    order.bookingStatus = BOOKING_STATUS.PAYMENT_EXPIRED;
    order.payment.checkoutUrl = "";
    Order.findOne.mockResolvedValue(order);
    const session = {
      id: "cs_new",
      payment_status: "paid",
      amount_total: 10000,
      currency: "eur",
      payment_intent: "pi_1",
      metadata: {
        kind: "rental",
        orderId: "order-1",
        companyId: "company-a",
        priceChecksum: order.payment.priceChecksum,
        prepaymentMinor: "10000",
      },
    };
    const result = await markRentalPaidFromCheckoutSession(session, {
      eventId: "evt_stale",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("stale_session");
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
