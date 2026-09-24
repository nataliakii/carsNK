import { normalizeOfficeKey } from "@/domain/orders/carOffices";
import { resolveCompanyBookingCoverage } from "@/domain/orders/companyBookingCoverage";

function uniqueNames(names) {
  const seen = new Set();
  const out = [];
  for (const raw of names || []) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = normalizeOfficeKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Names a public customer may pick as pickup/return for this car's company.
 * Delivery areas and offices only. Never the platform catalog or another country.
 */
export function resolveAllowedCustomerPlaceNames({
  company,
  car,
  catalogCities,
} = {}) {
  const coverage = resolveCompanyBookingCoverage({
    company,
    car,
    catalogCities,
  });
  return uniqueNames([
    ...coverage.deliveryAreas.map((area) => area.name),
    ...coverage.offices.map((office) => office.name),
  ]);
}
