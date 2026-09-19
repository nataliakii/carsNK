/**
 * Country-aware business timezone resolver for rental bookings.
 *
 * Priority (first match wins):
 *   1. booking/order timezone snapshot
 *   2. company timezone override
 *   3. city/region timezone where available
 *   4. country configuration timezone
 *   5. explicit legacy fallback Europe/Athens
 *
 * Never use the server/Vercel process timezone as business time.
 * Historical orders without a snapshot use Europe/Athens, not the current
 * deployment country.
 *
 * IANA note: Canary Islands are `Atlantic/Canary`. `Europe/Canary` is
 * accepted as an alias and stored/canonicalized to `Atlantic/Canary`.
 */

import { getCountryPreset } from "@config/siteCountry";

export const LEGACY_FALLBACK_TZ = "Europe/Athens";

export const COUNTRY_TIMEZONES = {
  GR: "Europe/Athens",
  ES: "Europe/Madrid",
};

export const TZ_ALIASES = {
  "Europe/Canary": "Atlantic/Canary",
};

const KNOWN_TZ = new Set([
  "Europe/Athens",
  "Europe/Madrid",
  "Atlantic/Canary",
]);

export function canonicalizeTimezone(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const mapped = TZ_ALIASES[trimmed] || trimmed;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: mapped }).format(new Date());
  } catch {
    return null;
  }
  return mapped;
}

export function timezoneForCountry(countryCode) {
  const cc = String(countryCode || "").trim().toUpperCase();
  const fromMap = COUNTRY_TIMEZONES[cc];
  if (fromMap) return fromMap;
  const preset = getCountryPreset(cc);
  return canonicalizeTimezone(preset?.timezone) || LEGACY_FALLBACK_TZ;
}

/**
 * @param {object} [params]
 * @param {object} [params.order]
 * @param {object} [params.company]
 * @param {object} [params.city]
 * @param {string} [params.countryCode]
 * @param {object} [params.platformSettings]
 * @param {boolean} [params.forNewOrder]
 * @returns {string} IANA timezone
 */
export function resolveBusinessTimezone({
  order,
  company,
  city,
  countryCode,
  platformSettings,
  forNewOrder = false,
} = {}) {
  const fromOrder = canonicalizeTimezone(order?.timezone);
  if (fromOrder) return fromOrder;

  const looksLikePersistedOrder = Boolean(
    order && (order._id || order.id || order.orderNumber)
  );
  if (looksLikePersistedOrder && !forNewOrder) {
    return LEGACY_FALLBACK_TZ;
  }

  const fromCompany = canonicalizeTimezone(company?.timezone);
  if (fromCompany) return fromCompany;

  const fromCity = canonicalizeTimezone(city?.timezone);
  if (fromCity) return fromCity;

  const fromPlatform = canonicalizeTimezone(
    platformSettings?.defaultTimezone || platformSettings?.timezone
  );
  if (fromPlatform) return fromPlatform;

  const cc = String(countryCode || company?.country || city?.country || "")
    .trim()
    .toUpperCase();
  if (cc) return timezoneForCountry(cc);

  return LEGACY_FALLBACK_TZ;
}

export function isKnownRentalTimezone(value) {
  const tz = canonicalizeTimezone(value);
  return Boolean(tz && (KNOWN_TZ.has(tz) || tz.startsWith("Europe/") || tz.startsWith("Atlantic/")));
}
