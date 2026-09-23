/**
 * @jest-environment node
 */
import { readRentalPaymentStatus } from "../readRentalPaymentStatus";
import { Order } from "@models/order";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: { findOne: jest.fn() },
}));

describe("readRentalPaymentStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("session_id only reads, never writes", async () => {
    Order.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: "order-1",
          orderNumber: "1",
          bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
          payment: { status: "pending", providerPaymentId: "cs_1" },
        }),
    });
    const result = await readRentalPaymentStatus("cs_1");
    expect(result.phase).toBe("pending");
    expect(Order.findOne).toHaveBeenCalledWith({
      "payment.providerPaymentId": "cs_1",
    });
    expect(Order.findOne.mock.calls[0]).toBeDefined();
    expect(Object.keys(Order)).not.toContain("findOneAndUpdate");
  });

  test("paid order shows confirmation", async () => {
    Order.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: "order-1",
          orderNumber: "1",
          bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
          payment: { status: "paid" },
        }),
    });
    const result = await readRentalPaymentStatus("cs_1");
    expect(result.phase).toBe("paid");
  });
});
