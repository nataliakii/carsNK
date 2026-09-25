import { getSiteCountryCode } from "@config/siteCountry";
import { impliedLocationCountry } from "@/domain/orders/companyBookingCoverage";
import {
  DEFAULT_SPAIN_BOOKING_LOCATION,
  SPAIN_CITY_OPTIONS,
  spainCityRequiresAddressDetail,
} from "@/domain/orders/spainCityOptions";

/** True when this deployment is the Spain (Rovaro) site. */
export function isSpainBookingSite(countryCode = getSiteCountryCode()) {
  return String(countryCode || "").toUpperCase() === "ES";
}

function normalizeSiteCountry(countryCode) {
  return String(countryCode || getSiteCountryCode() || "")
    .trim()
    .toUpperCase();
}

/** Drop legacy Halkidiki / Spain labels that belong to another deployment market. */
export function isCatalogPlaceAllowedForSite(name, countryCode) {
  const site = normalizeSiteCountry(countryCode);
  const label = String(name || "").trim();
  if (!label) return false;
  const implied = impliedLocationCountry(label);
  if (implied && site && implied !== site) return false;
  return true;
}

function companyPlacesForSite(companyLocationNames, countryCode) {
  return (Array.isArray(companyLocationNames) ? companyLocationNames : [])
    .map((name) => String(name || "").trim())
    .filter((name) => isCatalogPlaceAllowedForSite(name, countryCode));
}

/**
 * Catalog / booking place names for the current market.
 * Spain: curated cities (address later in order). Greece: company booking points.
 */
export function resolveCatalogPlaceOptions(companyLocationNames, countryCode) {
  const site = normalizeSiteCountry(countryCode);
  const companyNames = companyPlacesForSite(companyLocationNames, site);

  if (isSpainBookingSite(site)) {
    const curated = [...SPAIN_CITY_OPTIONS];
    const extras = companyNames.filter(
      (name) =>
        !curated.some((c) => c.toLowerCase() === name.toLowerCase())
    );
    return extras.length ? [...curated, ...extras] : curated;
  }
  return companyNames;
}

export function resolveCatalogDefaultPlace(companyDefaultName, countryCode) {
  if (isSpainBookingSite(countryCode)) {
    return DEFAULT_SPAIN_BOOKING_LOCATION;
  }
  return companyDefaultName || "";
}

/**
 * Spain cities always need street/hotel detail (except airports).
 * Greece keeps company / catalog requiresAddressDetail rules.
 */
export function resolvePlaceRequiresAddressDetail(
  value,
  companyRequiresDetailFn,
  countryCode
) {
  if (isSpainBookingSite(countryCode)) {
    return spainCityRequiresAddressDetail(value);
  }
  return typeof companyRequiresDetailFn === "function"
    ? companyRequiresDetailFn(value)
    : false;
}
