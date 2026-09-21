import type { Metadata } from "next";
import { getSeoConfig } from "@config/seo";
import { getActiveBrand } from "@config/brand";
import {
  buildCarSeoText,
  getCarAlternates,
  getHubAlternates,
  getHubSeo,
  getLocationAlternatesById,
  getLocationPathFromLocation,
  getLocaleRootPath,
  getSupportedLocales,
  getStaticPagePath,
  getStaticPageSeo,
  normalizeLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { type StaticPageKey } from "@domain/locationSeo/locationSeoKeys";
import {
  NOINDEX_STATIC_PAGES,
  isNoindexLocation,
} from "@config/sitemapConfig";
import type { LocationSeoResolved } from "@domain/locationSeo/types";
import { getAirportPrioritySeo, isPriorityAirportLocation } from "./airportPrioritySeo";
import { buildHreflangAlternates } from "./hreflangBuilder";
import { getRobotsForPath } from "./indexingPolicy";
import { toAbsoluteUrl } from "./urlBuilder";

const OG_LOCALE_MAP: Record<string, string> = {
  en: "en_US",
  es: "es_ES",
  ca: "ca_ES",
  ru: "ru_RU",
  uk: "uk_UA",
  el: "el_GR",
  de: "de_DE",
  fr: "fr_FR",
  it: "it_IT",
  sv: "sv_SE",
  no: "nb_NO",
  bg: "bg_BG",
  ro: "ro_RO",
  sr: "sr_RS",
  pl: "pl_PL",
};

function brandImageUrl() {
  const brand = getActiveBrand();
  return `${getSeoConfig().baseUrl}${brand.logos.mark}`;
}

function getOpenGraphLocale(locale: string): string {
  const key = String(locale || "en").toLowerCase().split("-")[0];
  return OG_LOCALE_MAP[key] || OG_LOCALE_MAP.en;
}

function isRobotsIndexable(robots: Metadata["robots"]): boolean {
  if (typeof robots === "string") {
    return !robots.toLowerCase().includes("noindex");
  }
  return robots?.index !== false;
}

function buildBaseMetadata(input: {
  title: string;
  description: string;
  canonicalPath: string;
  alternatePathsByLocale: Record<string, string>;
  locale: string;
  /** When true, set robots to noindex,follow (for legal/technical pages). */
  noindex?: boolean;
}): Metadata {
  const seoConfig = getSeoConfig();
  const robots = getRobotsForPath(input.canonicalPath, Boolean(input.noindex));
  const isIndexable = isRobotsIndexable(robots);
  const hreflangAlternates = isIndexable
    ? buildHreflangAlternates(input.alternatePathsByLocale)
    : ({} as Record<string, string>);
  const canonicalUrl = toAbsoluteUrl(input.canonicalPath);

  const alternates: Metadata["alternates"] = {
    canonical: canonicalUrl,
  };
  if (isIndexable && Object.keys(hreflangAlternates).length > 0) {
    alternates.languages = hreflangAlternates;
  }

  return {
    title: input.title,
    description: input.description,
    alternates,
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonicalUrl,
      locale: getOpenGraphLocale(input.locale),
      type: "website",
      siteName: seoConfig.siteName,
      images: [
        {
          url: brandImageUrl(),
          width: 512,
          height: 512,
          alt: seoConfig.siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [brandImageUrl()],
    },
    robots,
  };
}

export function buildHubMetadata(localeCandidate: string | undefined | null): Metadata {
  const hubSeo = getHubSeo(localeCandidate);
  const urlLocale =
    String(localeCandidate || "en").toLowerCase().split("-")[0] === "es"
      ? "es"
      : normalizeLocale(localeCandidate);
  const canonicalPath = getLocaleRootPath(localeCandidate);

  return buildBaseMetadata({
    title: hubSeo.seoTitle,
    description: hubSeo.seoDescription,
    canonicalPath,
    alternatePathsByLocale: getHubAlternates(),
    locale: urlLocale,
  });
}

export function buildLocationsIndexMetadata(
  localeCandidate: string | undefined | null
): Metadata {
  const locale = normalizeLocale(localeCandidate);
  const hubSeo = getHubSeo(locale);
  const canonicalPath = `/${locale}/locations`;
  const alternatePathsByLocale = Object.fromEntries(
    getSupportedLocales().map((supportedLocale) => [
      supportedLocale,
      `/${supportedLocale}/locations`,
    ])
  );

  return buildBaseMetadata({
    title: hubSeo.seoTitle,
    description: hubSeo.seoDescription,
    canonicalPath,
    alternatePathsByLocale,
    locale,
  });
}

export function buildLocationMetadata(location: LocationSeoResolved): Metadata {
  const canonicalPath = getLocationPathFromLocation(location.locale, location);
  const prioritySeo = isPriorityAirportLocation(location)
    ? getAirportPrioritySeo(location.locale)
    : null;
  const title = prioritySeo?.seoTitle || location.seoTitle;
  const description = prioritySeo?.seoDescription || location.seoDescription;

  return buildBaseMetadata({
    title,
    description,
    canonicalPath,
    alternatePathsByLocale: getLocationAlternatesById(location.id),
    locale: location.locale,
    noindex: isNoindexLocation(location.id),
  });
}

export function buildCarMetadata(input: {
  localeCandidate: string | undefined | null;
  carSlug: string;
  carModel: string;
  locationName: string;
  transmission?: string;
  fuelType?: string;
  seats?: string;
}): Metadata {
  const locale = normalizeRoutableLocale(input.localeCandidate);
  const canonicalPath = `/${locale}/cars/${encodeURIComponent(input.carSlug)}`;
  const carSeo = buildCarSeoText(locale, {
    carModel: input.carModel,
    locationName: input.locationName,
    transmission: input.transmission,
    fuelType: input.fuelType,
    seats: input.seats,
  });

  return buildBaseMetadata({
    title: carSeo.seoTitle,
    description: carSeo.seoDescription,
    canonicalPath,
    alternatePathsByLocale: getCarAlternates(input.carSlug),
    locale,
  });
}

export function buildStaticPageMetadata(
  localeCandidate: string | undefined | null,
  pageKey: StaticPageKey
): Metadata {
  const locale = normalizeRoutableLocale(localeCandidate);
  const pageSeo = getStaticPageSeo(localeCandidate, pageKey);

  const alternatesByLocale = Object.fromEntries(
    Object.keys(getHubAlternates()).map((supportedLocale) => [
      supportedLocale,
      getStaticPagePath(supportedLocale, pageKey),
    ])
  );

  return buildBaseMetadata({
    title: pageSeo.seoTitle,
    description: pageSeo.seoDescription,
    canonicalPath: getStaticPagePath(locale, pageKey),
    alternatePathsByLocale: alternatesByLocale,
    locale,
    noindex: NOINDEX_STATIC_PAGES.has(pageKey),
  });
}
