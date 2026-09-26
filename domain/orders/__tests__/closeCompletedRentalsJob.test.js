/**
 * @jest-environment node
 */

jest.mock("@models/order", () => ({
  Order: { find: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("@/domain/legal/auditTrail", () => ({ recordAuditEvent: jest.fn() }));

import { Order } from "@models/order";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { closeCompletedRentals } from "../closeCompletedRentals";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { ORDER_STATUS } from "../orderStatus";

function orderFixture() {
  return {
    _id: "64a0000000000000000000aa",
    orderNumber: "RVR-001",
    source: "PLATFORM",
    my_order: true,
    ownerId: "64a000000000000000000001",
    bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    payment: { status: "paid" },
    returnAtUtc: new Date("2026-09-26T10:00:00.000Z"),
    completionHistory: [],
    status: "CONFIRMED",
    save: jest.fn(async function save() {
      return this;
    }),
  };
}

function queryWith(order) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([order]),
  };
}

describe("closeCompletedRentals job", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordAuditEvent.mockResolvedValue(true);
  });

  test("one or repeated runs append one transition and never close financial status", async () => {
    const order = orderFixture();
    Order.find.mockImplementation(() => queryWith(order));
    Order.updateOne.mockImplementation(async (filter, update) => {
      if (order.bookingStatus !== filter.bookingStatus)
        return { matchedCount: 0 };
      order.bookingStatus = update.$set.bookingStatus;
      order.completionPendingAt = update.$set.completionPendingAt;
      order.completionHistory.push(update.$push.completionHistory);
      return { matchedCount: 1 };
    });
    const now = new Date("2026-09-26T10:00:00.000Z");

    const first = await closeCompletedRentals({ now });
    const second = await closeCompletedRentals({ now });

    expect(first.closed).toBe(1);
    expect(second.closed).toBe(0);
    expect(order.bookingStatus).toBe(BOOKING_STATUS.COMPLETED);
    expect(order.status).not.toBe(ORDER_STATUS.PAID_AND_CLOSED);
    expect(order.completionHistory).toHaveLength(1);
    expect(order.completionHistory[0]).toMatchObject({
      fromState: "CONFIRMED",
      toState: "COMPLETED",
      returnAtUtc: now,
      completedAt: now,
      actor: { role: "system" },
    });
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(Order.updateOne).toHaveBeenCalledTimes(1);
    expect(order.supplierRemainingPaidAt).toBeUndefined();
  });
});
