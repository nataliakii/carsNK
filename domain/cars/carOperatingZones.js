/**
 * Resolves the list of cities/zones a car can be delivered to.
 *
 * Single source of truth shared by the compact summary on the collapsed
 * catalog card and the full zone list in CarDeliveryInfo, so the two can never
 * show different places for the same car.
 */

import {
  normalizeCarOffices,
  resolveBookingDisplayOffices,
} from "@/domain/orders/carOffices";
import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";

const cleanNames = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);

/**
 * Offices enriched with company data — also used by the delivery block to
 * build the "free pickup at …" line.
 */
export function resolveCarOffices(car, company) {
  return resolveBookingDisplayOffices(car, company);
}

/**
 * Cities shown as "available in" chips.
 *
 *   1. company.deliveryPricing.operatingCities — where the company delivers
 *   2. the car's own offices — honest fallback when no city list is saved
 *
 * `zoneNames` (booking catalog / SPAIN_CITY_OPTIONS) is ignored on purpose.
 * That list is the pickup autocomplete for the whole market, not a claim
 * that every car covers Spain.
 *
 * @returns {string[]} de-duplicated place names, order preserved.
 */
export function resolveCarOperatingZones({ car, company } = {}) {
  const operatingCities = normalizeOperatingCities(
    company?.deliveryPricing?.operatingCities
  );
  if (operatingCities.length) return operatingCities;

  return Array.from(
    new Set(
      cleanNames(normalizeCarOffices(car?.offices).map((office) => office.name))
    )
  );
}
