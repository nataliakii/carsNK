/**
 * @jest-environment node
 */
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { HOLD_STATUS } from "@models/BookingHold";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/BookingHold", () => ({
  HOLD_STATUS: {
    ACTIVE: "active",
    FINALIZED: "finalized",
    RELEASED: "released",
    RETRY: "retry",
  },
  BookingHold: {
    find: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock("@models/order", () => ({
  Order: { findById: jest.fn() },
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  expireRentalCheckoutSession: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/booking/expireMarketplacePayment", () => ({
  expireUnpaidMarketplacePayment: jest.fn(),
}));

import { BookingHold } from "@models/BookingHold";
import { Order } from "@models/order";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { expireUnpaidMarketplacePayment } from "@/domain/booking/expireMarketplacePayment";
import { runExpiredHoldCleanup } from "../expiredHoldCleanup";

describe("runExpiredHoldCleanup", () => {
  const now = new Date("2026-09-21T21:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    BookingHold.updateOne.mockResolvedValue({});
    expireUnpaidMarketplacePayment.mockResolvedValue({
      ok: true,
      released: true,
    });
  });

  function holdsQuery(rows) {
    BookingHold.find.mockReturnValue({
      limit: () => ({
        lean: () => Promise.resolve(rows),
      }),
    });
  }

  test("releases expired unpaid hold", async () => {
    holdsQuery([
      {
        _id: "hold-1",
        orderId: "order-1",
        status: HOLD_STATUS.ACTIVE,
        stripeSessionId: "cs_old",
      },
    ]);
    Order.findById.mockResolvedValue({
      _id: "order-1",
      bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
      payment: { status: "pending", providerPaymentId: "cs_old" },
    });

    const result = await runExpiredHoldCleanup({ now, trigger: "test" });
    expect(result.scanned).toBe(1);
    expect(result.released).toBe(1);
    expect(result.skippedConfirmed).toBe(0);
    expect(expireUnpaidMarketplacePayment).toHaveBeenCalledTimes(1);
  });

  test("does not release finalized or paid hold", async () => {
    holdsQuery([
      {
        _id: "hold-1",
        orderId: "order-paid",
        status: HOLD_STATUS.ACTIVE,
      },
    ]);
    Order.findById.mockResolvedValue({
      _id: "order-paid",
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "paid" },
    });

    const result = await runExpiredHoldCleanup({ now });
    expect(result.released).toBe(0);
    expect(result.skippedConfirmed).toBe(1);
    expect(expireUnpaidMarketplacePayment).not.toHaveBeenCalled();
    expect(BookingHold.updateOne).toHaveBeenCalledWith(
      { _id: "hold-1", status: HOLD_STATUS.ACTIVE },
      expect.objectContaining({
        $set: expect.objectContaining({ status: HOLD_STATUS.FINALIZED }),
      })
    );
  });

  test("is idempotent on rerun", async () => {
    holdsQuery([]);
    const first = await runExpiredHoldCleanup({ now });
    const second = await runExpiredHoldCleanup({ now });
    expect(first.released).toBe(0);
    expect(second.released).toBe(0);
    expect(expireUnpaidMarketplacePayment).not.toHaveBeenCalled();
  });

  test("records audit when a row fails", async () => {
    holdsQuery([{ _id: "hold-1", orderId: "order-1" }]);
    Order.findById.mockRejectedValue(new Error("db down"));
    const result = await runExpiredHoldCleanup({ now });
    expect(result.failed).toBe(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BOOKING_HOLD_CLEANUP_FAILED" })
    );
  });
});
