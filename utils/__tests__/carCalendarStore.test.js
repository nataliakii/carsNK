/**
 * The store exists so that one card's date click does not notify — and so
 * does not re-render or re-fetch — any other card.
 */

import { createCarCalendarStore } from "../carCalendarStore";

describe("car calendar store", () => {
  test("only the touched car's subscriber is notified", () => {
    const store = createCarCalendarStore();
    const onA = jest.fn();
    const onB = jest.fn();
    store.subscribeCar("car-a", onA);
    store.subscribeCar("car-b", onB);

    store.selectDate({ carId: "car-a", date: "2026-10-20" });

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
  });

  test("a whole range on one car never notifies another car", () => {
    const store = createCarCalendarStore();
    const onB = jest.fn();
    store.subscribeCar("car-b", onB);

    store.selectDate({ carId: "car-a", date: "2026-10-20" });
    store.selectDate({ carId: "car-a", date: "2026-10-24" });
    store.setMonth("car-a", "2026-12");
    store.applyQuote("car-a", {
      start: "2026-10-20",
      end: "2026-10-24",
      status: "ready",
      quote: { totalPrice: 105 },
    });

    expect(onB).not.toHaveBeenCalled();
    expect(store.getCar("car-b").startDate).toBeNull();
    expect(store.getCar("car-b").quote).toBeNull();
  });

  test("a no-op transition notifies nobody", () => {
    const store = createCarCalendarStore();
    const onA = jest.fn();
    store.subscribeCar("car-a", onA);

    // A blocked day is rejected, so no slice changes.
    store.selectDate({
      carId: "car-a",
      date: "2026-10-20",
      unavailableDates: ["2026-10-20"],
    });
    store.setMonth("car-a", "not-a-month");

    expect(onA).not.toHaveBeenCalled();
  });

  test("unsubscribing stops notifications", () => {
    const store = createCarCalendarStore();
    const onA = jest.fn();
    const off = store.subscribeCar("car-a", onA);

    store.selectDate({ carId: "car-a", date: "2026-10-20" });
    expect(onA).toHaveBeenCalledTimes(1);

    off();
    store.selectDate({ carId: "car-a", date: "2026-10-24" });
    expect(onA).toHaveBeenCalledTimes(1);
  });

  test("the slice identity is stable for untouched cars", () => {
    const store = createCarCalendarStore();
    store.selectDate({ carId: "car-b", date: "2026-11-01" });
    const beforeB = store.getCar("car-b");

    store.selectDate({ carId: "car-a", date: "2026-10-20" });

    expect(store.getCar("car-b")).toBe(beforeB);
  });
});
