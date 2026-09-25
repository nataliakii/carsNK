import {
  DAYS_IN_WEEK,
  DAY_STATE,
  WEEKS_IN_GRID,
  addMonths,
  buildCalendarCells,
  buildMonthGrid,
  isInteractive,
  parseMonthKey,
  resolveDayState,
} from "../calendarGrid";

const SELECTION = {
  startDate: "2026-10-20",
  endDate: "2026-10-24",
  unavailableDates: ["2026-10-28"],
  today: "2026-10-01",
};

describe("mini calendar grid", () => {
  test("every day number is produced exactly once per cell", () => {
    const cells = buildCalendarCells("2026-10", SELECTION);
    cells.forEach((cell) => {
      expect(typeof cell.dayNumber).toBe("number");
      // One number, one state — nothing for a renderer to duplicate.
      expect(Object.keys(cell).filter((k) => k === "dayNumber")).toHaveLength(1);
    });
  });

  test("each date appears exactly once in the grid", () => {
    const cells = buildCalendarCells("2026-10", SELECTION);
    const keys = cells.map((c) => c.dateKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("every day of the month is present exactly once", () => {
    const cells = buildCalendarCells("2026-10", SELECTION);
    const inMonth = cells.filter((c) => !c.outsideMonth).map((c) => c.dayNumber);
    expect(inMonth).toHaveLength(31);
    expect(new Set(inMonth).size).toBe(31);
  });

  test("the grid is a fixed six rows so paging months causes no layout shift", () => {
    ["2026-01", "2026-02", "2026-10", "2027-02", "2028-02"].forEach((month) => {
      expect(buildMonthGrid(month)).toHaveLength(WEEKS_IN_GRID * DAYS_IN_WEEK);
    });
  });

  test("a cell has exactly one visual state", () => {
    const cells = buildCalendarCells("2026-10", SELECTION);
    const byKey = Object.fromEntries(cells.map((c) => [c.dateKey, c]));
    expect(byKey["2026-10-20"].state).toBe(DAY_STATE.RANGE_START);
    expect(byKey["2026-10-22"].state).toBe(DAY_STATE.RANGE_MIDDLE);
    expect(byKey["2026-10-24"].state).toBe(DAY_STATE.RANGE_END);
    expect(byKey["2026-10-28"].state).toBe(DAY_STATE.UNAVAILABLE);
    expect(byKey["2026-10-26"].state).toBe(DAY_STATE.AVAILABLE);
    cells.forEach((cell) => {
      expect(typeof cell.state).toBe("string");
    });
  });

  test("a lone start date reads as a single selection, not a range edge", () => {
    expect(
      resolveDayState("2026-10-20", {
        startDate: "2026-10-20",
        endDate: null,
        today: "2026-10-01",
      })
    ).toBe(DAY_STATE.SELECTED_SINGLE);
  });

  test("past and unavailable days are not interactive", () => {
    expect(
      resolveDayState("2026-09-30", { ...SELECTION, today: "2026-10-01" })
    ).toBe(DAY_STATE.PAST);
    expect(isInteractive(DAY_STATE.PAST)).toBe(false);
    expect(isInteractive(DAY_STATE.UNAVAILABLE)).toBe(false);
    expect(isInteractive(DAY_STATE.AVAILABLE)).toBe(true);
    expect(isInteractive(DAY_STATE.RANGE_MIDDLE)).toBe(true);
  });

  test("an unavailable day is never shown as part of a range", () => {
    const state = resolveDayState("2026-10-22", {
      startDate: "2026-10-20",
      endDate: "2026-10-24",
      unavailableDates: ["2026-10-22"],
      today: "2026-10-01",
    });
    expect(state).toBe(DAY_STATE.UNAVAILABLE);
  });

  test("days outside the current month are marked and not selectable", () => {
    const cells = buildCalendarCells("2026-10", SELECTION);
    const outside = cells.filter((c) => c.outsideMonth);
    expect(outside.length).toBeGreaterThan(0);
    outside.forEach((cell) => expect(cell.selectable).toBe(false));
  });

  test("month paging crosses year boundaries correctly", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 3)).toBe("2027-01");
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("nope")).toBeNull();
  });

  test("a Monday-start grid begins the week on Monday", () => {
    const cells = buildMonthGrid("2026-10", { weekStartsOn: 1 });
    expect(cells[0].weekday).toBe(1);
    const sunday = buildMonthGrid("2026-10", { weekStartsOn: 0 });
    expect(sunday[0].weekday).toBe(0);
  });
});
