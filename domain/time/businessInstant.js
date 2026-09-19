/**
 * Canonical rental datetime conversion.
 *
 * Customer selects local pickup/return date+time
 *   → interpret in the resolved business timezone
 *   → store canonical UTC instants
 *   → also keep local date/time + timezone snapshot for display/audit
 *   → display converts from UTC using the stored timezone
 *
 * DST:
 *   - Nonexistent local times (spring-forward gap) are rejected (round-trip).
 *   - Ambiguous fall-back times: if dayjs's chosen offset does not round-trip
 *     to the same wall-clock, the time is rejected (NONEXISTENT_LOCAL_TIME).
 *     Callers must pick an explicit occurrence (e.g. 01:30 DST or 03:00 STD).
 *     This is deterministic: we never guess which overlap occurrence was meant.
 *
 * Uses the existing dayjs + timezone plugin. No extra date library.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
import {
  canonicalizeTimezone,
  LEGACY_FALLBACK_TZ,
} from "./resolveBusinessTimezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM = /^\d{2}:\d{2}$/;

export const DATETIME_ERROR = {
  INVALID_LOCAL_TIME: "INVALID_LOCAL_TIME",
  NONEXISTENT_LOCAL_TIME: "NONEXISTENT_LOCAL_TIME",
  INVALID_TIMEZONE: "INVALID_TIMEZONE",
  PICKUP_AFTER_RETURN: "PICKUP_AFTER_RETURN",
};

/**
 * Parse a wall-clock local date+time in `timezone` into a UTC Date.
 *
 * @returns {{
 *   ok: boolean,
 *   code?: string,
 *   timezone?: string,
 *   local?: import("dayjs").Dayjs,
 *   utc?: Date,
 *   localDate?: string,
 *   localTime?: string,
 * }}
 */
export function parseLocalInTimezone(dateStr, timeStr, timezone) {
  const tz = canonicalizeTimezone(timezone);
  if (!tz) {
    return { ok: false, code: DATETIME_ERROR.INVALID_TIMEZONE };
  }
  const date = String(dateStr || "").trim();
  const time = String(timeStr || "").trim();
  if (!DATE_ONLY.test(date) || !TIME_HM.test(time)) {
    return { ok: false, code: DATETIME_ERROR.INVALID_LOCAL_TIME, timezone: tz };
  }

  const local = dayjs.tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", tz);
  if (!local.isValid()) {
    return { ok: false, code: DATETIME_ERROR.INVALID_LOCAL_TIME, timezone: tz };
  }

  if (local.format("YYYY-MM-DD HH:mm") !== `${date} ${time}`) {
    return {
      ok: false,
      code: DATETIME_ERROR.NONEXISTENT_LOCAL_TIME,
      timezone: tz,
    };
  }

  return {
    ok: true,
    timezone: tz,
    local,
    utc: local.utc().toDate(),
    localDate: date,
    localTime: time,
  };
}

export function createBusinessDateTime(dateStr, timeStr, timezone) {
  const parsed = parseLocalInTimezone(
    dateStr,
    timeStr,
    timezone || LEGACY_FALLBACK_TZ
  );
  return parsed.ok ? parsed.local : null;
}

export function toUtcDate(localDayjs) {
  if (!localDayjs || !dayjs.isDayjs(localDayjs) || !localDayjs.isValid()) {
    return null;
  }
  return localDayjs.utc().toDate();
}

export function fromUtcInTimezone(utcValue, timezone) {
  if (utcValue == null) return null;
  const tz = canonicalizeTimezone(timezone) || LEGACY_FALLBACK_TZ;
  const result = dayjs.utc(utcValue).tz(tz);
  return result.isValid() ? result : null;
}

export function formatInTimezone(utcValue, timezone, format = "YYYY-MM-DD HH:mm") {
  const local = fromUtcInTimezone(utcValue, timezone);
  return local ? local.format(format) : "";
}

export function localSnapshotFromUtc(utcValue, timezone) {
  const local = fromUtcInTimezone(utcValue, timezone);
  if (!local) return { date: "", time: "" };
  return {
    date: local.format("YYYY-MM-DD"),
    time: local.format("HH:mm"),
  };
}

/**
 * Interpret an already-parsed instant (Date / ISO / dayjs) in a timezone.
 * Date-only strings are treated as midnight in that timezone.
 */
export function interpretInstant(value, timezone) {
  const tz = canonicalizeTimezone(timezone) || LEGACY_FALLBACK_TZ;
  if (value == null) return null;

  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.tz(tz) : null;
  }

  if (value instanceof Date) {
    const parsed = dayjs.utc(value).tz(tz);
    return parsed.isValid() ? parsed : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (DATE_ONLY.test(trimmed)) {
      const parsed = dayjs.tz(trimmed, "YYYY-MM-DD", tz);
      return parsed.isValid() ? parsed : null;
    }
    const parsed = dayjs.utc(trimmed).tz(tz);
    return parsed.isValid() ? parsed : null;
  }

  const parsed = dayjs.utc(value).tz(tz);
  return parsed.isValid() ? parsed : null;
}

export function generateOrderNumberInTz(timezone, now = new Date()) {
  const tz = canonicalizeTimezone(timezone) || LEGACY_FALLBACK_TZ;
  const d = dayjs(now).tz(tz);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    String(d.year()) +
    pad(d.month() + 1) +
    pad(d.date()) +
    pad(d.hour()) +
    pad(d.minute()) +
    pad(d.second())
  );
}
