/**
 * @jest-environment node
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));
jest.mock("@/domain/booking/bookingHold", () => ({
  releaseMarketplaceHold: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerPaymentExpiredEmail: jest.fn(),
}));

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { expireUnpaidMarketplacePayment } from "../expireMarketplacePayment";

describe("existing paid marketplace bookings", () => {
  test("12. BOOKING_CONFIRMED / paid orders are not cancelled or mutated", async () => {
    const order = {
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "paid", providerPaymentId: "cs_paid" },
      save: jest.fn(),
      set: jest.fn(),
    };
    const result = await expireUnpaidMarketplacePayment({
      order,
      sessionId: "cs_paid",
    });
    expect(result.skippedConfirmed).toBe(true);
    expect(order.save).not.toHaveBeenCalled();
    expect(order.bookingStatus).toBe(BOOKING_STATUS.BOOKING_CONFIRMED);
    expect(order.payment.status).toBe("paid");
  });
});
