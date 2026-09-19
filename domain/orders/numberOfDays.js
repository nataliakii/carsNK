import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ATHENS_TZ, fromServerUTC } from "@/domain/time/athensTime";
import {
  canonicalizeTimezone,
  LEGACY_FALLBACK_TZ,
} from "@/domain/time/resolveBusinessTimezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MINUTES_IN_RENTAL_DAY = 24 * 60;

function resolveTz(timezone) {
  return canonicalizeTimezone(timezone) || LEGACY_FALLBACK_TZ || ATHENS_TZ;
}

function toMinuteOfDay(value) {
  return value.hour() * 60 + value.minute() + value.second() / 60;
}

function calculateBusinessWallClockMinutes(start, end) {
  // Calendar day delta in neutral UTC date space (DST-safe).
  const startDateKey = start.format("YYYY-MM-DD");
  const endDateKey = end.format("YYYY-MM-DD");
  const startDateUtc = dayjs.utc(startDateKey, "YYYY-MM-DD", true);
  const endDateUtc = dayjs.utc(endDateKey, "YYYY-MM-DD", true);
  const dayDelta = endDateUtc.diff(startDateUtc, "day");

  const startMinuteOfDay = toMinuteOfDay(start);
  const endMinuteOfDay = toMinuteOfDay(end);

  return dayDelta * MINUTES_IN_RENTAL_DAY + (endMinuteOfDay - startMinuteOfDay);
}

/**
 * Normalizes any date-like value to a dayjs object in the business timezone.
 * Date-only strings are interpreted as midnight in that timezone.
 * Default timezone remains Europe/Athens for historical callers.
 *
 * @param {Date|string|import("dayjs").Dayjs} value
 * @param {string} [timezone]
 * @returns {import("dayjs").Dayjs|null}
 */
export function toBusinessDateTime(value, timezone) {
  if (value == null) return null;
  const tz = resolveTz(timezone);

  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.tz(tz) : null;
  }

  if (value instanceof Date) {
    const parsedDate = dayjs.utc(value).tz(tz);
    return parsedDate.isValid() ? parsedDate : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (DATE_ONLY_PATTERN.test(trimmed)) {
      const parsedDateOnly = dayjs.tz(trimmed, "YYYY-MM-DD", tz);
      return parsedDateOnly.isValid() ? parsedDateOnly : null;
    }

    const parsedDateTime = /Z|[+-]\d{2}:\d{2}$/.test(trimmed)
      ? dayjs.utc(trimmed).tz(tz)
      : dayjs(trimmed).tz(tz);
    return parsedDateTime.isValid() ? parsedDateTime : null;
  }

  const parsedFallback = dayjs(value).tz(tz);
  return parsedFallback.isValid() ? parsedFallback : null;
}

/**
 * Calculates billable rental days using BUSINESS wall-clock 24-hour blocks:
 * - 1..24 hours => 1 day
 * - 25..48 hours => 2 days
 * - etc.
 *
 * IMPORTANT:
 * - Calculation is based on Athens calendar date + clock time.
 * - DST transitions do not shrink/expand a "business day" block.
 *   Example: 28 Mar 14:00 -> 29 Mar 14:01 = 24h01m => 2 days.
 *
 * @param {Date|string|import("dayjs").Dayjs} rentalStartDateTime
 * @param {Date|string|import("dayjs").Dayjs} rentalEndDateTime
 * @returns {number}
 */
export function getBusinessRentalDaysByMinutes(
  rentalStartDateTime,
  rentalEndDateTime,
  timezone
) {
  const start = toBusinessDateTime(rentalStartDateTime, timezone);
  const end = toBusinessDateTime(rentalEndDateTime, timezone);

  if (!start || !end || !start.isValid() || !end.isValid()) return 0;

  const diffMinutes = calculateBusinessWallClockMinutes(start, end);
  if (!Number.isFinite(diffMinutes) || diffMinutes <= 0) return 0;

  return Math.ceil(diffMinutes / MINUTES_IN_RENTAL_DAY);
}

/**
 * Returns business day span between stored UTC dates (Athens day boundaries).
 *
 * @param {Date|string} rentalStartDate
 * @param {Date|string} rentalEndDate
 * @returns {number}
 */
export function getBusinessDaySpanFromStoredDates(
  rentalStartDate,
  rentalEndDate,
  timezone
) {
  if (!rentalStartDate || !rentalEndDate) return 0;

  const start = fromServerUTC(rentalStartDate, timezone);
  const end = fromServerUTC(rentalEndDate, timezone);

  return getBusinessRentalDaysByMinutes(start, end, timezone);
}

/**
 * Raw value for channels where "missing" should stay missing.
 *
 * @param {Object} order
 * @returns {number|undefined}
 */
export function getOrderNumberOfDays(order) {
  return order?.numberOfDays;
}

/**
 * Safe value for UI labels where empty should be rendered as 0.
 *
 * @param {Object} order
 * @returns {number}
 */
export function getOrderNumberOfDaysOrZero(order) {
  return order?.numberOfDays || 0;
}
