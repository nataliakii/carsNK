/**
 * @jest-environment node
 */
import {
  getEffectivePrice,
  getStoredAutoPrice,
  resolveOrderOwnerId,
  computeCommission,
  filterOrdersForTable,
  summarizeFilteredOrders,
  isRovaroMarketplaceFeeOrder,
} from "@/domain/orders/ordersTableStats";

describe("ordersTableStats", () => {
  test("getEffectivePrice prefers OverridePrice", () => {
    expect(getEffectivePrice({ totalPrice: 100, OverridePrice: 80 })).toBe(80);
    expect(getEffectivePrice({ totalPrice: 100, OverridePrice: null })).toBe(100);
    expect(getEffectivePrice({ totalPrice: 100 })).toBe(100);
    expect(getEffectivePrice(null)).toBe(0);
  });

  test("getStoredAutoPrice ignores override", () => {
    expect(getStoredAutoPrice({ totalPrice: 120, OverridePrice: 50 })).toBe(120);
  });

  test("resolveOrderOwnerId from order then car", () => {
    expect(resolveOrderOwnerId({ ownerId: "aaa" })).toBe("aaa");
    expect(
      resolveOrderOwnerId(
        { car: "c1" },
        [{ _id: "c1", ownerId: "owner-1" }]
      )
    ).toBe("owner-1");
    expect(resolveOrderOwnerId({ car: { _id: "c2", ownerId: "o2" } })).toBe(
      "o2"
    );
  });

  test("computeCommission", () => {
    expect(computeCommission(1000, 10)).toEqual({
      sum: 1000,
      percent: 10,
      commission: 100,
    });
    expect(computeCommission(333, 10).commission).toBe(33.3);
    expect(computeCommission(100, 0).commission).toBe(0);
  });

  test("filterOrdersForTable by owner and status", () => {
    const cars = [{ _id: "carA", ownerId: "co1" }];
    const orders = [
      {
        _id: "1",
        car: "carA",
        ownerId: "co1",
        confirmed: true,
        my_order: true,
        rentalStartDate: "2026-07-01",
        rentalEndDate: "2026-07-05",
        customerName: "Ann",
        totalPrice: 100,
      },
      {
        _id: "2",
        car: "carA",
        ownerId: "co2",
        confirmed: false,
        my_order: false,
        rentalStartDate: "2026-07-10",
        rentalEndDate: "2026-07-12",
        customerName: "Bob",
        totalPrice: 200,
      },
    ];
    const byOwner = filterOrdersForTable(orders, {
      ownerId: "co1",
      cars,
    });
    expect(byOwner).toHaveLength(1);
    expect(byOwner[0]._id).toBe("1");

    const pending = filterOrdersForTable(orders, { statusFilter: "pending" });
    expect(pending).toHaveLength(1);
    expect(pending[0]._id).toBe("2");
  });

  test("summarizeFilteredOrders uses stored marketplace amounts, not a hardcoded percent", () => {
    const orders = [
      {
        my_order: true,
        totalPrice: 100,
        OverridePrice: null,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: {
          grossMinor: 10000,
          platformAmountMinor: 1000,
          supplierBalanceMinor: 9000,
          marketplaceBookingFeeBps: 1000,
        },
      },
      {
        totalPrice: 200,
        OverridePrice: 150,
        bookingMode: "OPS_CALENDAR",
      },
    ];
    const s = summarizeFilteredOrders(orders);
    expect(s.sum).toBe(250); // 100 + 150
    expect(s.marketplaceCount).toBe(1);
    expect(s.commission).toBe(10);
    expect(s.remaining).toBe(90);
    expect(s.count).toBe(2);
  });

  test("summarizeFilteredOrders ignores internal bookings even if bookingMode is marketplace", () => {
    const orders = [
      {
        my_order: false,
        totalPrice: 100,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: {
          grossMinor: 10000,
          platformAmountMinor: 1000,
          supplierBalanceMinor: 9000,
          marketplaceBookingFeeBps: 1000,
        },
      },
      {
        my_order: true,
        totalPrice: 200,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: {
          grossMinor: 20000,
          platformAmountMinor: 2000,
          supplierBalanceMinor: 18000,
          marketplaceBookingFeeBps: 1000,
        },
      },
    ];
    const s = summarizeFilteredOrders(orders);
    expect(s.marketplaceCount).toBe(1);
    expect(s.commission).toBe(20);
    expect(s.remaining).toBe(180);
    expect(s.count).toBe(2);
  });

  test("isRovaroMarketplaceFeeOrder excludes internal and offline rows", () => {
    expect(
      isRovaroMarketplaceFeeOrder({
        my_order: true,
        bookingMode: "MARKETPLACE_REQUEST",
      })
    ).toBe(true);
    expect(
      isRovaroMarketplaceFeeOrder({
        my_order: false,
        bookingMode: "MARKETPLACE_REQUEST",
      })
    ).toBe(false);
    expect(
      isRovaroMarketplaceFeeOrder({
        my_order: true,
        offline: true,
        bookingMode: "MARKETPLACE_REQUEST",
      })
    ).toBe(false);
  });

  test("summarizeFilteredOrders fee lines ignore Admin calendar bookings in a mixed table", () => {
    const fee = (gross, platform) => ({
      grossMinor: gross * 100,
      platformAmountMinor: platform * 100,
      supplierBalanceMinor: (gross - platform) * 100,
      marketplaceBookingFeeBps: 1000,
    });
    const s = summarizeFilteredOrders([
      {
        my_order: true,
        totalPrice: 50,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: fee(50, 5),
      },
      {
        my_order: false,
        totalPrice: 100,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: fee(100, 10),
      },
      {
        my_order: false,
        totalPrice: 50,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: fee(50, 5),
      },
      {
        my_order: true,
        totalPrice: 150,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: fee(150, 15),
      },
      {
        my_order: true,
        totalPrice: 237,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: fee(237, 23.7),
      },
    ]);
    expect(s.sum).toBe(587);
    expect(s.marketplaceCount).toBe(3);
    expect(s.commission).toBe(43.7);
    expect(s.remaining).toBe(393.3);
  });
});
