/**
 * @jest-environment node
 */
import {
  clampStripeExpiresMinutes,
  evaluateRentalPaidSession,
} from "../rentalStripeCheckout";
import { computePriceSnapshotChecksum } from "../priceSnapshotChecksum";

describe("clampStripeExpiresMinutes", () => {
  test("clamps to Stripe 30 minutes – 24 hours", () => {
    expect(clampStripeExpiresMinutes(5)).toBe(30);
    expect(clampStripeExpiresMinutes(60)).toBe(60);
    expect(clampStripeExpiresMinutes(3000)).toBe(24 * 60);
  });
});

describe("evaluateRentalPaidSession", () => {
  const order = {
    _id: "order-1",
    ownerId: "company-a",
    car: "car-1",
    payment: {
      providerPaymentId: "cs_1",
      amountMinor: 10000,
      currency: "EUR",
      status: "pending",
    },
    authoritativePrice: {
      prepaymentMinor: 10000,
      grossMinor: 100000,
      balanceMinor: 90000,
      currency: "EUR",
    },
  };
  order.payment.priceChecksum = computePriceSnapshotChecksum(order);

  const session = {
    id: "cs_1",
    payment_status: "paid",
    amount_total: 10000,
    currency: "eur",
    metadata: {
      kind: "rental",
      orderId: "order-1",
      companyId: "company-a",
      prepaymentMinor: "10000",
      priceChecksum: order.payment.priceChecksum,
    },
  };

  test("valid paid session passes", () => {
    expect(evaluateRentalPaidSession(session, order).ok).toBe(true);
  });

  test("amount mismatch fails", () => {
    const result = evaluateRentalPaidSession(
      { ...session, amount_total: 1 },
      order
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("amount_mismatch");
    expect(result.received).toBe(true);
  });

  test("currency mismatch fails", () => {
    const result = evaluateRentalPaidSession(
      { ...session, currency: "usd" },
      order
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("currency_mismatch");
  });

  test("wrong session id fails", () => {
    const result = evaluateRentalPaidSession({ ...session, id: "cs_other" }, order);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("session_mismatch");
  });

  test("wrong order fails", () => {
    const result = evaluateRentalPaidSession(session, { ...order, _id: "other" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("order_mismatch");
  });

  test("wrong company fails", () => {
    const result = evaluateRentalPaidSession(session, {
      ...order,
      ownerId: "company-b",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("company_mismatch");
  });

  test("invalidated expired session cannot confirm the booking", () => {
    const result = evaluateRentalPaidSession(session, {
      ...order,
      payment: { ...order.payment, status: "expired" },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("stale_session");
    expect(result.stale).toBe(true);
  });

  test("8. stale alternative session cannot confirm when a newer session is current", () => {
    const result = evaluateRentalPaidSession(
      { ...session, id: "cs_alt" },
      {
        ...order,
        payment: {
          ...order.payment,
          providerPaymentId: "cs_1",
          sessionHistory: [{ sessionId: "cs_alt", status: "expired" }],
        },
      }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("stale_session");
  });

  test("checksum mismatch fails", () => {
    const result = evaluateRentalPaidSession(
      {
        ...session,
        metadata: { ...session.metadata, priceChecksum: "deadbeef" },
      },
      order
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("checksum_mismatch");
  });
});
