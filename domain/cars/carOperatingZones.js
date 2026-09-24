/**
 * Resolves the list of cities/communes a car can be rented in.
 *
 * Single source of truth shared by the compact summary on the collapsed
 * catalog card and the full zone list in CarDeliveryInfo, so the two can never
 * show different places for the same car.
 *
 * Places come from the company's booking coverage (operating cities, cityIds,
 * legacy locations, Spain service areas) — never from office names.
 */

import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";
import { resolveBookingDisplayOffices } from "@/domain/orders/carOffices";
import { resolveCompanyBookingCoverage } from "@/domain/orders/companyBookingCoverage";

const cleanNames = (values) => {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const name = String(value || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
};

/**
 * Offices enriched with company data — also used by the delivery block to
 * build the "free pickup at …" line.
 */
export function resolveCarOffices(car, company) {
  return resolveBookingDisplayOffices(car, company);
}

/**
 * Cities/communes shown as "available in" chips.
 *
 * Prefer `deliveryAreaNames` when the public coverage API already resolved
 * cityIds against the platform catalog. Otherwise derive names from the
 * company record via resolveCompanyBookingCoverage.
 *
 * Office names are never used here — offices are pickup points, not markets.
 *
 * @returns {string[]} de-duplicated place names, order preserved.
 */
export function resolveCarOperatingZones({
  car,
  company,
  catalogCities,
  deliveryAreaNames,
} = {}) {
  if (Array.isArray(deliveryAreaNames)) {
    return cleanNames(deliveryAreaNames);
  }

  const coverage = resolveCompanyBookingCoverage({
    company,
    car,
    catalogCities,
  });
  const fromCoverage = cleanNames(
    (coverage.deliveryAreas || []).map((area) => area?.name)
  );
  if (fromCoverage.length) return fromCoverage;

  // Coverage drops areas when company.country is unset; still surface the
  // company's saved city list for the catalog chips.
  const fromPricing = normalizeOperatingCities(
    company?.deliveryPricing?.operatingCities
  );
  if (fromPricing.length) return cleanNames(fromPricing);

  const hasCityIds =
    Array.isArray(company?.cityIds) && company.cityIds.length > 0;
  if (hasCityIds) return [];

  const fromLocations = (Array.isArray(company?.locations) ? company.locations : [])
    .map((loc) => String(loc?.name || "").trim())
    .filter(Boolean);
  return cleanNames(fromLocations);
}
