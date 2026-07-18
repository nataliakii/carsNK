import dayjs from "dayjs";
import { getCalendarCellState } from "../../CalendarRow";
import {
  baseDate,
  dateStr,
  baseCarOrders,
  ordersForDate,
  confirmedDates,
  unavailableDates,
  startEndDates,
  overlapDates,
  startEndOverlapDates,
  selectedOrderDates,
} from "./calendarCell.fixtures";

/**
 * Factory for getCalendarCellState
 * Allows overriding only what matters for a given test
 */
export function createCellState(overrides = {}) {
  const defaults = {
    date: baseDate,
    dateStr,
    ordersForDate,
    confirmedDates,
    unavailableDates,
    overlapDates,
    startEndDates,
    startEndOverlapDates,
    selectedOrderDates,
    moveMode: false,
    isCarCompatibleForMove: false,
    carOrders: baseCarOrders,
  };

  return getCalendarCellState({
    ...defaults,
    ...overrides,
  });
}

/**
 * Helper to override date safely
 */
export function withDate(dateISO) {
  const d = dayjs(dateISO);
  return {
    date: d,
    dateStr: d.format("YYYY-MM-DD"),
  };
}

