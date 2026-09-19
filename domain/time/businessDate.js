/**
 * Business-date utilities for rental calendar days.
 *
 * Default timezone remains Europe/Athens for historical callers.
 * Pass an explicit IANA timezone for Spain / company overrides.
 *
 * - toBusinessStartOfDay: midnight in the business timezone
 * - toStoredBusinessDate: 12:00 UTC of that calendar day (DST-safe date key)
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  canonicalizeTimezone,
  LEGACY_FALLBACK_TZ,
} from "./resolveBusinessTimezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const BUSINESS_TZ = LEGACY_FALLBACK_TZ;

function tzOf(timezone) {
  return canonicalizeTimezone(timezone) || BUSINESS_TZ;
}

/**
 * Parse any date-like value to start-of-day in the business timezone.
 * Date-only strings ("2026-03-27") are treated as midnight in that zone.
 */
export function toBusinessStartOfDay(value, timezone) {
  const tz = tzOf(timezone);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dayjs.tz(value, "YYYY-MM-DD", tz).startOf("day");
  }
  return dayjs(value).tz(tz).startOf("day");
}

/**
 * Convert to the canonical storage format: UTC date with hour=12 of the
 * business calendar day. Avoids DST edge cases where midnight UTC shifts the date.
 */
export function toStoredBusinessDate(value, timezone) {
  const tz = tzOf(timezone);
  const businessDay = dayjs.isDayjs(value)
    ? value.tz(tz).startOf("day")
    : toBusinessStartOfDay(value, tz);
  return dayjs
    .utc(businessDay.format("YYYY-MM-DD"))
    .hour(12)
    .minute(0)
    .second(0)
    .millisecond(0)
    .toDate();
}
