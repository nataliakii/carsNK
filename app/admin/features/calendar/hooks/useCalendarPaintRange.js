"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampPaintRange, isDateInInclusiveRange } from "./paintRange";

const PAINT_DATE_ATTR = "data-calendar-paint-date";
const PAINT_CAR_ATTR = "data-calendar-paint-car";
const PAINT_OK_ATTR = "data-calendar-paint-ok";

/**
 * Drag across empty days on one car row to pick a rental range.
 */
export function useCalendarPaintRange({ enabled = true, onCommit } = {}) {
  const [paint, setPaint] = useState(null);
  const paintRef = useRef(null);
  const suppressClickRef = useRef(false);

  const sync = useCallback((next) => {
    paintRef.current = next;
    setPaint(next);
  }, []);

  const cancelPaint = useCallback(() => {
    sync(null);
  }, [sync]);

  const startPaint = useCallback(
    (e, { car, dateStr }) => {
      if (!enabled) return;
      if (e.pointerType === "touch") return;
      if (typeof e.button === "number" && e.button !== 0) return;
      if (!car?._id || !dateStr) return;

      suppressClickRef.current = false;
      sync({
        carId: String(car._id),
        car,
        origin: dateStr,
        start: dateStr,
        end: dateStr,
      });
    },
    [enabled, sync]
  );

  const extendTo = useCallback((carId, dateStr, hoveredPaintable) => {
    const cur = paintRef.current;
    if (!cur || !dateStr) return;
    if (String(carId) !== String(cur.carId)) return;

    const clamped = clampPaintRange(cur.origin, dateStr, (ds) => {
      if (ds === cur.origin) return true;
      if (ds === dateStr) return Boolean(hoveredPaintable);
      const carId = String(cur.carId);
      const carSel =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(carId)
          : carId;
      const node = document.querySelector(
        `[${PAINT_CAR_ATTR}="${carSel}"][${PAINT_DATE_ATTR}="${ds}"]`
      );
      if (!node) return true;
      return node.getAttribute(PAINT_OK_ATTR) === "1";
    });
    if (!clamped) return;
    if (clamped[0] === cur.start && clamped[1] === cur.end) return;
    sync({ ...cur, start: clamped[0], end: clamped[1] });
  }, [sync]);

  const finishPaint = useCallback(() => {
    const cur = paintRef.current;
    if (!cur) return;
    const multiDay = cur.start !== cur.end;
    sync(null);
    if (!multiDay) return;
    suppressClickRef.current = true;
    onCommit?.(cur.car, [cur.start, cur.end]);
  }, [onCommit, sync]);

  useEffect(() => {
    if (!paint) return undefined;

    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const node = el?.closest?.(`[${PAINT_DATE_ATTR}]`);
      if (!node) return;
      const carId = node.getAttribute(PAINT_CAR_ATTR);
      const dateStr = node.getAttribute(PAINT_DATE_ATTR);
      const ok = node.getAttribute(PAINT_OK_ATTR) === "1";
      extendTo(carId, dateStr, ok);
    };

    const onUp = () => finishPaint();

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [paint, extendTo, finishPaint]);

  useEffect(() => {
    if (!enabled && paintRef.current) cancelPaint();
  }, [enabled, cancelPaint]);

  const consumePaintClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  const isDatePainted = useCallback(
    (carId, dateStr) => {
      if (!paint) return false;
      if (String(carId) !== String(paint.carId)) return false;
      return isDateInInclusiveRange(dateStr, paint.start, paint.end);
    },
    [paint]
  );

  return {
    paintRange: paint,
    isPainting: Boolean(paint),
    startPaint,
    cancelPaint,
    consumePaintClick,
    isDatePainted,
    PAINT_DATE_ATTR,
    PAINT_CAR_ATTR,
    PAINT_OK_ATTR,
  };
}
