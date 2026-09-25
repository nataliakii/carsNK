import {
  normalizeMarketCountry,
  resolveMarketCountry,
} from "@/domain/platform/marketCountry";
import {
  assertTransferPlacesInMarket,
  OUT_OF_MARKET_CODE,
} from "@/domain/transfers/marketTransferLocations";
import {
  MAX_PUBLIC_ADDITIONAL_STOPS,
  pickPublicTransferPayload,
} from "@/domain/transfers/transferPayloadPolicy";

export const QUOTE_MAX_PLACE_LEN = 200;
export const QUOTE_MAX_CITY_LEN = 100;
export const QUOTE_MAX_STOPS = MAX_PUBLIC_ADDITIONAL_STOPS;
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

/** Only this deployment's market is quotable; anything else is refused. */
function allowedCountry(raw, marketCountry) {
  const code = String(raw || "").trim();
  if (!code) return marketCountry;
  return normalizeMarketCountry(code) === marketCountry ? marketCountry : null;
}

/**
 * Validate and normalise a public transfer-quote body.
 * Reduces the body to the public allow-list (so client distance, price and any
 * admin-only field are gone) and pins the request to one market.
 * Does not call Google.
 *
 * @param {object} raw
 * @param {{ marketCountry?: string }} [context]
 */
export function validatePublicQuoteRequest(raw = {}, context = {}) {
  const marketCountry =
    normalizeMarketCountry(context.marketCountry) || resolveMarketCountry();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Invalid JSON" };
  }

  const payload = pickPublicTransferPayload(raw);
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
    payload.country || payload.origin?.country || payload.destination?.country,
    marketCountry
  );
  if (!country) {
    return { ok: false, message: "Unsupported country" };
  }

  const placeCheck = assertTransferPlacesInMarket(
    { ...payload, from, to },
    marketCountry
  );
  if (!placeCheck.ok) {
    return {
      ok: false,
      code: OUT_OF_MARKET_CODE,
      message: placeCheck.message,
    };
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
    ? allowedCountry(payload.origin.country, marketCountry)
    : country;
  const destCountry = payload.destination?.country
    ? allowedCountry(payload.destination.country, marketCountry)
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
