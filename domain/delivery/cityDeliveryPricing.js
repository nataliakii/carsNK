/**
 * City-list delivery pricing: free (or flat) inside operating cities,
 * €/km from nearest office when the address is outside those cities.
 *
 * Complements radius-split (deliveryPricing.radiusKm) and legacy DeliveryZones.
 */

import { haversineKm, parseLatLon } from "@/domain/geo/haversineKm";
import {
  normalizeOfficeKey,
  normalizeCarOffices,
  enrichOfficeWithCompany,
} from "@/domain/orders/carOffices";

export const DELIVERY_STRATEGIES = ["zones", "radius", "cities"];

/**
 * @param {object|null|undefined} policy — company.deliveryPricing
 * @returns {"zones"|"radius"|"cities"}
 */
export function resolveDeliveryStrategy(policy) {
  const explicit = String(policy?.strategy || "")
    .trim()
    .toLowerCase();
  if (DELIVERY_STRATEGIES.includes(explicit)) return explicit;

  const cities = normalizeOperatingCities(policy?.operatingCities);
  if (cities.length > 0) return "cities";

  const r = Number(policy?.radiusKm);
  if (Number.isFinite(r) && r >= 0) return "radius";

  return "zones";
}

export function normalizeOperatingCities(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const name =
      typeof item === "string"
        ? item.trim()
        : String(item?.name || item?.label || "").trim();
    if (!name) continue;
    const key = normalizeOfficeKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function isCityInOperatingList(cityName, operatingCities) {
  const key = normalizeOfficeKey(cityName);
  if (!key) return false;
  return normalizeOperatingCities(operatingCities).some(
    (c) => normalizeOfficeKey(c) === key
  );
}

/**
 * True when Google address text / locality tokens match an operating city.
 */
export function addressMatchesOperatingCity({
  address,
  locality,
  placeCity,
  operatingCities,
}) {
  const cities = normalizeOperatingCities(operatingCities);
  if (!cities.length) return false;

  const tokens = [
    locality,
    placeCity,
    address,
  ]
    .map((v) => normalizeOfficeKey(v))
    .filter(Boolean);

  for (const city of cities) {
    const cityKey = normalizeOfficeKey(city);
    for (const token of tokens) {
      if (!token) continue;
      if (token === cityKey) return true;
      if (token.includes(cityKey) || cityKey.includes(token)) return true;
    }
  }
  return false;
}

function applyInsideOutsideTier(mode, amount, chargeableKm) {
  if (mode === "free") return { price: 0, blocked: false };
  if (mode === "blocked") return { price: 0, blocked: true };
  if (mode === "fixed") {
    const a = Number(amount);
    return {
      price: Number.isFinite(a) && a >= 0 ? a : 0,
      blocked: false,
    };
  }
  const perKm = Number(amount);
  const km = Number(chargeableKm);
  if (!Number.isFinite(perKm) || perKm < 0 || !Number.isFinite(km) || km <= 0) {
    return { price: 0, blocked: false };
  }
  return { price: Math.round(km * perKm * 100) / 100, blocked: false };
}

/**
 * Nearest office / company base for distance billing.
 * @returns {{ lat: number, lon: number, label: string }|null}
 */
export function resolveNearestOfficePoint({
  addressCoords,
  carOffices,
  company,
}) {
  const addr = parseLatLon(addressCoords);
  const offices = [
    ...normalizeCarOffices(carOffices),
    ...normalizeCarOffices(company?.offices),
  ].map((o) => enrichOfficeWithCompany(o, company));

  const candidates = [];
  for (const o of offices) {
    const p = parseLatLon(o);
    if (p) {
      candidates.push({
        ...p,
        label: o.address || o.name || "Office",
      });
    }
  }
  const companyBase = parseLatLon(company?.coords);
  if (companyBase) {
    candidates.push({
      ...companyBase,
      label: String(company?.address || company?.name || "Office").trim(),
    });
  }
  if (!candidates.length) return null;
  if (!addr) return candidates[0];

  let best = candidates[0];
  let bestKm = haversineKm(addr, best);
  for (let i = 1; i < candidates.length; i++) {
    const km = haversineKm(addr, candidates[i]);
    if (km != null && (bestKm == null || km < bestKm)) {
      best = candidates[i];
      bestKm = km;
    }
  }
  return best;
}

/**
 * Price one delivery leg under cities strategy.
 *
 * @param {object} params
 * @param {object} params.policy
 * @param {string} [params.placeName] — selected city/place
 * @param {string} [params.address]
 * @param {string} [params.locality] — from Google address_components
 * @param {{lat,lon}|null} [params.addressCoords]
 * @param {number|null} [params.distanceFromOfficeKm] — driving distance if known
 * @param {unknown} [params.carOffices]
 * @param {object|null} [params.company]
 * @param {number} [params.fallbackPerKm]
 */
export function computeCityStrategyLegPrice({
  policy,
  placeName,
  address,
  locality,
  addressCoords,
  distanceFromOfficeKm,
  carOffices,
  company,
  fallbackPerKm = 1,
} = {}) {
  const operatingCities = normalizeOperatingCities(policy?.operatingCities);
  const insideMode = policy?.inside?.mode || "free";
  const insideAmount = Number(policy?.inside?.amount) || 0;
  const outsideMode = policy?.outside?.mode || "perKm";
  const outsideAmount =
    policy?.outside?.amount != null &&
    Number.isFinite(Number(policy.outside.amount))
      ? Number(policy.outside.amount)
      : Number(fallbackPerKm) || 1;

  const freeRadiusKm =
    policy?.radiusKm != null && policy.radiusKm !== ""
      ? Number(policy.radiusKm)
      : null;
  const maxDistanceKm =
    policy?.maxDistanceKm != null && policy.maxDistanceKm !== ""
      ? Number(policy.maxDistanceKm)
      : null;

  const hasStreetAddress = Boolean(String(address || "").trim());
  const hasLocality = Boolean(String(locality || "").trim());

  // Prefer Google locality / full address when the user entered a street.
  // Selected dropdown city alone only counts when there is no street detail.
  const insideByGeo =
    hasStreetAddress || hasLocality
      ? addressMatchesOperatingCity({
          address,
          locality,
          placeCity: "",
          operatingCities,
        })
      : false;

  const cityOnlyInside =
    !hasStreetAddress &&
    isCityInOperatingList(placeName, operatingCities);

  if (insideByGeo || cityOnlyInside) {
    const tier = applyInsideOutsideTier(insideMode, insideAmount, 0);
    return {
      ...tier,
      region: "inside_city",
      distanceKm: 0,
      chargeableKm: 0,
      matchedCity: locality || placeName || "",
      perKmRate: outsideAmount,
    };
  }

  let distanceKm =
    distanceFromOfficeKm != null && Number.isFinite(Number(distanceFromOfficeKm))
      ? Number(distanceFromOfficeKm)
      : null;

  if (distanceKm == null && addressCoords) {
    const nearest = resolveNearestOfficePoint({
      addressCoords,
      carOffices,
      company,
    });
    if (nearest) {
      distanceKm = haversineKm(addressCoords, nearest);
    }
  }

  if (distanceKm == null) {
    // Cannot measure — leave as 0 for quote; UI can say “confirmed with order”
    return {
      price: 0,
      blocked: false,
      region: "outside_city_unknown",
      distanceKm: null,
      chargeableKm: null,
      matchedCity: "",
      perKmRate: outsideAmount,
      approximate: true,
    };
  }

  if (
    maxDistanceKm != null &&
    Number.isFinite(maxDistanceKm) &&
    distanceKm > maxDistanceKm
  ) {
    return {
      price: 0,
      blocked: true,
      region: "beyond_max",
      distanceKm,
      chargeableKm: 0,
      matchedCity: "",
      perKmRate: outsideAmount,
    };
  }

  let chargeableKm = distanceKm;
  if (freeRadiusKm != null && Number.isFinite(freeRadiusKm) && freeRadiusKm >= 0) {
    chargeableKm = Math.max(0, Math.round((distanceKm - freeRadiusKm) * 100) / 100);
  }

  if (chargeableKm <= 0) {
    return {
      price: 0,
      blocked: false,
      region: "outside_city_within_free_radius",
      distanceKm,
      chargeableKm: 0,
      matchedCity: "",
      perKmRate: outsideAmount,
    };
  }

  const tier = applyInsideOutsideTier(outsideMode, outsideAmount, chargeableKm);
  return {
    ...tier,
    region: "outside_city",
    distanceKm,
    chargeableKm,
    matchedCity: "",
    perKmRate: outsideAmount,
  };
}

/**
 * Human-readable public summary of the active rule (for car card).
 */
export function buildDeliveryRuleSummary(company, { t } = {}) {
  const policy = company?.deliveryPricing || null;
  const strategy = resolveDeliveryStrategy(policy);
  const perKm =
    policy?.outside?.amount != null
      ? Number(policy.outside.amount)
      : Number(company?.deliveryPricePerKm) || 1;
  const cities = normalizeOperatingCities(policy?.operatingCities);
  const insideFree =
    !policy?.inside?.mode || policy.inside.mode === "free";
  const insideFixed =
    policy?.inside?.mode === "fixed" ? Number(policy.inside.amount) || 0 : null;
  const radiusKm =
    policy?.radiusKm != null && policy.radiusKm !== ""
      ? Number(policy.radiusKm)
      : null;

  return {
    strategy,
    operatingCities: cities,
    perKm: Number.isFinite(perKm) ? perKm : 1,
    insideFree,
    insideFixed,
    freeRadiusKm:
      radiusKm != null && Number.isFinite(radiusKm) ? radiusKm : null,
    maxDistanceKm:
      policy?.maxDistanceKm != null && Number.isFinite(Number(policy.maxDistanceKm))
        ? Number(policy.maxDistanceKm)
        : null,
    translate: t,
  };
}
