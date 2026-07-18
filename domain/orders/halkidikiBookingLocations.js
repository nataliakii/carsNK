import {
  DEFAULT_BOOKING_LOCATION,
  ORDERED_LOCATION_OPTIONS,
} from "./locationOptions";

const THESSALONIKI_CANONICAL = "Thessaloniki";

/**
 * Pickup/return options allowed for public (customer) orders: same canonical list
 * as the company (Halkidiki area + Thessaloniki city + Airport SKG). Free-text must
 * match one of these labels (case-insensitive).
 */
export const HALKIDIKI_BOOKING_LOCATION_OPTIONS = [...ORDERED_LOCATION_OPTIONS];

const CANONICAL_BY_NORMALIZED = new Map();
for (const name of HALKIDIKI_BOOKING_LOCATION_OPTIONS) {
  CANONICAL_BY_NORMALIZED.set(normalizeBookingLocationKey(name), name);
}

export function normalizeBookingLocationKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function isAllowedCustomerBookingLocation(value) {
  const key = normalizeBookingLocationKey(value);
  if (!key) return false;
  return CANONICAL_BY_NORMALIZED.has(key);
}

/** Returns canonical label from the list, or null if not allowed. */
export function canonicalizeCustomerBookingLocation(value) {
  return CANONICAL_BY_NORMALIZED.get(normalizeBookingLocationKey(value)) ?? null;
}

/**
 * If the raw string is an allowed location (any casing), return canonical spelling;
 * otherwise return default (typically Nea Kallikratia).
 */
export function resolveCustomerBookingLocationOrDefault(
  raw,
  defaultLocation = DEFAULT_BOOKING_LOCATION
) {
  const fromRaw = canonicalizeCustomerBookingLocation(raw);
  if (fromRaw) return fromRaw;
  const fromDefault = canonicalizeCustomerBookingLocation(defaultLocation);
  return (
    fromDefault ??
    HALKIDIKI_BOOKING_LOCATION_OPTIONS[0] ??
    DEFAULT_BOOKING_LOCATION
  );
}

export function isThessalonikiCityBookingLocation(value) {
  return canonicalizeCustomerBookingLocation(value) === THESSALONIKI_CANONICAL;
}
