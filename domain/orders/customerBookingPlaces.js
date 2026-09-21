import {
  isSpainBookingSite,
  resolveCatalogPlaceOptions,
} from "@/domain/orders/catalogPlaceOptions";
import {
  normalizeOperatingCities,
  resolveDeliveryStrategy,
} from "@/domain/delivery/cityDeliveryPricing";
import {
  normalizeOfficeKey,
  resolveBookingDisplayOffices,
} from "@/domain/orders/carOffices";

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
 * Names a public customer may pick as pickup/return.
 *
 * Spain / cities strategy / operatingCities: catalog cities + operating
 * cities + offices — not only the owner's legacy booking-location list.
 * Greece (no cities strategy): owner booking points + offices.
 */
export function resolveAllowedCustomerPlaceNames({
  countryCode,
  company,
  car,
  ownerBookingCityNames,
} = {}) {
  const ownerNames = (Array.isArray(ownerBookingCityNames)
    ? ownerBookingCityNames
    : []
  )
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  const officeNames = resolveBookingDisplayOffices(car, company, {
    countryCode,
  }).map((office) => office.name);
  const operating = normalizeOperatingCities(
    company?.deliveryPricing?.operatingCities
  );
  const spain = isSpainBookingSite(countryCode);
  const strategy = resolveDeliveryStrategy(company?.deliveryPricing);
  const useCatalog =
    spain || strategy === "cities" || operating.length > 0;

  if (useCatalog) {
    const catalog = resolveCatalogPlaceOptions(ownerNames, countryCode);
    return uniqueNames([...catalog, ...operating, ...officeNames]);
  }

  return uniqueNames([...ownerNames, ...officeNames]);
}
