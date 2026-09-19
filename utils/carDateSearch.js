/**
 * Catalog date-search helpers: availability for a range + session persistence.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  evaluateRentalAvailability,
  AVAILABILITY_PURPOSE,
} from "@/domain/booking/availabilityEngine";
import { resolveBookingMode } from "@/domain/booking/bookingMode";
import { resolveBusinessTimezone } from "@/domain/time/resolveBusinessTimezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const CATALOG_SEARCH_DATES_STORAGE_KEY = "catalogSearchDates";

/**
 * @param {unknown} value
 * @returns {string|null} YYYY-MM-DD
 */
export function toSearchDateKey(value) {
  if (!value) return null;
  const d = dayjs(value);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
}

/**
 * @param {{ start?: unknown, end?: unknown }|null|undefined} dates
 * @returns {{ start: string|null, end: string|null }}
 */
export function normalizeSearchDates(dates) {
  return {
    start: toSearchDateKey(dates?.start),
    end: toSearchDateKey(dates?.end),
  };
}

export function readStoredSearchDates() {
  if (typeof window === "undefined") return { start: null, end: null };
  try {
    const raw = sessionStorage.getItem(CATALOG_SEARCH_DATES_STORAGE_KEY);
    if (!raw) return { start: null, end: null };
    return normalizeSearchDates(JSON.parse(raw));
  } catch {
    return { start: null, end: null };
  }
}

export function writeStoredSearchDates(dates) {
  if (typeof window === "undefined") return;
  const normalized = normalizeSearchDates(dates);
  if (!normalized.start || !normalized.end) {
    sessionStorage.removeItem(CATALOG_SEARCH_DATES_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(
    CATALOG_SEARCH_DATES_STORAGE_KEY,
    JSON.stringify(normalized)
  );
}

/**
 * Whether a car is hard-available for the given pickup/return calendar days.
 * Uses company default times + availability engine (same as booking create).
 *
 * @param {object} params
 * @param {object[]} params.orders - orders already on this car
 * @param {string|Date|import('dayjs').Dayjs} params.start
 * @param {string|Date|import('dayjs').Dayjs} params.end
 * @param {object} [params.company]
 * @param {object} [params.platform]
 * @returns {boolean}
 */
export function isCarAvailableForSearchDates({
  orders,
  start,
  end,
  company,
  platform,
}) {
  const startKey = toSearchDateKey(start);
  const endKey = toSearchDateKey(end);
  if (!startKey || !endKey) return true;

  const tz = resolveBusinessTimezone({
    company,
    countryCode: company?.country || platform?.country,
    platformSettings: platform,
    forNewOrder: true,
  });

  const defaultStart = String(company?.defaultStart || "10:00").slice(0, 5);
  const defaultEnd = String(company?.defaultEnd || "10:00").slice(0, 5);
  const [sh = "10", sm = "00"] = defaultStart.split(":");
  const [eh = "10", em = "00"] = defaultEnd.split(":");

  const pickup = dayjs.tz(
    `${startKey} ${sh.padStart(2, "0")}:${sm.padStart(2, "0")}`,
    "YYYY-MM-DD HH:mm",
    tz
  );
  const ret = dayjs.tz(
    `${endKey} ${eh.padStart(2, "0")}:${em.padStart(2, "0")}`,
    "YYYY-MM-DD HH:mm",
    tz
  );
  if (!pickup.isValid() || !ret.isValid() || !pickup.isBefore(ret)) {
    return false;
  }

  const bookingMode = resolveBookingMode({
    company,
    platformSettings: platform,
    countryCode: company?.country || platform?.country,
    forNewOrder: true,
  });

  const result = evaluateRentalAvailability({
    purpose: AVAILABILITY_PURPOSE.REQUEST,
    bookingMode,
    timezone: tz,
    bufferHours: Number(company?.bufferTime) || 0,
    minDurationHours: Number(company?.minRentalDuration) || 0,
    pickupAtUtc: pickup.toDate(),
    returnAtUtc: ret.toDate(),
    existingOrders: Array.isArray(orders) ? orders : [],
  });

  return Boolean(result?.available);
}

/**
 * @param {string|null|undefined} selectedRegion
 * @param {string|null|undefined} carOwnerId
 * @param {Record<string, string[]>} ownerIdsByRegion - region name → ownerId[]
 */
export function carMatchesRegionFilter(
  selectedRegion,
  carOwnerId,
  ownerIdsByRegion
) {
  if (!selectedRegion || selectedRegion === "All") return true;
  const map = ownerIdsByRegion || {};
  const mapKeys = Object.keys(map);
  // Regions not loaded yet — do not hide the fleet.
  if (mapKeys.length === 0) return true;
  const owners = map[selectedRegion];
  if (!Array.isArray(owners) || owners.length === 0) return false;
  const oid = carOwnerId != null ? String(carOwnerId) : "";
  if (!oid) return false;
  return owners.map(String).includes(oid);
}
