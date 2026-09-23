/**
 * @jest-environment node
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: {
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@config/stripe", () => ({
  getStripeMode: () => "test",
  isStripeConfigured: () => false,
}));
jest.mock("@/lib/stripe", () => ({
  assertStripeReady: jest.fn(),
}));
jest.mock("@/domain/legal/legalSettingsService", () => ({
  loadLegalSettings: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/booking/bookingHold", () => ({
  finalizeMarketplaceHold: jest.fn(),
  releaseMarketplaceHold: jest.fn(),
}));
jest.mock("@/domain/booking/expireMarketplacePayment", () => ({
  expireUnpaidMarketplacePayment: jest.fn(),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerPaymentRequestEmail: jest.fn(),
}));

import { Order } from "@models/order";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import { assertStripeReady } from "@/lib/stripe";
import {
  buildRentalCheckoutMetadata,
  evaluateRentalPaidSession,
  expireRentalCheckoutSession,
  markRentalPaidFromCheckoutSession,
  recordRentalRefundOrDispute,
} from "../rentalStripeCheckout";
import { computePriceSnapshotChecksum } from "../priceSnapshotChecksum";
import { REFUND_STATUS } from "../stripePaymentRefs";

function paidOrder(overrides = {}) {
  const order = {
    _id: "order-1",
    orderNumber: "100",
    ownerId: "company-a",
    car: "car-1",
    bookingStatus: "BOOKING_CONFIRMED",
    authoritativePrice: {
      prepaymentMinor: 10000,
      grossMinor: 100000,
      balanceMinor: 90000,
      currency: "EUR",
    },
    payment: {
      status: "paid",
      provider: "stripe",
      providerPaymentId: "cs_1",
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
      amountMinor: 10000,
      paidAmountMinor: 10000,
      refundedAmountMinor: 0,
      currency: "EUR",
    },
    set(key, value) {
      this[key] = value;
    },
    save: jest.fn().mockResolvedValue(true),
    toObject() {
      return { ...this, payment: { ...this.payment } };
    },
    ...overrides,
  };
  order.payment.priceChecksum = computePriceSnapshotChecksum(order);
  return order;
}

describe("Stripe metadata and refunds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("checkout metadata includes PaymentIntent fields", () => {
    const order = paidOrder();
    const meta = buildRentalCheckoutMetadata(
      order,
      { amountMinor: 10000, grossMinor: 100000, balanceMinor: 90000, currency: "EUR" },
      { mode: "test", policy: { mode: "stripe_prepayment", timing: "after_confirm" }, priceChecksum: "abc" }
    );
    expect(meta.kind).toBe("rental");
    expect(meta.bookingReference).toBe("100");
    expect(meta.expectedAmountMinor).toBe("10000");
    expect(meta.priceSnapshotChecksum).toBe("abc");
    expect(meta.environment).toBe("test");
    expect(meta).not.toHaveProperty("address");
    expect(meta).not.toHaveProperty("placeIn");
    expect(meta).not.toHaveProperty("placeInDetail");
    expect(meta.alternativeOfferId).toBeDefined();
    expect(meta.payoutMinor).toBe("0");
    expect(meta.stripeAmountMinor).toBe("10000");
    expect(meta.platformAmountMinor).toBe("10000");
    expect(meta.supplierBalanceMinor).toBe("90000");
    expect(JSON.stringify(meta)).not.toMatch(/transfer_data|application_fee|on_behalf_of/);
    expect(JSON.stringify(meta)).not.toMatch(/Carrer|Hotel|street|@|Ana /i);
  });

  test("old session cannot confirm after replacement", () => {
    const order = paidOrder({
      payment: {
        status: "pending",
        providerPaymentId: "cs_new",
        amountMinor: 10000,
        currency: "EUR",
        sessionHistory: [{ sessionId: "cs_old", status: "replaced" }],
      },
    });
    const session = {
      id: "cs_old",
      payment_status: "paid",
      amount_total: 10000,
      currency: "eur",
      metadata: { kind: "rental", orderId: "order-1", companyId: "company-a" },
    };
    const result = evaluateRentalPaidSession(session, order);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("stale_session");
    expect(result.received).toBe(true);
  });

  test("new session can confirm", () => {
    const order = paidOrder({
      payment: {
        status: "pending",
        providerPaymentId: "cs_new",
        amountMinor: 10000,
        currency: "EUR",
        sessionHistory: [{ sessionId: "cs_old", status: "replaced" }],
      },
    });
    order.payment.priceChecksum = computePriceSnapshotChecksum(order);
    const session = {
      id: "cs_new",
      payment_status: "paid",
      amount_total: 10000,
      currency: "eur",
      metadata: {
        kind: "rental",
        orderId: "order-1",
        companyId: "company-a",
        priceChecksum: order.payment.priceChecksum,
        prepaymentMinor: "10000",
      },
    };
    expect(evaluateRentalPaidSession(session, order).ok).toBe(true);
  });

  test("partial refund does not cancel and keeps original payment", async () => {
    const order = paidOrder();
    Order.findOne.mockResolvedValue(order);
    const result = await recordRentalRefundOrDispute(
      "charge.refunded",
      {
        id: "ch_1",
        object: "charge",
        payment_intent: "pi_1",
        amount_refunded: 3000,
        amount: 10000,
      },
      { eventId: "evt_partial" }
    );
    expect(result.refundStatus).toBe(REFUND_STATUS.PARTIAL);
    expect(order.payment.status).toBe("paid");
    expect(order.payment.paidAmountMinor).toBe(10000);
    expect(order.payment.refundedAmountMinor).toBe(3000);
    expect(order.bookingStatus).toBe("BOOKING_CONFIRMED");
  });

  test("full refund marks payment refunded and notifies superadmin", async () => {
    const order = paidOrder();
    Order.findOne.mockResolvedValue(order);
    const result = await recordRentalRefundOrDispute(
      "charge.refunded",
      {
        id: "ch_1",
        object: "charge",
        payment_intent: "pi_1",
        amount_refunded: 10000,
      },
      { eventId: "evt_full" }
    );
    expect(result.refundStatus).toBe(REFUND_STATUS.FULL);
    expect(order.payment.status).toBe("refunded");
    expect(order.payment.paidAmountMinor).toBe(10000);
    expect(notifySuperadmin).toHaveBeenCalled();
  });

  test("duplicate refund event is idempotent", async () => {
    const order = paidOrder({
      payment: {
        status: "refunded",
        providerPaymentId: "cs_1",
        paymentIntentId: "pi_1",
        chargeId: "ch_1",
        paidAmountMinor: 10000,
        refundedAmountMinor: 10000,
        processedStripeEvents: [{ id: "evt_full" }],
      },
    });
    Order.findOne.mockResolvedValue(order);
    const result = await recordRentalRefundOrDispute(
      "charge.refunded",
      { id: "ch_1", object: "charge", payment_intent: "pi_1", amount_refunded: 10000 },
      { eventId: "evt_full" }
    );
    expect(result.idempotent).toBe(true);
    expect(order.save).not.toHaveBeenCalled();
  });

  test("dispute created / updated / closed", async () => {
    const order = paidOrder();
    Order.findOne.mockResolvedValue(order);
    const created = await recordRentalRefundOrDispute(
      "charge.dispute.created",
      { id: "dp_1", object: "dispute", charge: "ch_1", payment_intent: "pi_1" },
      { eventId: "evt_d1" }
    );
    expect(created.disputeStatus).toBe("open");

    order.payment.processedStripeEvents = [{ id: "evt_d1" }];
    const updated = await recordRentalRefundOrDispute(
      "charge.dispute.updated",
      { id: "dp_1", object: "dispute", charge: "ch_1", payment_intent: "pi_1", status: "needs_response" },
      { eventId: "evt_d2" }
    );
    expect(updated.disputeStatus).toBe("needs_response");

    const closed = await recordRentalRefundOrDispute(
      "charge.dispute.closed",
      { id: "dp_1", object: "dispute", charge: "ch_1", payment_intent: "pi_1", status: "won" },
      { eventId: "evt_d3" }
    );
    expect(closed.disputeStatus).toBe("won");
  });

  test("correlates a charge by PaymentIntent without Charge metadata", async () => {
    const order = paidOrder();
    Order.findOne.mockResolvedValue(order);
    await recordRentalRefundOrDispute(
      "charge.refunded",
      { id: "ch_1", object: "charge", payment_intent: "pi_1", amount_refunded: 1000 },
      { eventId: "evt_corr" }
    );
    expect(Order.findById).not.toHaveBeenCalled();
    expect(Order.findOne).toHaveBeenCalled();
  });

  test("amount mismatch is audited and does not confirm", async () => {
    const pending = paidOrder({
      bookingStatus: "PAYMENT_PROCESSING",
      payment: {
        status: "pending",
        providerPaymentId: "cs_1",
        amountMinor: 10000,
        currency: "EUR",
      },
    });
    pending.payment.priceChecksum = computePriceSnapshotChecksum(pending);
    Order.findOne.mockResolvedValue(pending);
    Order.findById.mockResolvedValue(pending);
    const result = await markRentalPaidFromCheckoutSession({
      id: "cs_1",
      payment_status: "paid",
      amount_total: 1,
      currency: "eur",
      metadata: { kind: "rental", orderId: "order-1", companyId: "company-a" },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("amount_mismatch");
    expect(result.received).toBe(true);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RENTAL_PAYMENT_MISMATCH" })
    );
  });

  test("expireRentalCheckoutSession skips a paid order and never refunds", async () => {
    Order.findById.mockResolvedValue(paidOrder());
    const result = await expireRentalCheckoutSession("order-1");
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "already_paid_no_refund",
    });
    expect(assertStripeReady).not.toHaveBeenCalled();
  });
});
