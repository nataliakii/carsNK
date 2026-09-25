"use client";

/**
 * `activeCalendarCarId` and `sort` are the only public-catalog state that is
 * legitimately global: which card is expanded, and how results are ordered.
 * Dates, display month and price are deliberately absent here — they belong
 * to a single car.
 */

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_SORT, normalizeSort } from "@/domain/booking/carResultSorting";

function createValueStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (next === value) return;
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const activeCalendarStore = createValueStore(null);
const sortStore = createValueStore(DEFAULT_SORT);

export { activeCalendarStore, sortStore };

export function resetCatalogUiForTests() {
  activeCalendarStore.set(null);
  sortStore.set(DEFAULT_SORT);
}

export function useActiveCalendarCar() {
  const activeCarId = useSyncExternalStore(
    activeCalendarStore.subscribe,
    activeCalendarStore.get,
    () => null
  );

  /** Opening a calendar closes the previous one; clicking it again closes it. */
  const toggleCalendar = useCallback((carId) => {
    const key = carId == null ? null : String(carId);
    activeCalendarStore.set(activeCalendarStore.get() === key ? null : key);
  }, []);

  const closeCalendar = useCallback(() => activeCalendarStore.set(null), []);

  return { activeCarId, toggleCalendar, closeCalendar };
}

export function useCatalogSort() {
  const sort = useSyncExternalStore(
    sortStore.subscribe,
    sortStore.get,
    () => DEFAULT_SORT
  );
  const setSort = useCallback((next) => sortStore.set(normalizeSort(next)), []);
  return { sort, setSort };
}
