import { DeliveryZone } from "@models/DeliveryZone";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import { computeZoneDeliveryPrice } from "./deliveryPriceFormula";
import { resolveDeliveryZoneName } from "./resolveDeliveryZoneName";
import {
  computeRuleDeliveryPrice,
  hasActiveDeliveryPricing,
  isAfterWorkingHours,
} from "./deliveryPricingPolicy";

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
  // Include legacy zones with null/missing ownerId only for the default company
  if (id === String(COMPANY_ID)) {
    return {
      $or: [{ ownerId: id }, { ownerId: null }, { ownerId: { $exists: false } }],
    };
  }
  return { ownerId: id };
}

/**
 * Calculate full delivery pricing for an order.
 *
 * @param {Object} params
 * @param {string} params.placeIn
 * @param {string} params.placeOut
 * @param {string} [params.companyId] — car owner / company; defaults to COMPANY_ID
 * @param {string|Date} [params.timeIn] — for after-hours surcharge
 * @param {string|Date} [params.timeOut]
 */
export async function calculateDeliveryPrice({
  placeIn,
  placeOut,
  companyId,
  timeIn,
  timeOut,
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
  const useRules = hasActiveDeliveryPricing(policy);

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
    if (useRules) {
      const distanceKm =
        zone?.distanceKm != null && Number.isFinite(Number(zone.distanceKm))
          ? Number(zone.distanceKm)
          : null;

      // Named zone always wins as explicit override when present
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

      // No named zone + no distance → cannot apply radius rule yet
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

  return {
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
  };
}
