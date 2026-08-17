import dayjs from "dayjs";

/**
 * Walk from origin toward hover, inclusive, stopping before the first
 * non-paintable day. Returns normalized [start, end] or null.
 *
 * @param {string} origin YYYY-MM-DD
 * @param {string} hover YYYY-MM-DD
 * @param {(dateStr: string) => boolean} isPaintable
 * @returns {[string, string] | null}
 */
export function clampPaintRange(origin, hover, isPaintable) {
  if (!origin || !hover || typeof isPaintable !== "function") return null;
  if (!isPaintable(origin)) return null;

  const originDay = dayjs(origin, "YYYY-MM-DD");
  const hoverDay = dayjs(hover, "YYYY-MM-DD");
  if (!originDay.isValid() || !hoverDay.isValid()) return null;

  const dir = hoverDay.isBefore(originDay, "day") ? -1 : 1;
  let current = originDay;
  let lastOk = origin;

  const guard = 400;
  for (let i = 0; i < guard; i += 1) {
    if (current.format("YYYY-MM-DD") === hover) break;
    const next = current.add(dir, "day");
    const nextStr = next.format("YYYY-MM-DD");
    if (!isPaintable(nextStr)) break;
    lastOk = nextStr;
    current = next;
  }

  return lastOk < origin ? [lastOk, origin] : [origin, lastOk];
}

export function isDateInInclusiveRange(dateStr, start, end) {
  if (!dateStr || !start || !end) return false;
  const a = start <= end ? start : end;
  const b = start <= end ? end : start;
  return dateStr >= a && dateStr <= b;
}
