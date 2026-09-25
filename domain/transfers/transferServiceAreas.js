/**
 * Transfer pickup / dropoff points offered to the public, for one market.
 *
 * Both collections are queried with the market country in the filter and the
 * result is checked again in memory, so legacy rows from another market stay
 * in the database but never reach a customer. When a market has no configured
 * areas the answer is an empty list — never another market's list.
 */

import PlatformCity from "@models/platformCity";
import TransferZone from "@models/TransferZone";
import { foldCityText } from "@/domain/geo/cityLookupOptions";
import { normalizeMarketCountry } from "@/domain/platform/marketCountry";
import {
  curatedTransferLocationsForMarket,
  isTransferLocationAllowedInMarket,
} from "@/domain/transfers/marketTransferLocations";

async function findScopedNames(model, market) {
  const rows = await model
    .find({ country: market, isActive: { $ne: false } })
    .select("name country")
    .lean();
  return (rows || [])
    .filter((row) => normalizeMarketCountry(row?.country) === market)
    .map((row) => String(row?.name || "").trim())
    .filter(Boolean);
}

/**
 * Service-area names configured for this market (transfer zones + platform cities).
 * @param {string} marketCountry
 * @returns {Promise<string[]>}
 */
export async function loadTransferServiceAreaNames(marketCountry) {
  const market = normalizeMarketCountry(marketCountry);
  if (!market) return [];
  const [zoneNames, cityNames] = await Promise.all([
    findScopedNames(TransferZone, market),
    findScopedNames(PlatformCity, market),
  ]);
  return [...zoneNames, ...cityNames];
}

/**
 * Everything the public transfer form may offer in this market.
 * @param {string} marketCountry
 * @returns {Promise<{ name: string, distanceKm?: number }[]>}
 */
export async function listTransferLocationsForMarket(marketCountry) {
  const market = normalizeMarketCountry(marketCountry);
  if (!market) return [];

  let serviceAreaNames = [];
  try {
    serviceAreaNames = await loadTransferServiceAreaNames(market);
  } catch (error) {
    // A catalog read failure must not widen the market, only narrow it.
    console.error(
      "[transfer locations] service areas unavailable",
      error?.message || error
    );
  }

  const byKey = new Map();
  for (const point of [
    ...curatedTransferLocationsForMarket(market),
    ...serviceAreaNames.map((name) => ({ name })),
  ]) {
    const key = foldCityText(point.name);
    if (!key || byKey.has(key)) continue;
    if (!isTransferLocationAllowedInMarket(point.name, market)) continue;
    byKey.set(key, point);
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}
