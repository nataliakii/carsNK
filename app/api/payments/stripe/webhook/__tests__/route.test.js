/**
 * @jest-environment node
 */
import { POST } from "../route";
import { getStripeClient } from "@/lib/stripe";
import {
  handleRentalCheckoutExpired,
  markRentalPaidEmailsSent,
  markRentalPaidFromCheckoutSession,
  recordRentalRefundOrDispute,
} from "@/domain/orders/rentalStripeCheckout";
import { createConfirmedBookingSnapshot } from "@/domain/booking/partnerBookingConfirmation";
import { sendPaidConfirmationEmails } from "@/domain/orders/marketplaceBookingEmails";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@config/stripe", () => ({
  getStripeMode: () => "test",
  getStripeWebhookSecret: () => "whsec_test",
  isStripeConfigured: () => true,
}));
jest.mock("@/lib/stripe", () => ({
  getStripeClient: jest.fn(),
}));
jest.mock("@/domain/transfers/stripeCheckout", () => ({
  markTransferPaidFromCheckoutSession: jest.fn(),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  handleRentalCheckoutExpired: jest.fn().mockResolvedValue({ ok: true }),
  handleRentalPaymentFailed: jest.fn().mockResolvedValue({ ok: true }),
  markRentalPaidEmailsSent: jest.fn(),
  markRentalPaidFromCheckoutSession: jest.fn(),
  recordRentalRefundOrDispute: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/booking/partnerBookingConfirmation", () => ({
  createConfirmedBookingSnapshot: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendPaidConfirmationEmails: jest.fn().mockResolvedValue({}),
}));

function requestWith(headers, body = "{}") {
  return {
    headers: {
      get: (name) => headers[name] || null,
    },
    text: async () => body,
  };
}

describe("stripe rental webhook", () => {
  const constructEvent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getStripeClient.mockReturnValue({
      webhooks: { constructEvent },
    });
  });

  test("bad signature is rejected", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("invalid signature");
    });
    const res = await POST(
      requestWith({ "stripe-signature": "bad" }, "raw")
    );
    expect(res.status).toBe(400);
    expect(markRentalPaidFromCheckoutSession).not.toHaveBeenCalled();
  });

  test("missing signature is rejected", async () => {
    const res = await POST(requestWith({}));
    expect(res.status).toBe(400);
  });

  test("valid paid session confirms once and emails once", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { kind: "rental", orderId: "order-1" },
        },
      },
    });
    markRentalPaidFromCheckoutSession.mockResolvedValue({
      ok: true,
      idempotent: false,
      order: { _id: "order-1" },
    });
    const res = await POST(
      requestWith({ "stripe-signature": "sig" }, "raw")
    );
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(createConfirmedBookingSnapshot).toHaveBeenCalledTimes(1);
    expect(sendPaidConfirmationEmails).toHaveBeenCalledTimes(1);
  });

  test("replay does not send a second paid email or snapshot side-effect twice", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { kind: "rental", orderId: "order-1" },
        },
      },
    });
    markRentalPaidFromCheckoutSession.mockResolvedValue({
      ok: true,
      idempotent: true,
      order: { _id: "order-1", payment: { paidEmailsSentAt: new Date() } },
    });
    const res = await POST(
      requestWith({ "stripe-signature": "sig" }, "raw")
    );
    expect((await res.json()).received).toBe(true);
    expect(sendPaidConfirmationEmails).not.toHaveBeenCalled();
  });

  test("amount mismatch still returns received and does not confirm", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { kind: "rental", orderId: "order-1" },
        },
      },
    });
    markRentalPaidFromCheckoutSession.mockResolvedValue({
      ok: false,
      code: "amount_mismatch",
      received: true,
    });
    const res = await POST(
      requestWith({ "stripe-signature": "sig" }, "raw")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
    expect(sendPaidConfirmationEmails).not.toHaveBeenCalled();
    expect(createConfirmedBookingSnapshot).not.toHaveBeenCalled();
  });

  test("email failure still acknowledges the paid webhook", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { kind: "rental", orderId: "order-1" },
        },
      },
    });
    markRentalPaidFromCheckoutSession.mockResolvedValue({
      ok: true,
      idempotent: false,
      order: { _id: "order-1", payment: { status: "paid" } },
    });
    sendPaidConfirmationEmails.mockRejectedValueOnce(new Error("smtp down"));
    const res = await POST(
      requestWith({ "stripe-signature": "sig" }, "raw")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
    expect(markRentalPaidFromCheckoutSession).toHaveBeenCalled();
    expect(markRentalPaidEmailsSent).not.toHaveBeenCalled();
  });

  test("idempotent replay without a sent marker still tries email once", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { kind: "rental", orderId: "order-1" },
        },
      },
    });
    markRentalPaidFromCheckoutSession.mockResolvedValue({
      ok: true,
      idempotent: true,
      order: { _id: "order-1", payment: { status: "paid" } },
    });
    sendPaidConfirmationEmails.mockResolvedValueOnce({ settled: true });
    const res = await POST(
      requestWith({ "stripe-signature": "sig" }, "raw")
    );
    expect((await res.json()).received).toBe(true);
    expect(sendPaidConfirmationEmails).toHaveBeenCalledTimes(1);
    expect(markRentalPaidEmailsSent).toHaveBeenCalledWith("order-1");
  });

  test("expired session releases the hold", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_1",
          metadata: { kind: "rental", orderId: "order-1" },
        },
      },
    });
    const res = await POST(
      requestWith({ "stripe-signature": "sig" }, "raw")
    );
    expect((await res.json()).received).toBe(true);
    expect(handleRentalCheckoutExpired).toHaveBeenCalled();
  });

  test("refund is stored and superadmin path is invoked via handler", async () => {
    constructEvent.mockReturnValue({
      type: "charge.refunded",
      data: { object: { id: "ch_1", metadata: { orderId: "order-1" } } },
    });
    const res = await POST(
      requestWith({ "stripe-signature": "sig" }, "raw")
    );
    expect((await res.json()).received).toBe(true);
    expect(recordRentalRefundOrDispute).toHaveBeenCalledWith(
      "charge.refunded",
      expect.any(Object),
      expect.objectContaining({ eventId: undefined })
    );
  });
});
