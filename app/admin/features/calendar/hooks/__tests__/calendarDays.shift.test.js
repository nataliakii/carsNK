import {
  buildOrderDateRange,
  calendarDayDelta,
  shiftOrderByDays,
} from "../calendarDays";

describe("calendarDayDelta", () => {
  it("computes signed day difference", () => {
    expect(calendarDayDelta("2026-07-10", "2026-07-12")).toBe(2);
    expect(calendarDayDelta("2026-07-12", "2026-07-10")).toBe(-2);
    expect(calendarDayDelta("2026-07-10", "2026-07-10")).toBe(0);
  });
});

describe("shiftOrderByDays", () => {
  const order = {
    _id: "o1",
    rentalStartDate: "2026-07-10T00:00:00.000Z",
    rentalEndDate: "2026-07-15T00:00:00.000Z",
    timeIn: "2026-07-10T11:00:00.000Z",
    timeOut: "2026-07-15T09:00:00.000Z",
  };

  it("returns null for zero delta", () => {
    expect(shiftOrderByDays(order, 0)).toBeNull();
  });

  it("shifts start/end strings and keeps duration", () => {
    const shifted = shiftOrderByDays(order, 2);
    expect(shifted.rentalStartDate).toBe("2026-07-12");
    expect(shifted.rentalEndDate).toBe("2026-07-17");
    expect(shifted.dayDelta).toBe(2);
    const range = buildOrderDateRange({
      rentalStartDate: shifted.rentalStartDate,
      rentalEndDate: shifted.rentalEndDate,
    });
    expect(range[0]).toBe("2026-07-12");
    expect(range[range.length - 1]).toBe("2026-07-17");
  });

  it("shifts backward", () => {
    const shifted = shiftOrderByDays(order, -3);
    expect(shifted.rentalStartDate).toBe("2026-07-07");
    expect(shifted.rentalEndDate).toBe("2026-07-12");
  });
});
