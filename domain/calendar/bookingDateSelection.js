/**
 * Booking date selection helpers — keep calendar → Book → BookingModal consistent.
 */
import dayjs from "dayjs";

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isValidBookingDateValue(value) {
  if (value == null || value === "") return false;
  const d = dayjs.isDayjs(value) ? value : dayjs(value);
  return Boolean(d && d.isValid && d.isValid());
}

/**
 * Normalize a calendar selection into start/end for BookingModal.
 * Returns null when either side is missing or invalid.
 *
 * @param {{ start?: *, end?: *, startDate?: *, endDate?: * } | null | undefined} selection
 * @returns {{ start: import("dayjs").Dayjs, end: import("dayjs").Dayjs } | null}
 */
export function normalizeBookingDateSelection(selection) {
  if (!selection || typeof selection !== "object") return null;
  const startRaw = selection.start ?? selection.startDate;
  const endRaw = selection.end ?? selection.endDate;
  if (!isValidBookingDateValue(startRaw) || !isValidBookingDateValue(endRaw)) {
    return null;
  }
  const start = dayjs.isDayjs(startRaw) ? startRaw : dayjs(startRaw);
  const end = dayjs.isDayjs(endRaw) ? endRaw : dayjs(endRaw);
  if (end.isBefore(start, "day")) return null;
  return { start, end };
}

/**
 * Format for display — never returns the string "Invalid Date".
 * @param {*} value
 * @param {string} format
 * @param {string} [fallback]
 */
export function formatValidBookingDate(value, format = "DD.MM.YYYY", fallback = "") {
  if (!isValidBookingDateValue(value)) return fallback;
  const d = dayjs.isDayjs(value) ? value : dayjs(value);
  const formatted = d.format(format);
  return formatted === "Invalid Date" ? fallback : formatted;
}
