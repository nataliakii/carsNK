"use client";

/**
 * SEARCH_FIRST pricing.
 *
 * Every result is priced for the same immutable search request, but each car
 * keeps its own quote in local state. This path never reads or writes
 * `calendarStateByCarId`, so a CAR_FIRST draft on one card cannot leak into a
 * search result and vice versa.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { buildQuoteRequestKey } from "@/domain/booking/publicBookingMode";
import { quoteCoordinator } from "./useCarCalendar";

const IDLE = { status: "idle", quote: null };

export function useSearchFirstQuote({
  carId,
  startDate,
  endDate,
  placeIn,
  placeOut,
  insurance,
  enabled = true,
}) {
  const [result, setResult] = useState(IDLE);

  const requestKey = buildQuoteRequestKey({
    carId,
    startDate,
    endDate,
    placeIn,
    placeOut,
  });

  // A primitive key is the only dependency that matters; the car object and
  // any inline callbacks are deliberately kept out of the dependency list.
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!enabled || !requestKey) {
      setResult(IDLE);
      lastKeyRef.current = "";
      return undefined;
    }
    if (lastKeyRef.current === requestKey) return undefined;
    lastKeyRef.current = requestKey;

    let active = true;
    setResult({ status: "loading", quote: null });

    quoteCoordinator
      .request({
        carId,
        startDate,
        endDate,
        placeIn,
        placeOut,
        insurance,
      })
      .then((value) => {
        if (!active || !value) return;
        const total = Number(value.totalPrice);
        const unavailable = value.available === false;
        if (value.ok === false || (!unavailable && !(total > 0))) {
          setResult({ status: "error", quote: null });
          return;
        }
        setResult({
          status: "ready",
          quote: {
            totalPrice: total,
            days: value.days,
            available: !unavailable,
            rangeKey: `${startDate}|${endDate}`,
            quoteId: requestKey,
          },
        });
      })
      .catch(() => {
        if (active) setResult({ status: "error", quote: null });
      });

    return () => {
      active = false;
    };
  }, [enabled, requestKey, carId, startDate, endDate, placeIn, placeOut, insurance]);

  const retry = useCallback(() => {
    lastKeyRef.current = "";
    quoteCoordinator.invalidate(carId);
    setResult(IDLE);
  }, [carId]);

  return { ...result, retry };
}
