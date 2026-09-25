/**
 * External store holding `calendarStateByCarId`.
 *
 * Why a store and not React context: a context value change re-renders every
 * consumer, which is how one car's date click used to repaint (and re-fetch)
 * the whole result list. Here each card subscribes to its own car key, and a
 * transition that leaves a car's slice referentially equal never notifies that
 * card at all.
 */

import {
  EMPTY_CAR_CALENDAR,
  applyCarQuote,
  clearCarSelection,
  getCarCalendarState,
  pruneCarCalendars,
  selectCarDate,
  setCarDisplayMonth,
} from "@/domain/booking/carCalendarState";

export function createCarCalendarStore(initialMap = {}) {
  let map = initialMap || {};
  /** @type {Map<string, Set<() => void>>} */
  const carListeners = new Map();
  const globalListeners = new Set();

  function listenersFor(carId) {
    const key = String(carId);
    if (!carListeners.has(key)) carListeners.set(key, new Set());
    return carListeners.get(key);
  }

  /** Notify only the cars whose slice identity actually changed. */
  function commit(nextMap) {
    if (nextMap === map) return;
    const previous = map;
    map = nextMap;
    const touched = new Set([
      ...Object.keys(previous),
      ...Object.keys(nextMap),
    ]);
    touched.forEach((key) => {
      if (previous[key] === nextMap[key]) return;
      carListeners.get(key)?.forEach((listener) => listener());
    });
    globalListeners.forEach((listener) => listener());
  }

  return {
    getMap: () => map,
    getCar: (carId) => getCarCalendarState(map, carId),

    subscribeCar(carId, listener) {
      const set = listenersFor(carId);
      set.add(listener);
      return () => set.delete(listener);
    },

    subscribe(listener) {
      globalListeners.add(listener);
      return () => globalListeners.delete(listener);
    },

    /** @returns {{committed: {start,end}|null, rejected: string|null}} */
    selectDate(args) {
      const result = selectCarDate(map, args);
      commit(result.map);
      return { committed: result.committed, rejected: result.rejected };
    },

    setMonth(carId, month) {
      commit(setCarDisplayMonth(map, carId, month));
    },

    clear(carId) {
      commit(clearCarSelection(map, carId));
    },

    applyQuote(carId, payload) {
      commit(applyCarQuote(map, carId, payload));
    },

    prune(liveCarIds) {
      commit(pruneCarCalendars(map, liveCarIds));
    },

    reset() {
      commit({});
    },
  };
}

export { EMPTY_CAR_CALENDAR };
