import { DeliveryZone } from "@models/DeliveryZone";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import {
  applyCarOfficeFreeDelivery,
  isPlaceMatchingCarOffice,
  resolveBookingDisplayOffices,
} from "@/domain/orders/carOffices";
import { computeZoneDeliveryPrice } from "./deliveryPriceFormula";
import { resolveDeliveryZoneName } from "./resolveDeliveryZoneName";
import {
  computeRuleDeliveryPrice,
  hasActiveRadiusDeliveryPricing,
  isAfterWorkingHours,
} from "./deliveryPricingPolicy";
import {
  computeCityStrategyLegPrice,
  resolveDeliveryStrategy,
  resolveNearestOfficePoint,
} from "./cityDeliveryPricing";
import { getDistanceFromBase } from "@/domain/transfers/getTransferDistance";
import { parseLatLon } from "@/domain/geo/haversineKm";
import { getSiteCountryCode } from "@config/siteCountry";

function calculateZonePrice(zone, pricePerKm) {
  if (!zone) return { price: 0, zone: null, distanceKm: 0 };
  const price = computeZoneDeliveryPrice(zone, pricePerKm);
  return { price, zone, distanceKm: zone.distanceKm };
}

function escapeRegex(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOwnerZoneFilter(ownerId) {
  const id = ownerId ? String(ownerId) : String(COMPANY_ID);
  if (id === String(COMPANY_ID)) {
    return {
      $or: [{ ownerId: id }, { ownerId: null }, { ownerId: { $exists: false } }],
    };
  }
  return { ownerId: id };
}

async function resolveDrivingDistanceKm({ company, carOffices, lat, lon, addressLabel }) {
  const point = parseLatLon({ lat, lon });
  if (!point) return { distanceKm: null, approximate: true };

  const nearest = resolveNearestOfficePoint({
    addressCoords: point,
    carOffices,
    company,
  });
  if (!nearest) return { distanceKm: null, approximate: true };

  try {
    const google = await getDistanceFromBase({
      baseCoords: nearest,
      place: String(addressLabel || "").trim() || `${lat},${lon}`,
    });
    if (google?.ok && Number.isFinite(Number(google.distanceKm))) {
      return {
        distanceKm: Number(google.distanceKm),
        approximate: Boolean(google.approximate),
      };
    }
  } catch {
    /* haversine fallback below */
  }

  const { haversineKm } = await import("@/domain/geo/haversineKm");
  return {
    distanceKm: haversineKm(point, nearest),
    approximate: true,
  };
}

/**
 * Calculate full delivery pricing for an order.
 *
 * @param {Object} params
 * @param {string} params.placeIn
 * @param {string} params.placeOut
 * @param {string} [params.companyId]
 * @param {string|Date} [params.timeIn]
 * @param {string|Date} [params.timeOut]
 * @param {string[]|object[]} [params.carOffices]
 * @param {string} [params.placeInDetail]
 * @param {string} [params.placeOutDetail]
 * @param {number} [params.placeInLat]
 * @param {number} [params.placeInLon]
 * @param {number} [params.placeOutLat]
 * @param {number} [params.placeOutLon]
 * @param {string} [params.placeInLocality]
 * @param {string} [params.placeOutLocality]
 */
export async function calculateDeliveryPrice({
  placeIn,
  placeOut,
  companyId,
  timeIn,
  timeOut,
  carOffices,
  placeInDetail,
  placeOutDetail,
  placeInLat,
  placeInLon,
  placeOutLat,
  placeOutLon,
  placeInLocality,
  placeOutLocality,
}) {
  const resolvedCompanyId = companyId
    ? String(companyId)
    : String(COMPANY_ID);

  const company = await Company.findById(resolvedCompanyId).lean();
  const pricePerKm =
    company?.deliveryPricePerKm != null &&
    !Number.isNaN(Number(company.deliveryPricePerKm))
      ? Number(company.deliveryPricePerKm)
      : 1;

  const policy = company?.deliveryPricing || null;
  const strategy = resolveDeliveryStrategy(policy);
  const useRadiusRules = hasActiveRadiusDeliveryPricing(policy);

  const displayOffices = resolveBookingDisplayOffices(
    { offices: carOffices },
    company,
    { countryCode: getSiteCountryCode(), selectedCity: placeIn }
  );
  // Office pickup/return → free (handled at end too, but short-circuit cities/radius)
  const officeIn = isPlaceMatchingCarOffice(placeIn, displayOffices);
  const officeOut = isPlaceMatchingCarOffice(placeOut, displayOffices);

  if (strategy === "cities" && policy) {
    const priceCityLeg = async (place, detail, lat, lon, locality, isOffice) => {
      if (isOffice) {
        return {
          price: 0,
          blocked: false,
          distanceKm: 0,
          chargeableKm: 0,
          region: "office",
          perKmRate: pricePerKm,
        };
      }
      let distanceFromOfficeKm = null;
      if (lat != null && lon != null) {
        const dist = await resolveDrivingDistanceKm({
          company,
          carOffices,
          lat,
          lon,
          addressLabel: detail || place,
        });
        distanceFromOfficeKm = dist.distanceKm;
      }
      const leg = computeCityStrategyLegPrice({
        policy,
        placeName: place,
        address: detail,
        locality,
        addressCoords:
          lat != null && lon != null ? { lat: Number(lat), lon: Number(lon) } : null,
        distanceFromOfficeKm,
        carOffices,
        company,
        fallbackPerKm: pricePerKm,
      });
      return leg;
    };

    const inResult = await priceCityLeg(
      placeIn,
      placeInDetail,
      placeInLat,
      placeInLon,
      placeInLocality,
      officeIn
    );
    const outResult = await priceCityLeg(
      placeOut,
      placeOutDetail,
      placeOutLat,
      placeOutLon,
      placeOutLocality,
      officeOut
    );

    return {
      deliveryIn: inResult.price,
      deliveryOut: outResult.price,
      deliveryTotal: inResult.price + outResult.price,
      deliveryPricePerKm: pricePerKm,
      deliveryBlockedIn: Boolean(inResult.blocked),
      deliveryBlockedOut: Boolean(outResult.blocked),
      placeIn: placeIn || "",
      placeOut: placeOut || "",
      resolvedPlaceIn: resolveDeliveryZoneName(placeIn),
      resolvedPlaceOut: resolveDeliveryZoneName(placeOut),
      companyId: resolvedCompanyId,
      strategy: "cities",
      pickupMeta: inResult,
      returnMeta: outResult,
      officeFreeIn: officeIn,
      officeFreeOut: officeOut,
    };
  }

  const resolvedIn = resolveDeliveryZoneName(placeIn);
  const resolvedOut = resolveDeliveryZoneName(placeOut);
  const zoneNames = [...new Set([resolvedIn, resolvedOut].filter(Boolean))];

  const zones =
    zoneNames.length > 0
      ? await DeliveryZone.find({
          ...buildOwnerZoneFilter(resolvedCompanyId),
          name: {
            $in: zoneNames.map((n) => new RegExp(`^${escapeRegex(n)}$`, "i")),
          },
          isActive: true,
        }).lean()
      : [];

  const zoneMap = {};
  for (const z of zones) {
    zoneMap[String(z.name).toLowerCase()] = z;
  }

  const inZone = resolvedIn ? zoneMap[resolvedIn.toLowerCase()] || null : null;
  const outZone = resolvedOut
    ? zoneMap[resolvedOut.toLowerCase()] || null
    : null;

  const afterIn = isAfterWorkingHours(timeIn, company?.workingHours);
  const afterOut = isAfterWorkingHours(timeOut, company?.workingHours);

  const priceSide = (zone, afterHours) => {
    if (useRadiusRules) {
      const distanceKm =
        zone?.distanceKm != null && Number.isFinite(Number(zone.distanceKm))
          ? Number(zone.distanceKm)
          : null;

      if (zone) {
        const ruled = computeRuleDeliveryPrice({
          distanceKm: distanceKm ?? 0,
          policy,
          matchedOutsideZone: zone,
          isAfterHours: afterHours,
          computeZonePrice: (z) => computeZoneDeliveryPrice(z, pricePerKm),
        });
        return {
          price: ruled.blocked ? 0 : ruled.price,
          blocked: ruled.blocked,
          distanceKm: distanceKm ?? 0,
          region: ruled.region,
          zone,
        };
      }

      if (distanceKm == null) {
        return { price: 0, blocked: false, distanceKm: 0, region: null, zone: null };
      }

      const ruled = computeRuleDeliveryPrice({
        distanceKm,
        policy,
        matchedOutsideZone: null,
        isAfterHours: afterHours,
        computeZonePrice: (z) => computeZoneDeliveryPrice(z, pricePerKm),
      });
      return {
        price: ruled.blocked ? 0 : ruled.price,
        blocked: ruled.blocked,
        distanceKm,
        region: ruled.region,
        zone: null,
      };
    }

    const legacy = calculateZonePrice(zone, pricePerKm);
    return {
      price: legacy.price,
      blocked: false,
      distanceKm: legacy.distanceKm,
      region: zone ? "zone" : null,
      zone,
    };
  };

  const inResult = priceSide(inZone, afterIn);
  const outResult = priceSide(outZone, afterOut);

  const base = {
    deliveryIn: inResult.price,
    deliveryOut: outResult.price,
    deliveryTotal: inResult.price + outResult.price,
    deliveryPricePerKm: pricePerKm,
    deliveryBlockedIn: Boolean(inResult.blocked),
    deliveryBlockedOut: Boolean(outResult.blocked),
    placeIn: placeIn || "",
    placeOut: placeOut || "",
    resolvedPlaceIn: resolvedIn,
    resolvedPlaceOut: resolvedOut,
    companyId: resolvedCompanyId,
    strategy,
  };

  return applyCarOfficeFreeDelivery(base, displayOffices);
}
