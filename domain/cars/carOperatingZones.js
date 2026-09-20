/**
 * Resolves the list of cities/zones a car can be delivered to.
 *
 * Single source of truth shared by the compact summary on the collapsed
 * catalog card and the full zone list in CarDeliveryInfo, so the two can never
 * show different places for the same car.
 */

import {
  normalizeCarOffices,
  enrichOfficeWithCompany,
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
  return normalizeCarOffices(car?.offices).map((office) =>
    enrichOfficeWithCompany(office, company)
  );
}

/**
 * First non-empty source wins:
 *   1. the company's configured delivery operating cities
 *   2. booking zone names passed in by the card
 *   3. the company's saved locations
 *   4. the car's own offices
 *
 * @returns {string[]} de-duplicated place names, order preserved.
 */
export function resolveCarOperatingZones({ car, company, zoneNames = [] }) {
  const offices = resolveCarOffices(car, company);

  const sources = [
    normalizeOperatingCities(company?.deliveryPricing?.operatingCities),
    cleanNames(zoneNames),
    cleanNames((company?.locations || []).map((loc) => loc?.name)),
    cleanNames(offices.map((office) => office.name)),
  ];

  const chosen = sources.find((source) => source.length > 0) || [];
  return Array.from(new Set(chosen));
}
