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

  test("summarizeFilteredOrders includes commission", () => {
    const orders = [
      { totalPrice: 100, OverridePrice: null },
      { totalPrice: 200, OverridePrice: 150 },
    ];
    const s = summarizeFilteredOrders(orders, 10);
    expect(s.sum).toBe(250); // 100 + 150
    expect(s.commission).toBe(25);
    expect(s.count).toBe(2);
  });
});
