/**
 * Per-car calendar state for the CAR_FIRST path.
 *
 * The whole catalog bug came from one shared start/end/month triple. This
 * module owns a map keyed by the stable car `_id`; every transition returns a
 * new map in which exactly one car's slice changed. A car that was not named
 * in the action keeps its previous object identity, so its card does not
 * re-render and its quote effect does not refire.
 *
 * @typedef {{ displayMonth: string|null, startDate: string|null,
 *   endDate: string|null, quote: object|null,
 *   quoteStatus: "idle"|"loading"|"ready"|"error" }} CarCalendarState
 */

import { isDateKey } from "./publicBookingMode";

export const EMPTY_CAR_CALENDAR = Object.freeze({
  displayMonth: null,
  startDate: null,
  endDate: null,
  quote: null,
  quoteStatus: "idle",
});

/** `2026-10-14` → `2026-10` */
export function monthKeyOf(dateKey) {
  return isDateKey(dateKey) ? dateKey.slice(0, 7) : null;
}

function carKey(carId) {
  return carId == null ? "" : String(carId);
}

/**
 * Read one car's slice. Always returns a usable object so callers never have
 * to guard, and never leaks another car's state.
 *
 * @returns {CarCalendarState}
 */
export function getCarCalendarState(map, carId) {
  const key = carKey(carId);
  if (!key) return EMPTY_CAR_CALENDAR;
  return map?.[key] || EMPTY_CAR_CALENDAR;
}

/** Immutable single-key write. Returns the same map when nothing changed. */
function writeCar(map, carId, patch) {
  const key = carKey(carId);
  if (!key) return map || {};
  const base = map || {};
  const current = base[key] || EMPTY_CAR_CALENDAR;
  const next = { ...current, ...patch };
  const unchanged = Object.keys(next).every((field) => next[field] === current[field]);
  if (unchanged) return base;
  return { ...base, [key]: next };
}

/**
 * Every calendar day between two keys, inclusive. Pure string maths so no
 * timezone conversion can move the boundaries by a day.
 */
export function datesInRange(start, end) {
  if (!isDateKey(start) || !isDateKey(end) || end < start) return [];
  const days = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * A range may touch only days the customer is allowed to book. Both ends and
 * every day in between must be clear, so a selection cannot straddle an
 * existing booking.
 */
export function rangeCrossesUnavailable(start, end, unavailableDates) {
  const blocked = new Set(
    Array.isArray(unavailableDates) ? unavailableDates.map(String) : []
  );
  if (blocked.size === 0) return false;
  return datesInRange(start, end).some((day) => blocked.has(day));
}

export function isDaySelectable(dateKey, { unavailableDates, today } = {}) {
  if (!isDateKey(dateKey)) return false;
  if (isDateKey(today) && dateKey < today) return false;
  const blocked = Array.isArray(unavailableDates) ? unavailableDates.map(String) : [];
  return !blocked.includes(dateKey);
}

/**
 * CAR_FIRST click handling for one car.
 *
 * First click sets the start and drops the stale end + quote. Second click
 * must land after the start on a clear day with a clear interval; it commits
 * the range. A click after a finished range starts over. Any rejected click
 * leaves the other cars untouched because only this car's key is written.
 *
 * @returns {{ map: object, committed: {start: string, end: string}|null,
 *   rejected: "unavailableDay"|"crossesUnavailable"|null }}
 */
export function selectCarDate(map, { carId, date, unavailableDates, today }) {
  const key = carKey(carId);
  const base = map || {};
  if (!key || !isDateKey(date)) {
    return { map: base, committed: null, rejected: null };
  }

  if (!isDaySelectable(date, { unavailableDates, today })) {
    return { map: base, committed: null, rejected: "unavailableDay" };
  }

  const current = getCarCalendarState(base, key);
  const startingOver = !current.startDate || Boolean(current.endDate);

  if (startingOver || date <= current.startDate) {
    return {
      map: writeCar(base, key, {
        startDate: date,
        endDate: null,
        quote: null,
        quoteStatus: "idle",
        displayMonth: current.displayMonth || monthKeyOf(date),
      }),
      committed: null,
      rejected: null,
    };
  }

  if (rangeCrossesUnavailable(current.startDate, date, unavailableDates)) {
    return {
      map: writeCar(base, key, {
        endDate: null,
        quote: null,
        quoteStatus: "idle",
      }),
      committed: null,
      rejected: "crossesUnavailable",
    };
  }

  return {
    map: writeCar(base, key, {
      endDate: date,
      quote: null,
      quoteStatus: "loading",
    }),
    committed: { start: current.startDate, end: date },
    rejected: null,
  };
}

/** Month paging for one car. Never touches the selected range. */
export function setCarDisplayMonth(map, carId, month) {
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    return map || {};
  }
  return writeCar(map, carId, { displayMonth: month });
}

export function clearCarSelection(map, carId) {
  return writeCar(map, carId, {
    startDate: null,
    endDate: null,
    quote: null,
    quoteStatus: "idle",
  });
}

/**
 * Quote results are addressed by range so a late response for an abandoned
 * range can never paint a price onto the current selection.
 */
export function applyCarQuote(map, carId, { start, end, quote, status }) {
  const current = getCarCalendarState(map, carId);
  if (current.startDate !== start || current.endDate !== end) {
    return map || {};
  }
  return writeCar(map, carId, {
    quote: status === "ready" ? quote || null : null,
    quoteStatus: status,
  });
}

/** Drop every car except the ones still on screen, so the map cannot grow forever. */
export function pruneCarCalendars(map, liveCarIds) {
  const base = map || {};
  const live = new Set((Array.isArray(liveCarIds) ? liveCarIds : []).map(carKey));
  const keys = Object.keys(base);
  if (keys.every((key) => live.has(key))) return base;
  const next = {};
  keys.forEach((key) => {
    if (live.has(key)) next[key] = base[key];
  });
  return next;
}
