/**
 * @jest-environment node
 */
import { getOrderColor, getOrderType } from "@/domain/orders/getOrderColor";
import { isOrderDateBlocking } from "@/domain/orders/isOrderDateBlocking";
import { ORDER_COLORS } from "@/config/orderColors";
import { ORDER_STATUS } from "@/domain/orders/orderStatus";

describe("offline order helpers", () => {
  test("isOrderDateBlocking is true for offline or confirmed", () => {
    expect(isOrderDateBlocking({ offline: true, confirmed: false })).toBe(true);
    expect(isOrderDateBlocking({ offline: false, confirmed: true })).toBe(true);
    expect(isOrderDateBlocking({ offline: false, confirmed: false })).toBe(false);
    expect(isOrderDateBlocking(null)).toBe(false);
  });

  test("getOrderColor returns OFFLINE before confirmed matrix", () => {
    const color = getOrderColor({
      offline: true,
      confirmed: true,
      my_order: true,
    });
    expect(color.key).toBe(ORDER_COLORS.OFFLINE.key);
    expect(color.hatch).toBe(true);
  });

  test("paid-and-closed still wins over offline", () => {
    const color = getOrderColor({
      offline: true,
      confirmed: true,
      status: ORDER_STATUS.PAID_AND_CLOSED,
    });
    expect(color.key).toBe(ORDER_COLORS.PAID_AND_CLOSED.key);
  });

  test("getOrderType returns offline", () => {
    expect(getOrderType({ offline: true, confirmed: true })).toBe("offline");
  });
});
