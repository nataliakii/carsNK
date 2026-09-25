"use client";

/**
 * SEARCH_FIRST catalog pricing: one batch request for the whole result set.
 * Individual cards must not call the single-car quote endpoint for this path.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateCatalogQuotes } from "@utils/action";
import { hasCompleteRange } from "@/domain/booking/publicBookingMode";
import {
  buildCatalogQuoteRequestKey,
  catalogQuoteFromHttpBody,
  normalizeCatalogCarIds,
} from "@/domain/booking/catalogQuoteBatch";

const EMPTY = { status: "idle", byCarId: {} };

export function useSearchFirstCatalogQuotes({
  cars,
  startDate,
  endDate,
  placeIn,
  placeOut,
  enabled = true,
}) {
  const carIds = useMemo(
    () => normalizeCatalogCarIds((cars || []).map((car) => car?._id)),
    [cars]
  );
  const requestKey = buildCatalogQuoteRequestKey({
    carIds,
    startDate,
    endDate,
    placeIn,
    placeOut,
  });

  const [result, setResult] = useState(EMPTY);
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!enabled || !requestKey || !hasCompleteRange(startDate, endDate)) {
      setResult(EMPTY);
      lastKeyRef.current = "";
      return undefined;
    }
    if (lastKeyRef.current === requestKey) return undefined;
    lastKeyRef.current = requestKey;

    let active = true;
    setResult({ status: "loading", byCarId: {} });

    calculateCatalogQuotes({
      carIds,
      rentalStartDate: startDate,
      rentalEndDate: endDate,
      placeIn,
      placeOut,
    }).then((payload) => {
      if (!active) return;
      if (!payload?.ok) {
        setResult({ status: "error", byCarId: {} });
        return;
      }
      const byCarId = {};
      carIds.forEach((carId) => {
        const mapped = catalogQuoteFromHttpBody(carId, {
          ...payload.quotes?.[carId],
          rangeKey: `${startDate}|${endDate}`,
          quoteId: `${carId}|${startDate}|${endDate}|${placeIn || ""}|${placeOut || ""}`,
        });
        byCarId[carId] = mapped;
      });
      setResult({ status: "ready", byCarId });
    });

    return () => {
      active = false;
    };
  }, [enabled, requestKey, carIds, startDate, endDate, placeIn, placeOut]);

  return result;
}
