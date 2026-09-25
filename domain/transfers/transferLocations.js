import {
  COUNTRY_CODES,
  getCountryPreset,
  getSiteCountryCode,
} from "@config/siteCountry";
import { resolveMarketCountry } from "@/domain/platform/marketCountry";
import {
  curatedDistanceKmForMarket,
  curatedTransferLocationsForMarket,
} from "@/domain/transfers/marketTransferLocations";

/**
 * Curated transfer points for one market. Never a global list: the market is
 * resolved from the deployment when the caller does not name one.
 *
 * @param {string} [marketCountry]
 * @returns {{ name: string, distanceKm?: number }[]}
 */
export function getTransferLocationOptions(marketCountry) {
  return curatedTransferLocationsForMarket(
    marketCountry || resolveMarketCountry()
  );
}

/**
 * Look up curated distance-from-base (km) for a place name, within one market.
 * @param {string} placeName
 * @param {string} [marketCountry]
 * @returns {number | null}
 */
export function getCuratedDistanceKm(placeName, marketCountry) {
  return curatedDistanceKmForMarket(
    placeName,
    marketCountry || resolveMarketCountry()
  );
}

/**
 * Rough A→B km from curated hub distances when Google Maps is unavailable.
 * Assumes distanceKm is from the same base (airport / Nea Kallikratia area),
 * so it only answers for markets that carry curated distances.
 *
 * @param {string} from
 * @param {string} to
 * @param {string} [marketCountry]
 */
export function estimateTransferDistanceFromCatalog(from, to, marketCountry) {
  const market = marketCountry || resolveMarketCountry();
  const dFrom = getCuratedDistanceKm(from, market);
  const dTo = getCuratedDistanceKm(to, market);
  if (dFrom == null || dTo == null) {
    return {
      ok: false,
      message: "No catalog estimate for these places",
    };
  }
  const distanceKm = Math.round(Math.abs(dFrom - dTo) * 10) / 10;
  const durationMinutes = Math.max(
    5,
    Math.round((Math.max(distanceKm, 1) / 55) * 60)
  );
  return {
    ok: true,
    distanceKm,
    durationMinutes,
    approximate: true,
  };
}

const KNOWN_COUNTRY_CODES = new Set(COUNTRY_CODES);

/**
 * Build a geocoding-friendly query for Google Distance Matrix.
 * Bias by explicit country (company / transfer), then site country.
 * Never force Spanish (or other non-GR) places into Halkidiki.
 *
 * @param {string} placeName
 * @param {string} [country] ISO country (ES|GR|…)
 */
export function toGooglePlaceQuery(placeName, country) {
  const name = String(placeName || "").trim();
  if (!name) return "";

  // Distance Matrix accepts "lat,lng" — do not append a country suffix.
  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(name)) {
    return name.replace(/\s+/g, "");
  }

  const code = String(country || getSiteCountryCode() || "")
    .trim()
    .toUpperCase();
  const lower = name.toLowerCase();

  // Already region-qualified — leave alone.
  if (
    /,\s*(spain|españa|greece|hellas|halkidiki|chalkidiki|catalonia|catalunya|andalucia|andalucía|portugal|france|italy|germany)\b/i.test(
      name
    )
  ) {
    return name;
  }

  if (code === "ES") {
    return `${name}, Spain`;
  }

  // Greece / Halkidiki shortcuts — only when country is explicitly GR.
  if (code === "GR") {
    if (lower.includes("airport") && /thessaloniki|skg/i.test(lower)) {
      return "Thessaloniki Airport SKG, Greece";
    }
    if (lower === "thessaloniki") {
      return "Thessaloniki, Greece";
    }
    if (lower === "halkidiki" || lower === "chalkidiki") {
      return "Chalkidiki, Greece";
    }
    return `${name}, Halkidiki, Greece`;
  }

  if (KNOWN_COUNTRY_CODES.has(code)) {
    return `${name}, ${getCountryPreset(code).countryName}`;
  }

  // Unknown country: never invent Halkidiki.
  return name;
}

export default getTransferLocationOptions;
