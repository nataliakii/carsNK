import { COUNTRY_CODES, getSiteCountryCode } from "@config/siteCountry";
import { omitUntrustedTransferMetrics } from "@/domain/transfers/createTransferOrder";

export const QUOTE_MAX_PLACE_LEN = 200;
export const QUOTE_MAX_CITY_LEN = 100;
export const QUOTE_MAX_STOPS = 8;
export const QUOTE_TIMEOUT_MS = Number(
  process.env.TRANSFER_QUOTE_TIMEOUT_MS || 10000
);

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function hasExplicitCoord(value) {
  return value !== null && value !== undefined && value !== "";
}

function parseFiniteCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reject missing/non-finite/out-of-range coordinates. Omitted coords are allowed
 * (place-name quotes).
 */
export function assertValidCoordinates(latRaw, lngRaw, label) {
  const latPresent = hasExplicitCoord(latRaw);
  const lngPresent = hasExplicitCoord(lngRaw);
  if (!latPresent && !lngPresent) return { ok: true, lat: null, lng: null };
  if (latPresent !== lngPresent) {
    return { ok: false, message: `${label} coordinates are incomplete` };
  }
  const lat = parseFiniteCoord(latRaw);
  const lng = parseFiniteCoord(lngRaw);
  if (lat == null || lng == null) {
    return { ok: false, message: `${label} coordinates are invalid` };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, message: `${label} coordinates are out of range` };
  }
  return { ok: true, lat, lng };
}

function allowedCountry(raw) {
  const code = String(raw || "")
    .trim()
    .toUpperCase();
  if (!code) return getSiteCountryCode();
  if (!COUNTRY_CODES.includes(code)) return null;
  return code;
}

/**
 * Validate and normalise a public transfer-quote body.
 * Drops client distance/price. Does not call Google.
 */
export function validatePublicQuoteRequest(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Invalid JSON" };
  }

  const payload = omitUntrustedTransferMetrics(raw);
  const from = clip(payload.from || payload.origin?.placeName, QUOTE_MAX_PLACE_LEN);
  const to = clip(payload.to || payload.destination?.placeName, QUOTE_MAX_PLACE_LEN);
  if (!from || !to) {
    return { ok: false, message: "from and to are required" };
  }
  if (
    String(payload.from || payload.origin?.placeName || "").trim().length >
      QUOTE_MAX_PLACE_LEN ||
    String(payload.to || payload.destination?.placeName || "").trim().length >
      QUOTE_MAX_PLACE_LEN
  ) {
    return { ok: false, message: "from/to exceed max length" };
  }

  const country = allowedCountry(
    payload.country || payload.origin?.country || payload.destination?.country
  );
  if (!country) {
    return { ok: false, message: "Unsupported country" };
  }

  const originCoords = assertValidCoordinates(
    payload.origin?.lat,
    payload.origin?.lng ?? payload.origin?.lon,
    "origin"
  );
  if (!originCoords.ok) return originCoords;
  const destCoords = assertValidCoordinates(
    payload.destination?.lat,
    payload.destination?.lng ?? payload.destination?.lon,
    "destination"
  );
  if (!destCoords.ok) return destCoords;

  const originCountry = payload.origin?.country
    ? allowedCountry(payload.origin.country)
    : country;
  const destCountry = payload.destination?.country
    ? allowedCountry(payload.destination.country)
    : country;
  if (!originCountry || !destCountry) {
    return { ok: false, message: "Unsupported country" };
  }

  if (Array.isArray(payload.additionalStops) && payload.additionalStops.length > QUOTE_MAX_STOPS) {
    return { ok: false, message: "Too many additional stops" };
  }

  const adults = Math.min(
    20,
    Math.max(1, Math.floor(Number(payload.adults ?? payload.passengers) || 1))
  );

  return {
    ok: true,
    payload: {
      ...payload,
      from,
      to,
      country,
      adults,
      origin: {
        ...(payload.origin || {}),
        placeName: payload.origin?.placeName
          ? clip(payload.origin.placeName, QUOTE_MAX_PLACE_LEN)
          : from,
        city: clip(payload.origin?.city, QUOTE_MAX_CITY_LEN),
        country: originCountry,
        lat: originCoords.lat,
        lng: originCoords.lng,
      },
      destination: {
        ...(payload.destination || {}),
        placeName: payload.destination?.placeName
          ? clip(payload.destination.placeName, QUOTE_MAX_PLACE_LEN)
          : to,
        city: clip(payload.destination?.city, QUOTE_MAX_CITY_LEN),
        country: destCountry,
        lat: destCoords.lat,
        lng: destCoords.lng,
      },
    },
  };
}
