import {
  getLocationByAnySlug,
  getLocationById,
  getLocationByLocaleAndSlug,
  getLocationByPath,
  isRoutableLocale,
  isSupportedLocale,
  normalizeLocale,
  normalizeRoutableLocale,
  resolveLocationFromSingleSegmentSlug,
} from "@domain/locationSeo/locationSeoService";
import {
  LOCATION_IDS,
  LOCATION_ROUTE_SEGMENT,
} from "@domain/locationSeo/locationSeoKeys";
import {
  getSpainLocationById,
  getSpainLocationBySlug,
  SPAIN_LOCATION_IDS,
} from "@domain/locationSeo/spainLocations";
import {
  DEFAULT_BOOKING_LOCATION,
  ORDERED_LOCATION_OPTIONS,
} from "./locationOptions";
import { isSpainCityOption } from "./spainCityOptions";

function mapSpainSeoToBookingCity(spainLoc) {
  if (!spainLoc) return null;
  if (spainLoc.id === SPAIN_LOCATION_IDS.BARCELONA) return "Barcelona";
  if (spainLoc.id === SPAIN_LOCATION_IDS.COSTA_BRAVA) return "Costa Brava";
  const enName = spainLoc.copy?.en?.shortName || spainLoc.copy?.en?.name;
  if (enName && isSpainCityOption(enName)) return enName;
  return null;
}

function mapLocationToBookingOption(location) {
  if (!location) return null;

  if (location.id === LOCATION_IDS.HALKIDIKI) {
    return DEFAULT_BOOKING_LOCATION;
  }

  if (location.id === LOCATION_IDS.THESSALONIKI_AIRPORT) {
    return "Airport";
  }

  const englishLocation = getLocationById("en", location.id);
  const englishShortName = englishLocation?.shortName || "";

  return (
    ORDERED_LOCATION_OPTIONS.find(
      (option) => option.toLowerCase() === englishShortName.toLowerCase()
    ) || null
  );
}

/**
 * Resolve homepage ?pickup={canonicalSlug} (from getHomepageSearchUrl CTAs)
 * to a booking/region filter option name.
 */
export function resolveBookingLocationFromPickupParam(pickupSlug) {
  const slug = String(pickupSlug || "").trim();
  if (!slug) return null;

  const spainById = getSpainLocationById(slug);
  if (spainById) return mapSpainSeoToBookingCity(spainById);

  const spainBySlug = getSpainLocationBySlug("en", slug);
  if (spainBySlug) return mapSpainSeoToBookingCity(spainBySlug);

  const location =
    getLocationById("en", slug) ||
    getLocationByAnySlug("en", slug) ||
    resolveLocationFromSingleSegmentSlug("en", slug) ||
    getLocationByLocaleAndSlug("en", slug);

  return mapLocationToBookingOption(location);
}

export function resolveBookingLocationFromPathname(pathname) {
  if (!pathname) return null;

  const segments = pathname.split("/").filter(Boolean);
  const [localeSegment, routeSegment, ...locationPathSegments] = segments;

  if (
    !isRoutableLocale(localeSegment) ||
    routeSegment !== LOCATION_ROUTE_SEGMENT ||
    locationPathSegments.length === 0
  ) {
    return null;
  }

  const locale = normalizeRoutableLocale(localeSegment);

  if (locationPathSegments.length === 1) {
    const [slug] = locationPathSegments;
    const spainLoc = getSpainLocationBySlug(locale, slug);
    if (spainLoc) return mapSpainSeoToBookingCity(spainLoc);
  }

  // Greek SEO tree only for SUPPORTED_LOCALES (en, el, ru, …)
  if (!isSupportedLocale(localeSegment)) {
    return null;
  }

  const seoLocale = normalizeLocale(localeSegment);
  let location = null;

  if (locationPathSegments.length === 1) {
    const [slug] = locationPathSegments;
    location =
      resolveLocationFromSingleSegmentSlug(seoLocale, slug) ||
      getLocationByLocaleAndSlug(seoLocale, slug) ||
      getLocationByAnySlug(seoLocale, slug) ||
      getLocationByPath(seoLocale, locationPathSegments);
  } else {
    location =
      getLocationByPath(seoLocale, locationPathSegments) ||
      getLocationByLocaleAndSlug(
        seoLocale,
        locationPathSegments[locationPathSegments.length - 1]
      ) ||
      getLocationByAnySlug(
        seoLocale,
        locationPathSegments[locationPathSegments.length - 1]
      );
  }

  return mapLocationToBookingOption(location);
}

