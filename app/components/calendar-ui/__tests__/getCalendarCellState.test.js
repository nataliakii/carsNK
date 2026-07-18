import { createCellState, withDate } from "./__fixtures__/calendarCell.factory";
import fc from "fast-check";
import {
  dateStrArb,
  dateArrayArb,
  overlapDatesArb,
  startEndOverlapArb,
} from "./__fixtures__/calendarCell.generators";

import {
  completedCarOrders,
  overlapDatesFixture,
  startEndOverlapDatesFixture,
} from "./__fixtures__/calendarCell.fixtures";

describe("getCalendarCellState (pure)", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    // Freeze "now" so isPastDay is deterministic
    jest.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("1️⃣ Empty cell", () => {
    const cellState = createCellState({
      ordersForDate: [],
      confirmedDates: [],
      startEndDates: [],
      carOrders: [],
    });

    expect(cellState.isCellEmpty).toBe(true);
    expect(cellState.isConfirmed).toBe(false);
    expect(cellState.isStartDate).toBe(false);
    expect(cellState.isEndDate).toBe(false);
  });

  test("2️⃣ Confirmed start date", () => {
    const cellState = createCellState();

    expect(cellState.isConfirmed).toBe(true);
    expect(cellState.isStartDate).toBe(true);
    expect(cellState.isEndDate).toBe(false);
    expect(cellState.isCellEmpty).toBe(false);
  });

  test("6️⃣ Move mode: first and last day", () => {
    // First day
    const firstDayState = createCellState({
      ...withDate("2026-01-10T12:00:00.000Z"),
      moveMode: true,
      isCarCompatibleForMove: true,
    });

    expect(firstDayState.isFirstMoveDay).toBe(true);
    expect(firstDayState.isLastMoveDay).toBe(false);

    // Last day
    const lastDayState = createCellState({
      ...withDate("2026-01-11T12:00:00.000Z"),
      moveMode: true,
      isCarCompatibleForMove: true,
    });

    expect(lastDayState.isFirstMoveDay).toBe(false);
    expect(lastDayState.isLastMoveDay).toBe(true);
  });

  test("🧭 Edge: same day is NOT past day (timezone safe)", () => {
    const cellState = createCellState(withDate("2026-01-10T23:59:59Z"));
    expect(cellState.isPastDay).toBe(false);
  });

  test("🧭 Edge: full previous day IS past day (timezone safe)", () => {
    // Use start of previous UTC day so it remains "past day" in any local timezone.
    const cellState = createCellState(withDate("2026-01-09T00:00:00.000Z"));
    expect(cellState.isPastDay).toBe(true);
  });

  test("⚠️ Edge: overlap date is never empty", () => {
    const cellState = createCellState({
      overlapDates: overlapDatesFixture,
      startEndDates: [],
    });

    expect(cellState.isOverlapDate).toBe(true);
    expect(cellState.isCellEmpty).toBe(false);
  });

  test("⚠️ Edge: start+end overlap overrides empty cell", () => {
    const cellState = createCellState({
      confirmedDates: [],
      startEndDates: [],
      startEndOverlapDates: startEndOverlapDatesFixture,
    });

    expect(cellState.isStartEndOverlap).toBe(true);
    expect(cellState.isCellEmpty).toBe(false);
  });

  test("⚠️ Edge: completed order marks cell as completed", () => {
    const cellState = createCellState({
      ...withDate("2025-12-03T12:00:00.000Z"),
      carOrders: completedCarOrders,
      ordersForDate: completedCarOrders,
    });

    expect(cellState.isCompletedCell).toBe(true);
  });

  test("⚠️ Edge: moveMode=false disables move date range", () => {
    const cellState = createCellState({
      moveMode: false,
      isCarCompatibleForMove: true,
    });

    expect(cellState.isInMoveModeDateRange).toBe(false);
  });

  // ----------------------------------------
  // Property-based tests (invariants only)
  // ----------------------------------------

  test("🔒 Property: overlap cell is never empty", () => {
    fc.assert(
      fc.property(overlapDatesArb, (overlapDates) => {
        overlapDates.forEach(({ date }) => {
          const cellState = createCellState({
            ...withDate(date),
            overlapDates,
            confirmedDates: [],
            startEndDates: [],
          });

          if (cellState.isOverlapDate) {
            expect(cellState.isCellEmpty).toBe(false);
          }
        });
      })
    );
  });

  test("🔒 Property: start+end overlap excludes start/end flags", () => {
    fc.assert(
      fc.property(startEndOverlapArb, (overlaps) => {
        overlaps.forEach(({ date }) => {
          const cellState = createCellState({
            ...withDate(date),
            startEndOverlapDates: overlaps,
            startEndDates: [],
          });

          if (cellState.isStartEndOverlap) {
            expect(cellState.isStartDate).toBe(false);
            expect(cellState.isEndDate).toBe(false);
          }
        });
      })
    );
  });

  test("🔒 Property: empty cell means no other flags", () => {
    fc.assert(
      fc.property(dateStrArb, (date) => {
        const cellState = createCellState({
          ...withDate(date),
          confirmedDates: [],
          unavailableDates: [],
          overlapDates: [],
          startEndDates: [],
          startEndOverlapDates: [],
        });

        if (cellState.isCellEmpty) {
          expect(cellState.isConfirmed).toBe(false);
          expect(cellState.isUnavailable).toBe(false);
          expect(cellState.isOverlapDate).toBe(false);
          expect(cellState.isStartEndOverlap).toBe(false);
          expect(cellState.isStartDate).toBe(false);
          expect(cellState.isEndDate).toBe(false);
        }
      })
    );
  });

  test("🔒 Property: moveMode=false disables move date range", () => {
    fc.assert(
      fc.property(dateStrArb, dateArrayArb, (date, selectedDates) => {
        const cellState = createCellState({
          ...withDate(date),
          selectedOrderDates: selectedDates,
          moveMode: false,
          isCarCompatibleForMove: true,
        });

        expect(cellState.isInMoveModeDateRange).toBe(false);
      })
    );
  });
});

