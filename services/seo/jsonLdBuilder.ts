import { getSeoConfig } from "@config/seo";
import { getActiveBrand } from "@config/brand";
import { getSiteCountryConfig } from "@config/siteCountry";
import {
  getHubSeo,
  normalizeLocale,
} from "@domain/locationSeo/locationSeoService";
import { resolveSpainSeoLang } from "@domain/locationSeo/spainSeoContent";
import type { LocationSeoResolved } from "@domain/locationSeo/types";
import { toAbsoluteUrl } from "./urlBuilder";

const DEFAULT_AGGREGATE_RATING = {
  ratingValue: "4.9",
  reviewCount: "140",
};

function brandLogoUrl() {
  const brand = getActiveBrand();
  return `${getSeoConfig().baseUrl}${brand.logos.mark}`;
}

function siteAddressCountry() {
  return getSiteCountryConfig().country;
}

function buildAreaServed(areaNames: string[]) {
  const addressCountry = siteAddressCountry();
  return areaNames.map((name) => ({
    "@type": "AdministrativeArea",
    name,
    addressCountry,
  }));
}

function buildPickupAddress() {
  const seoConfig = getSeoConfig();

  return {
    "@type": "PostalAddress",
    streetAddress:
      seoConfig.contact.address.split(",")[0] || seoConfig.contact.address,
    addressLocality: seoConfig.addressLocality || "",
    addressRegion: seoConfig.addressRegion || "",
    ...(seoConfig.postalCode ? { postalCode: seoConfig.postalCode } : {}),
    addressCountry: seoConfig.addressCountry || siteAddressCountry(),
  };
}

function buildGeoCoordinates() {
  const seoConfig = getSeoConfig();

  return {
    "@type": "GeoCoordinates",
    latitude: Number.parseFloat(seoConfig.coordinates.lat),
    longitude: Number.parseFloat(seoConfig.coordinates.lon),
  };
}

export function buildAutoRentalJsonLd(input: {
  localeCandidate: string | undefined | null;
  pagePath: string;
  location: Pick<
    LocationSeoResolved,
    | "seoDescription"
    | "areaServed"
    | "pickupLocation"
    | "offerName"
    | "offerDescription"
  >;
  offerUrlPath?: string;
}) {
  const seoConfig = getSeoConfig();
  const pageUrl = toAbsoluteUrl(input.pagePath);
  const offerUrl = toAbsoluteUrl(input.offerUrlPath || input.pagePath);
  const addressCountry = siteAddressCountry();
  const inLanguage = getSiteCountryConfig().showLegacySeoLocations
    ? normalizeLocale(input.localeCandidate)
    : resolveSpainSeoLang(input.localeCandidate);

  return {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    additionalType: "https://schema.org/LocalBusiness",
    name: seoConfig.siteName,
    url: pageUrl,
    description: input.location.seoDescription,
    image: brandLogoUrl(),
    inLanguage,
    areaServed: buildAreaServed(input.location.areaServed),
    address: buildPickupAddress(),
    geo: buildGeoCoordinates(),
    pickupLocation: {
      "@type": "Place",
      name: input.location.pickupLocation,
      address: buildPickupAddress(),
      geo: buildGeoCoordinates(),
    },
    offers: {
      "@type": "Offer",
      name: input.location.offerName,
      description: input.location.offerDescription,
      availability: "https://schema.org/InStock",
      priceCurrency: "EUR",
      url: offerUrl,
      areaServed: buildAreaServed(input.location.areaServed),
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: DEFAULT_AGGREGATE_RATING.ratingValue,
      reviewCount: DEFAULT_AGGREGATE_RATING.reviewCount,
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: seoConfig.contact.phone,
      email: seoConfig.contact.email,
      contactType: "customer support",
      areaServed: addressCountry,
      availableLanguage: seoConfig.supportedLocales,
    },
  };
}

