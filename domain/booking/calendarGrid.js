/**
 * Month grid for the compact mini calendar.
 *
 * Every cell carries exactly one day number and exactly one visual state, so
 * a renderer cannot draw a second absolutely-positioned number for a range
 * edge — that duplication is what showed "14" and "15" twice.
 *
 * The grid is always six rows, so paging months never changes the calendar's
 * height and the card cannot shift under the pointer.
 */

import { isDateKey } from "./publicBookingMode";

export const WEEKS_IN_GRID = 6;
export const DAYS_IN_WEEK = 7;

export const DAY_STATE = Object.freeze({
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  PAST: "past",
  RANGE_START: "rangeStart",
  RANGE_MIDDLE: "rangeMiddle",
  RANGE_END: "rangeEnd",
  SELECTED_SINGLE: "selectedSingle",
});

function pad(value) {
  return String(value).padStart(2, "0");
}

export function monthKey(year, monthIndex) {
  return `${year}-${pad(monthIndex + 1)}`;
}

export function parseMonthKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}$/.test(key)) return null;
  const [year, month] = key.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
}

export function addMonths(key, delta) {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  const total = parsed.year * 12 + parsed.monthIndex + delta;
  return monthKey(Math.floor(total / 12), ((total % 12) + 12) % 12);
}

/**
 * @param {string} month `YYYY-MM`
 * @param {number} weekStartsOn 0 = Sunday, 1 = Monday
 */
export function buildMonthGrid(month, { weekStartsOn = 1 } = {}) {
  const parsed = parseMonthKey(month);
  if (!parsed) return [];

  const first = new Date(Date.UTC(parsed.year, parsed.monthIndex, 1));
  const offset = (first.getUTCDay() - weekStartsOn + DAYS_IN_WEEK) % DAYS_IN_WEEK;

  const cells = [];
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - offset);

  for (let i = 0; i < WEEKS_IN_GRID * DAYS_IN_WEEK; i += 1) {
    const dateKey = cursor.toISOString().slice(0, 10);
    cells.push({
      dateKey,
      // The number rendered in the cell — the single source for the label.
      dayNumber: cursor.getUTCDate(),
      outsideMonth: cursor.getUTCMonth() !== parsed.monthIndex,
      weekday: cursor.getUTCDay(),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return cells;
}

/**
 * Resolve the single visual state of one day. Range membership wins over
 * plain availability; an unavailable day can never be part of a range.
 */
export function resolveDayState(
  dateKey,
  { startDate, endDate, unavailableDates, today }
) {
  const blocked = new Set(
    Array.isArray(unavailableDates) ? unavailableDates.map(String) : []
  );

  if (isDateKey(today) && dateKey < today) return DAY_STATE.PAST;
  if (blocked.has(dateKey)) return DAY_STATE.UNAVAILABLE;

  if (startDate && endDate) {
    if (dateKey === startDate) return DAY_STATE.RANGE_START;
    if (dateKey === endDate) return DAY_STATE.RANGE_END;
    if (dateKey > startDate && dateKey < endDate) return DAY_STATE.RANGE_MIDDLE;
  } else if (startDate && dateKey === startDate) {
    return DAY_STATE.SELECTED_SINGLE;
  }

  return DAY_STATE.AVAILABLE;
}

export function isInteractive(state) {
  return state !== DAY_STATE.PAST && state !== DAY_STATE.UNAVAILABLE;
}

/**
 * Full render model: one entry per cell, each with exactly one day number and
 * exactly one state.
 */
export function buildCalendarCells(month, selection) {
  return buildMonthGrid(month, selection).map((cell) => {
    const state = resolveDayState(cell.dateKey, selection);
    return {
      ...cell,
      state,
      selectable: isInteractive(state) && !cell.outsideMonth,
    };
  });
}
