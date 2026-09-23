/**
 * @jest-environment node
 */
import {
  acquireMarketplaceHold,
  findOverlappingActiveHold,
  intervalsOverlap,
  releaseMarketplaceHold,
  releaseMarketplaceHoldForOffer,
  restoreMarketplaceHoldAfterFailedAcquire,
} from "../bookingHold";
import { BookingHold, BookingCarLock, HOLD_STATUS } from "@models/BookingHold";
import { Order } from "@models/order";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/booking/expiredHoldCleanup", () => ({
  cleanupExpiredHolds: jest.fn().mockResolvedValue({ ok: true, released: 0 }),
  runExpiredHoldCleanup: jest.fn().mockResolvedValue({ ok: true, released: 0 }),
}));
jest.mock("@models/BookingHold", () => ({
  HOLD_STATUS: {
    ACTIVE: "active",
    FINALIZED: "finalized",
    RELEASED: "released",
    RETRY: "retry",
  },
  BookingHold: {
    updateMany: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
  BookingCarLock: {
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock("@models/order", () => ({
  Order: { find: jest.fn() },
}));

describe("bookingHold", () => {
  const pickup = new Date("2026-10-01T10:00:00.000Z");
  const ret = new Date("2026-10-05T10:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    BookingHold.updateMany.mockResolvedValue({ modifiedCount: 0 });
    BookingHold.findOne.mockResolvedValue(null);
    BookingCarLock.updateOne.mockResolvedValue({});
    Order.find.mockResolvedValue([]);
  });

  test("intervalsOverlap is half-open", () => {
    expect(intervalsOverlap(1, 2, 2, 3)).toBe(false);
    expect(intervalsOverlap(1, 3, 2, 4)).toBe(true);
  });

  test("second overlapping confirm loses the car lock", async () => {
    BookingCarLock.findOneAndUpdate.mockRejectedValue({ code: 11000 });
    const result = await acquireMarketplaceHold({
      carId: "car-1",
      orderId: "order-b",
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("hold_conflict");
    expect(BookingHold.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("overlapping active hold is rejected", async () => {
    BookingCarLock.findOneAndUpdate.mockResolvedValue({
      lockedByOrderId: "order-b",
    });
    BookingHold.find.mockResolvedValue([
      {
        orderId: "order-a",
        pickupAtUtc: pickup,
        returnAtUtc: ret,
        status: HOLD_STATUS.ACTIVE,
      },
    ]);
    const result = await acquireMarketplaceHold({
      carId: "car-1",
      orderId: "order-b",
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("hold_conflict");
  });

  test("non-overlapping hold is created", async () => {
    BookingCarLock.findOneAndUpdate.mockResolvedValue({
      lockedByOrderId: "order-b",
    });
    BookingHold.find.mockResolvedValue([
      {
        orderId: "order-a",
        pickupAtUtc: new Date("2026-11-01T10:00:00.000Z"),
        returnAtUtc: new Date("2026-11-05T10:00:00.000Z"),
      },
    ]);
    BookingHold.findOneAndUpdate.mockResolvedValue({
      toObject: () => ({ orderId: "order-b", status: "active" }),
    });
    const result = await acquireMarketplaceHold({
      carId: "car-1",
      orderId: "order-b",
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(result.ok).toBe(true);
    expect(result.hold.status).toBe("active");
  });

  test("releaseMarketplaceHold marks the row released", async () => {
    BookingHold.findOneAndUpdate.mockResolvedValue({
      toObject: () => ({ status: "released" }),
    });
    const result = await releaseMarketplaceHold("order-b", {
      reason: "supplier_declined",
    });
    expect(result.ok).toBe(true);
    expect(result.hold.status).toBe("released");
  });

  test("releaseMarketplaceHoldForOffer only updates the matching offer hold", async () => {
    BookingHold.findOneAndUpdate.mockResolvedValue({
      toObject: () => ({ status: "released", offerId: "ALT-1" }),
    });
    const result = await releaseMarketplaceHoldForOffer("order-b", "ALT-1", {
      reason: "compliance:PARTNER_SUSPENDED",
    });
    expect(result.ok).toBe(true);
    expect(BookingHold.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-b", offerId: "ALT-1" }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: "released" }),
      }),
      expect.any(Object)
    );
  });

  test("findOverlappingActiveHold ignores a different car window", async () => {
    BookingHold.find.mockResolvedValue([]);
    const found = await findOverlappingActiveHold({
      carId: "car-1",
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      excludeOrderId: "self",
    });
    expect(found).toBeNull();
  });

  test("restore after failed acquire writes the previous car-A snapshot back", async () => {
    BookingHold.findOneAndUpdate.mockResolvedValue({
      toObject: () => ({ carId: "car-a", status: "active" }),
    });
    const result = await restoreMarketplaceHoldAfterFailedAcquire({
      orderId: "order-1",
      previousHold: {
        carId: "car-a",
        status: "active",
        pickupAtUtc: pickup,
        returnAtUtc: ret,
        holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    expect(result.restored).toBe(true);
    expect(BookingHold.findOneAndUpdate).toHaveBeenCalledWith(
      { orderId: "order-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ carId: "car-a", status: "active" }),
      }),
      { new: true }
    );
  });

  test("restore without a previous hold releases the newly acquired row", async () => {
    BookingHold.findOneAndUpdate.mockResolvedValue({
      toObject: () => ({ status: "released" }),
    });
    const result = await restoreMarketplaceHoldAfterFailedAcquire({
      orderId: "order-1",
      previousHold: null,
      reason: "alternative_cas_lost",
    });
    expect(result.ok).toBe(true);
    expect(result.hold.status).toBe("released");
  });
});
