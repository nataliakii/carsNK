import { haversineKm, parseLatLon } from "@/domain/geo/haversineKm";
import {
  computeRuleDeliveryPrice,
  hasActiveDeliveryPricing,
} from "@/domain/delivery/deliveryPricingPolicy";
import { getDistanceFromBase } from "@/domain/transfers/getTransferDistance";

/** Default city radius (km) when company has no deliveryPricing.radiusKm / orderRadiusKm. */
export const DEFAULT_CITY_RADIUS_KM = 25;

export function resolveCityRadiusKm(company) {
  const fromPolicy = Number(company?.deliveryPricing?.radiusKm);
  if (Number.isFinite(fromPolicy) && fromPolicy > 0) return fromPolicy;
  const fromOrder = Number(company?.orderRadiusKm);
  if (Number.isFinite(fromOrder) && fromOrder > 0) {
    // Cap display "city" check so huge service areas still flag far hotels
    return Math.min(fromOrder, 40);
  }
  return DEFAULT_CITY_RADIUS_KM;
}

/**
 * @param {{ lat: number, lon: number }} addressCoords
 * @param {{ lat?: string|number, lon?: string|number, lng?: string|number }|null} cityCoords
 * @param {number} cityRadiusKm
 */
export function evaluateOutsideCity(addressCoords, cityCoords, cityRadiusKm) {
  const city = parseLatLon(cityCoords);
  const addr = parseLatLon(addressCoords);
  if (!city || !addr) {
    return {
      outsideCity: null,
      distanceFromCityKm: null,
      cityRadiusKm: Number(cityRadiusKm) || DEFAULT_CITY_RADIUS_KM,
    };
  }
  const distanceFromCityKm = haversineKm(addr, city);
  const radius = Number(cityRadiusKm);
  const r = Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_CITY_RADIUS_KM;
  return {
    outsideCity: distanceFromCityKm != null ? distanceFromCityKm > r : null,
    distanceFromCityKm,
    cityRadiusKm: r,
  };
}

/**
 * Estimate one-way delivery fee from company base to lat/lon.
 */
export async function estimateDeliveryFeeFromCoords({
  company,
  lat,
  lon,
  addressLabel,
}) {
  const base = parseLatLon(company?.coords);
  const point = parseLatLon({ lat, lon });
  if (!base || !point) {
    return { deliveryFee: null, distanceFromBaseKm: null, approximate: true };
  }

  let distanceFromBaseKm = null;
  let approximate = true;

  const label =
    String(addressLabel || "").trim() || `${lat},${lon}`;
  try {
    const google = await getDistanceFromBase({
      baseCoords: base,
      place: label,
    });
    if (google?.ok && Number.isFinite(Number(google.distanceKm))) {
      distanceFromBaseKm = Number(google.distanceKm);
      approximate = Boolean(google.approximate);
    }
  } catch {
    /* fall through to haversine */
  }

  if (distanceFromBaseKm == null) {
    distanceFromBaseKm = haversineKm(base, point);
    approximate = true;
  }

  if (distanceFromBaseKm == null || !Number.isFinite(distanceFromBaseKm)) {
    return { deliveryFee: null, distanceFromBaseKm: null, approximate: true };
  }

  const policy = company?.deliveryPricing || null;
  const perKm =
    company?.deliveryPricePerKm != null &&
    Number.isFinite(Number(company.deliveryPricePerKm))
      ? Number(company.deliveryPricePerKm)
      : 1;

  if (hasActiveDeliveryPricing(policy)) {
    const ruled = computeRuleDeliveryPrice({
      distanceKm: distanceFromBaseKm,
      policy,
      matchedOutsideZone: null,
      isAfterHours: false,
      computeZonePrice: () => 0,
    });
    if (ruled.blocked) {
      return {
        deliveryFee: null,
        distanceFromBaseKm,
        approximate,
        blocked: true,
      };
    }
    return {
      deliveryFee: Math.round(ruled.price * 100) / 100,
      distanceFromBaseKm,
      approximate,
      blocked: false,
    };
  }

  const deliveryFee = Math.round(distanceFromBaseKm * perKm * 100) / 100;
  return {
    deliveryFee,
    distanceFromBaseKm,
    approximate,
    blocked: false,
  };
}
