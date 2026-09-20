/**
 * Flat (no-season) daily rate helpers.
 *
 * When company.useSeasons === false, pricing uses one daily rate from
 * pricingTiers.NoSeason (prefer day key "4", then "1", then any value),
 * and calculation ignores seasons + duration tiers.
 */

const PREFERRED_DAY_KEYS = ["4", "1", "7", "14"];
const ALL_SEASON_KEYS = [
  "NoSeason",
  "LowSeason",
  "LowUpSeason",
  "MiddleSeason",
  "HighSeason",
];
const SYNC_DAY_KEYS = ["4", "7", "14"];

function daysToObject(days) {
  if (!days || typeof days !== "object") return {};
  if (days instanceof Map) {
    const out = {};
    for (const [k, v] of days) {
      out[String(k)] = v;
    }
    return out;
  }
  return { ...days };
}

function toFinitePrice(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * @param {unknown} company
 * @returns {boolean} true when seasonal + duration-tier pricing applies
 */
export function companyUsesSeasons(company) {
  return company?.useSeasons !== false;
}

/**
 * Resolve the single daily rate from car.pricingTiers (Map or plain object).
 * @param {unknown} pricingTiers
 * @returns {number}
 */
export function getFlatDailyRateFromPricingTiers(pricingTiers) {
  if (pricingTiers == null) return 0;

  const tiers =
    pricingTiers instanceof Map
      ? Object.fromEntries(pricingTiers)
      : pricingTiers;

  const noSeason = tiers?.NoSeason;
  const daysRaw =
    noSeason?.days != null
      ? noSeason.days
      : noSeason instanceof Map
        ? noSeason.get?.("days")
        : null;
  const days = daysToObject(daysRaw);

  for (const key of PREFERRED_DAY_KEYS) {
    const price = toFinitePrice(days[key]);
    if (price != null) return price;
  }

  for (const value of Object.values(days)) {
    const price = toFinitePrice(value);
    if (price != null) return price;
  }

  return 0;
}

/**
 * Write one daily rate into NoSeason keys 4/7/14 and mirror to all seasons.
 * Keeps the stored shape compatible with seasonal cars.
 * @param {object} pricingTiers
 * @param {number} rate
 * @returns {object}
 */
export function applyFlatDailyRateToPricingTiers(pricingTiers, rate) {
  const n = toFinitePrice(rate) ?? 0;
  const pt =
    pricingTiers && typeof pricingTiers === "object" && !(pricingTiers instanceof Map)
      ? { ...pricingTiers }
      : pricingTiers instanceof Map
        ? Object.fromEntries(pricingTiers)
        : {};

  const days = {};
  for (const key of SYNC_DAY_KEYS) {
    days[key] = n;
  }

  for (const season of ALL_SEASON_KEYS) {
    pt[season] = { ...(pt[season] || {}), days: { ...days } };
  }
  return pt;
}

export { SYNC_DAY_KEYS, ALL_SEASON_KEYS };
