/**
 * Transfer pickup / dropoff points, per market.
 *
 * There is deliberately no combined list and no default market: a market with
 * no catalog resolves to an empty array so the form can say "unavailable"
 * instead of borrowing another country's places.
 *
 * `data/delivery-locations.json` is the legacy Halkidiki / Thessaloniki catalog
 * from the Greek rental business. It carries no country column, so it is
 * registered here as the GR catalog and is never read for another market.
 */

import legacyGreekTransferPoints from "@/data/delivery-locations.json";
import { foldCityText } from "@/domain/geo/cityLookupOptions";
import { ORDERED_LOCATION_OPTIONS } from "@/domain/orders/locationOptions";
import { SPAIN_CITY_OPTIONS } from "@/domain/orders/spainCityOptions";
import {
  MARKET_COUNTRY_CODES,
  normalizeMarketCountry,
} from "@/domain/platform/marketCountry";

export const OUT_OF_MARKET_CODE = "out_of_market";

/** Labels too generic to identify a market on their own. */
const MARKET_NEUTRAL_KEYS = new Set(["airport", "port", "city centre", "city center"]);

function toPoint(row) {
  const name = String(row?.name ?? row ?? "").trim();
  if (!name) return null;
  const km = Number(row?.distanceKm);
  return {
    name,
    distanceKm: Number.isFinite(km) ? km : undefined,
  };
}

function dedupeByName(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const point = toPoint(row);
    if (!point) continue;
    const key = foldCityText(point.name);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, point);
  }
  return [...byKey.values()];
}

const CURATED_POINTS_BY_MARKET = {
  GR: dedupeByName(legacyGreekTransferPoints),
  ES: dedupeByName(SPAIN_CITY_OPTIONS),
};

/**
 * Names that identify a market, used to reject out-of-market submissions.
 * Wider than the curated catalog: the booking location lists name the same
 * places with different spellings.
 */
const MARKET_NAMES = {
  GR: [
    ...legacyGreekTransferPoints.map((row) => row?.name),
    ...ORDERED_LOCATION_OPTIONS,
  ],
  ES: [...SPAIN_CITY_OPTIONS],
};

const MARKET_KEYS = Object.fromEntries(
  MARKET_COUNTRY_CODES.map((code) => [
    code,
    new Set(
      (MARKET_NAMES[code] || [])
        .map((name) => foldCityText(name))
        .filter((key) => key && !MARKET_NEUTRAL_KEYS.has(key))
    ),
  ])
);

function mentionsName(text, name) {
  const needle = foldCityText(name);
  if (!needle) return false;
  const hay = foldCityText(String(text || "").replace(/[,./]/g, " "));
  if (!hay) return false;
  if (hay === needle) return true;
  return ` ${hay} `.includes(` ${needle} `);
}

/**
 * Market a place name belongs to, or "" when the name is generic, unknown
 * (a street address or hotel) or claimed by more than one market.
 *
 * @param {string} name
 * @returns {string}
 */
export function transferLocationMarketCountry(name) {
  const key = foldCityText(name);
  if (!key || MARKET_NEUTRAL_KEYS.has(key)) return "";

  const exact = MARKET_COUNTRY_CODES.filter((code) => MARKET_KEYS[code].has(key));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return "";

  const mentioned = MARKET_COUNTRY_CODES.filter((code) =>
    [...MARKET_KEYS[code]].some((label) => mentionsName(key, label))
  );
  return mentioned.length === 1 ? mentioned[0] : "";
}

/** A place is allowed when it belongs to this market or to no known market. */
export function isTransferLocationAllowedInMarket(name, marketCountry) {
  const market = normalizeMarketCountry(marketCountry);
  if (!market) return false;
  const owner = transferLocationMarketCountry(name);
  return !owner || owner === market;
}

/**
 * Curated points for one market. Unknown markets get an empty list — this
 * function never falls back to another market's catalog.
 *
 * @param {string} marketCountry
 * @returns {{ name: string, distanceKm?: number }[]}
 */
export function curatedTransferLocationsForMarket(marketCountry) {
  const market = normalizeMarketCountry(marketCountry);
  if (!market) return [];
  return (CURATED_POINTS_BY_MARKET[market] || [])
    .filter((point) => isTransferLocationAllowedInMarket(point.name, market))
    .map((point) => ({ ...point }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** Curated distance-from-base (km) for a place, within one market only. */
export function curatedDistanceKmForMarket(placeName, marketCountry) {
  const key = foldCityText(placeName);
  if (!key) return null;
  const points = curatedTransferLocationsForMarket(marketCountry);
  let soft = null;
  for (const point of points) {
    if (point.distanceKm == null) continue;
    const name = foldCityText(point.name);
    if (!name) continue;
    if (name === key) return point.distanceKm;
    if (soft == null && (key.includes(name) || name.includes(key))) {
      soft = point.distanceKm;
    }
  }
  return soft;
}

export function outOfMarketMessage(name, marketCountry) {
  const market = normalizeMarketCountry(marketCountry) || "this market";
  const label = String(name || "").trim();
  return label
    ? `"${label}" is not served in ${market}.`
    : `That location is not served in ${market}.`;
}

/**
 * Reject a submitted transfer whose places belong to another market.
 *
 * @param {{ from?: string, to?: string, origin?: object, destination?: object }} payload
 * @param {string} marketCountry
 * @returns {{ ok: true } | { ok: false, code: string, message: string, field: string }}
 */
export function assertTransferPlacesInMarket(payload = {}, marketCountry) {
  const market = normalizeMarketCountry(marketCountry);
  if (!market) {
    return {
      ok: false,
      code: OUT_OF_MARKET_CODE,
      field: "market",
      message: "Transfers are not available here yet.",
    };
  }

  const candidates = [
    ["from", payload.from],
    ["to", payload.to],
    ["origin.placeName", payload.origin?.placeName],
    ["origin.city", payload.origin?.city],
    ["destination.placeName", payload.destination?.placeName],
    ["destination.city", payload.destination?.city],
    ...(Array.isArray(payload.additionalStops)
      ? payload.additionalStops
      : []
    ).flatMap((stop, index) => [
      [`additionalStops.${index}`, stop?.placeName || stop?.name || stop],
      [`additionalStops.${index}.location`, stop?.location?.placeName],
      [`additionalStops.${index}.location.city`, stop?.location?.city],
    ]),
  ];

  for (const [field, value] of candidates) {
    const label = String(value || "").trim();
    if (!label) continue;
    if (!isTransferLocationAllowedInMarket(label, market)) {
      return {
        ok: false,
        code: OUT_OF_MARKET_CODE,
        field,
        message: outOfMarketMessage(label, market),
      };
    }
  }

  return { ok: true };
}