export function buildCarProductJsonLd(input: {
  localeCandidate: string | undefined | null;
  pagePath: string;
  car: {
    model: string;
    transmission?: string;
    fueltype?: string;
    seats?: number;
    airConditioning?: boolean;
    engine?: string;
    enginePower?: number;
    numberOfDoors?: number;
    registration?: number;
    photoUrl?: string;
    /** Lowest daily price for Offer schema (e.g. from pricingTiers) */
    priceFrom?: number;
  };
  locationName: string;
}) {
  const seoConfig = getSeoConfig();
  const pageUrl = toAbsoluteUrl(input.pagePath);
  const photoUrl = input.car.photoUrl
    ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "carsnk"}/image/upload/${input.car.photoUrl}`
    : brandLogoUrl();

  const capitalize = (s?: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  const countryName = getSiteCountryConfig().countryName;
  const isEs =
    String(input.localeCandidate || "")
      .toLowerCase()
      .split("-")[0] === "es";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: isEs
      ? `${input.car.model} — Alquiler de coche`
      : `${input.car.model} — Car Rental`,
    description: isEs
      ? `Alquila ${input.car.model} en ${input.locationName}, ${countryName}. Cambio ${capitalize(input.car.transmission)}, combustible ${input.car.fueltype || "gasolina"}, ${input.car.seats || 5} plazas.`
      : `Rent ${input.car.model} in ${input.locationName}, ${countryName}. ${capitalize(input.car.transmission)} transmission, ${input.car.fueltype || "petrol"} fuel, ${input.car.seats || 5} seats.`,
    image: photoUrl,
    url: pageUrl,
    brand: {
      "@type": "Brand",
      name: seoConfig.siteName,
    },
    ...(input.car.transmission && {
      vehicleTransmission: capitalize(input.car.transmission),
    }),
    ...(input.car.fueltype && { fuelType: capitalize(input.car.fueltype) }),
    ...(input.car.seats && { seatingCapacity: input.car.seats }),
    ...(input.car.numberOfDoors && { numberOfDoors: input.car.numberOfDoors }),
    ...(input.car.registration && {
      vehicleModelDate: String(input.car.registration),
    }),
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      ...(typeof input.car.priceFrom === "number" &&
        input.car.priceFrom > 0 && { price: String(input.car.priceFrom) }),
      availability: "https://schema.org/InStock",
      url: pageUrl,
      seller: {
        "@type": "Organization",
        name: seoConfig.siteName,
      },
      areaServed: {
        "@type": "Country",
        name: countryName,
      },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: DEFAULT_AGGREGATE_RATING.ratingValue,
      reviewCount: DEFAULT_AGGREGATE_RATING.reviewCount,
    },
  };
}

export function buildFaqJsonLd(faqItems: { question: string; answer: string }[]) {
  if (!faqItems || faqItems.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[]
) {
  if (!items || items.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** HowTo — for step-by-step flows (e.g. airport rental process); supports rich results guidelines */
export function buildHowToJsonLd(input: {
  name: string;
  steps: string[];
  locale: string;
  /** Canonical page URL (optional); use with #fragment to match on-page block */
  pageUrl?: string;
  description?: string;
}) {
  if (!input.steps || input.steps.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    inLanguage: input.locale,
    ...(input.pageUrl ? { url: input.pageUrl } : {}),
    step: input.steps.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: text,
      text,
    })),
  };
}

/** ItemList — for on-page bullet lists (e.g. “why choose us” benefits) */
export function buildItemListJsonLd(input: {
  name: string;
  items: string[];
  locale: string;
  pageUrl?: string;
}) {
  if (!input.items || input.items.length === 0) return null;

  const cleaned = input.items.map((raw) =>
    String(raw)
      .replace(/^\s*(?:[✔✓]|\u2714)\s*/, "")
      .trim()
  );

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    inLanguage: input.locale,
    ...(input.pageUrl ? { url: input.pageUrl } : {}),
    numberOfItems: cleaned.length,
    itemListElement: cleaned.map((text, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: text,
    })),
  };
}

export function buildHubJsonLd(input: {
  localeCandidate: string | undefined | null;
  pagePath: string;
  primaryLocation: Pick<
    LocationSeoResolved,
    | "seoDescription"
    | "areaServed"
    | "pickupLocation"
    | "offerName"
    | "offerDescription"
  >;
}) {
  const hubSeo = getHubSeo(input.localeCandidate);

  return {
    ...buildAutoRentalJsonLd({
      localeCandidate: input.localeCandidate,
      pagePath: input.pagePath,
      location: {
        ...input.primaryLocation,
        seoDescription: hubSeo.seoDescription,
      },
    }),
    description: hubSeo.seoDescription,
  };
}
