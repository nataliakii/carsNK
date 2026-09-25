/**
 * @jest-environment node
 */
import { getOrderColor, getOrderType } from "@/domain/orders/getOrderColor";
import { isOrderDateBlocking } from "@/domain/orders/isOrderDateBlocking";

describe("offline order helpers", () => {
  test("isOrderDateBlocking is true for offline or confirmed", () => {
    expect(isOrderDateBlocking({ offline: true, confirmed: false })).toBe(true);
    expect(isOrderDateBlocking({ offline: false, confirmed: true })).toBe(true);
    expect(isOrderDateBlocking({ offline: false, confirmed: false })).toBe(false);
    expect(isOrderDateBlocking(null)).toBe(false);
  });

  test("internal blocks use source, not the offline colour", () => {
    const color = getOrderColor({
      offline: true,
      confirmed: true,
      my_order: false,
      source: "INTERNAL",
    });
    expect(color.key).toBe("INTERNAL");
    expect(color.problem).toBeUndefined();
  });

  test("a platform problem keeps the paid tone and adds a red accent", () => {
    const color = getOrderColor({
      my_order: true,
      source: "PLATFORM",
      bookingStatus: "BOOKING_CONFIRMED",
      hasProblem: true,
    });
    expect(color.key).toBe("CONFIRMED_PAID");
    expect(color.problem).toBe(true);
  });

  test("getOrderType follows the calendar tone", () => {
    expect(getOrderType({ offline: true, confirmed: true, my_order: false })).toBe(
      "INTERNAL"
    );
  });
});
