/**
 * Business-date utilities for Greece (Europe/Athens).
 *
 * - toBusinessStartOfDay: parse any date-like value to midnight in Athens
 * - toStoredBusinessDate: convert to the canonical stored format (12:00 UTC of the Athens calendar day)
 *
 * Extracted to avoid duplication across API routes.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const BUSINESS_TZ = "Europe/Athens";

/**
 * Parse any date-like value to start-of-day in Athens timezone.
 * Date-only strings ("2026-03-27") are treated as Athens midnight.
 */
export function toBusinessStartOfDay(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dayjs.tz(value, "YYYY-MM-DD", BUSINESS_TZ).startOf("day");
  }
  return dayjs(value).tz(BUSINESS_TZ).startOf("day");
}

/**
 * Convert to the canonical storage format: UTC date with hour=12 of the Athens calendar day.
 * This avoids DST edge cases where midnight UTC could shift the date.
 */
export function toStoredBusinessDate(value) {
  const businessDay = dayjs.isDayjs(value)
    ? value.tz(BUSINESS_TZ).startOf("day")
    : toBusinessStartOfDay(value);
  return dayjs
    .utc(businessDay.format("YYYY-MM-DD"))
    .hour(12)
    .minute(0)
    .second(0)
    .millisecond(0)
    .toDate();
}
