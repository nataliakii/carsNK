"use client";

/**
 * Binds one car to its own slice of `calendarStateByCarId`.
 *
 * Each card subscribes to its own car key only, so a date click on another
 * card produces no render here and therefore no quote request here. Quotes go
 * through the shared coordinator, which collapses identical requests into one
 * network call and keeps React Strict Mode's double effect harmless.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { calculateTotalPrice } from "@utils/action";
import { createCarCalendarStore } from "@utils/carCalendarStore";
import { createQuoteCoordinator } from "@utils/quoteRequestCoordinator";
import { buildQuoteRequestKey } from "@/domain/booking/publicBookingMode";
import { EMPTY_CAR_CALENDAR } from "@/domain/booking/carCalendarState";

const carCalendarStore = createCarCalendarStore();

const quoteCoordinator = createQuoteCoordinator({
  fetchQuote: ({ carId, startDate, endDate, placeIn, placeOut, insurance, signal }) =>
    calculateTotalPrice(carId, startDate, endDate, insurance || "TPL", 0, {
      signal,
      placeIn: placeIn || undefined,
      placeOut: placeOut || undefined,
    }),
});

export { carCalendarStore, quoteCoordinator };

/** Test seam: the store and cache are module singletons on the client. */
export function resetCarCalendarsForTests() {
  carCalendarStore.reset();
  quoteCoordinator.reset();
}

export function useCarCalendarSlice(carId) {
  const subscribe = useCallback(
    (listener) => carCalendarStore.subscribeCar(carId, listener),
    [carId]
  );
  const getSnapshot = useCallback(
    () => carCalendarStore.getCar(carId),
    [carId]
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_CAR_CALENDAR);
}

/**
 * @param {{ carId: string, unavailableDates?: string[], today?: string,
 *   placeIn?: string, placeOut?: string, insurance?: string,
 *   enabled?: boolean, onRejected?: (reason: string) => void }} options
 */
export function useCarCalendar({
  carId,
  unavailableDates,
  today,
  placeIn,
  placeOut,
  insurance,
  enabled = true,
  onRejected,
}) {
  const state = useCarCalendarSlice(carId);

  // Keep click handling free of changing identities: the reducer reads the
  // latest blocked days from a ref, so `selectDate` never needs to be rebuilt
  // and can never retrigger an effect that depends on it.
  const blockedRef = useRef(unavailableDates);
  blockedRef.current = unavailableDates;
  const todayRef = useRef(today);
  todayRef.current = today;
  const rejectedRef = useRef(onRejected);
  rejectedRef.current = onRejected;

  const selectDate = useCallback(
    (dateKey) => {
      const { rejected } = carCalendarStore.selectDate({
        carId,
        date: dateKey,
        unavailableDates: blockedRef.current,
        today: todayRef.current,
      });
      if (rejected) rejectedRef.current?.(rejected);
      return rejected;
    },
    [carId]
  );

  const setMonth = useCallback(
    (monthKey) => carCalendarStore.setMonth(carId, monthKey),
    [carId]
  );

  const clear = useCallback(() => carCalendarStore.clear(carId), [carId]);

  const { startDate, endDate, quoteStatus } = state;
  const requestKey = buildQuoteRequestKey({
    carId,
    startDate,
    endDate,
    placeIn,
    placeOut,
  });

  // One quote per (car, range, locations). The key is a primitive, so a new
  // object or inline function on the parent cannot make this effect refire.
  const lastRequestedRef = useRef("");
  useEffect(() => {
    if (!enabled || !requestKey) return undefined;
    if (quoteStatus === "ready" || quoteStatus === "error") return undefined;
    if (lastRequestedRef.current === requestKey) return undefined;
    lastRequestedRef.current = requestKey;

    let active = true;
    const controller = new AbortController();

    quoteCoordinator
      .request({
        carId,
        startDate,
        endDate,
        placeIn,
        placeOut,
        insurance,
        signal: controller.signal,
      })
      .then((result) => {
        if (!active || !result) return;
        const total = Number(result.totalPrice);
        const unavailable = result.available === false;
        const failed = result.ok === false || (!unavailable && !(total > 0));
        carCalendarStore.applyQuote(carId, {
          start: startDate,
          end: endDate,
          status: failed ? "error" : "ready",
          quote: failed
            ? null
            : {
                totalPrice: total,
                days: result.days,
                available: !unavailable,
                breakdown: result.breakdown || null,
                rangeKey: `${startDate}|${endDate}`,
                quoteId: requestKey,
              },
        });
      })
      .catch(() => {
        if (!active) return;
        carCalendarStore.applyQuote(carId, {
          start: startDate,
          end: endDate,
          status: "error",
          quote: null,
        });
      });

    return () => {
      // Abandon the result of a range the customer already moved off.
      active = false;
      controller.abort();
    };
  }, [
    enabled,
    requestKey,
    quoteStatus,
    carId,
    startDate,
    endDate,
    placeIn,
    placeOut,
    insurance,
  ]);

  const retryQuote = useCallback(() => {
    lastRequestedRef.current = "";
    quoteCoordinator.invalidate(carId);
    carCalendarStore.applyQuote(carId, {
      start: startDate,
      end: endDate,
      status: "loading",
      quote: null,
    });
  }, [carId, startDate, endDate]);

  return { state, selectDate, setMonth, clear, retryQuote };
}
