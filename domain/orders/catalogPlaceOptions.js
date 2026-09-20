import { getSiteCountryCode } from "@config/siteCountry";
import {
  DEFAULT_SPAIN_BOOKING_LOCATION,
  SPAIN_CITY_OPTIONS,
  spainCityRequiresAddressDetail,
} from "@/domain/orders/spainCityOptions";

/** True when this deployment is the Spain (Rovaro) site. */
export function isSpainBookingSite(countryCode = getSiteCountryCode()) {
  return String(countryCode || "").toUpperCase() === "ES";
}

/**
 * Catalog / booking place names for the current market.
 * Spain: curated cities (address later in order). Greece: company booking points.
 */
export function resolveCatalogPlaceOptions(companyLocationNames, countryCode) {
  if (isSpainBookingSite(countryCode)) {
    const curated = [...SPAIN_CITY_OPTIONS];
    const extras = (Array.isArray(companyLocationNames)
      ? companyLocationNames
      : []
    )
      .map((name) => String(name || "").trim())
      .filter(
        (name) =>
          name &&
          !curated.some((c) => c.toLowerCase() === name.toLowerCase())
      );
    return extras.length ? [...curated, ...extras] : curated;
  }
  return Array.isArray(companyLocationNames) ? companyLocationNames : [];
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
