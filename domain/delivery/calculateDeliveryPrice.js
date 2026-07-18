import { DeliveryZone } from "@models/DeliveryZone";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import { computeZoneDeliveryPrice } from "./deliveryPriceFormula";
import { resolveDeliveryZoneName } from "./resolveDeliveryZoneName";

function calculateZonePrice(zone, pricePerKm) {
  if (!zone) return { price: 0, zone: null, distanceKm: 0 };
  const price = computeZoneDeliveryPrice(zone, pricePerKm);
  return { price, zone, distanceKm: zone.distanceKm };
}

/**
 * Calculate full delivery pricing for an order.
 *
 * @param {Object} params
 * @param {string} params.placeIn  - pickup location name
 * @param {string} params.placeOut - return location name
 * @returns {Promise<{
 *   deliveryIn: number,
 *   deliveryOut: number,
 *   deliveryTotal: number,
 *   deliveryPricePerKm: number,
 *   placeIn: string,
 *   placeOut: string,
 * }>}
 */
export async function calculateDeliveryPrice({ placeIn, placeOut }) {
  const company = await Company.findById(COMPANY_ID).lean();
  // Schema default is 1; missing company/doc must not zero out all delivery
  const pricePerKm =
    company?.deliveryPricePerKm != null && !Number.isNaN(Number(company.deliveryPricePerKm))
      ? Number(company.deliveryPricePerKm)
      : 1;

  const resolvedIn = resolveDeliveryZoneName(placeIn);
  const resolvedOut = resolveDeliveryZoneName(placeOut);

  const zoneNames = [...new Set([resolvedIn, resolvedOut].filter(Boolean))];

  const zones = zoneNames.length > 0
    ? await DeliveryZone.find({
        name: { $in: zoneNames.map((n) => new RegExp(`^${escapeRegex(n)}$`, "i")) },
        isActive: true,
      }).lean()
    : [];

  const zoneMap = {};
  for (const z of zones) {
    zoneMap[z.name.toLowerCase()] = z;
  }

  const inZone = resolvedIn ? zoneMap[resolvedIn.toLowerCase()] || null : null;
  const outZone = resolvedOut ? zoneMap[resolvedOut.toLowerCase()] || null : null;

  const inResult = calculateZonePrice(inZone, pricePerKm);
  const outResult = calculateZonePrice(outZone, pricePerKm);

  return {
    deliveryIn: inResult.price,
    deliveryOut: outResult.price,
    deliveryTotal: inResult.price + outResult.price,
    deliveryPricePerKm: pricePerKm,
    placeIn: placeIn || "",
    placeOut: placeOut || "",
    /** Labels used for zone lookup (after alias mapping) */
    resolvedPlaceIn: resolvedIn,
    resolvedPlaceOut: resolvedOut,
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
