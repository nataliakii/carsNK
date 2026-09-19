/**
 * SEO Configuration
 * Centralized SEO constants to avoid duplication
 * Can accept companyData from DB or fallback to config
 *
 * Supports multilingual SEO for target markets.
 * Canonical / OG / sitemap base URL comes from getBaseUrl().
 */

import { getBaseUrl } from "@config/domain";
import { getActiveBrand, getBrandName, isGreeceSite } from "@config/brand";
import { getSiteCountryConfig } from "@config/siteCountry";

const brand = getActiveBrand();
const country = getSiteCountryConfig();
const greece = isGreeceSite();

const fallbackCompanyData = {
  name: brand.name,
  tel: country.defaultTel,
  tel2: "",
  email: "admin@bbqr.site",
  address: country.defaultAddress,
  coords: country.defaultCoords,
};

/** Single source of truth for production base URL. */
export const PRODUCTION_BASE_URL = getBaseUrl();

export const multilingualDescriptions = {
  en: greece
    ? `Rent a car in Halkidiki, Greece with ${brand.name}. Affordable car hire with flexible pickup and return options. Best car rental aggregator in Halkidiki, Nea Kallikratia, Kassandra, Sithonia.`
    : `Rent a car in Spain with ${brand.name}. ${brand.tagline} Local partner fleets, transparent pricing, and easy online booking.`,
  ru: greece
    ? `Аренда авто в Халкидики, Греция — ${brand.name}. Прокат машин без депозита. Гибкие условия получения и возврата.`
    : `${brand.tagline} Аренда авто в Испании с ${brand.name}.`,
  uk: `Оренда авто з ${brand.name}.`,
  de: greece
    ? `Mietwagen mit ${brand.name}.`
    : `Mietwagen in Spanien mit ${brand.name}. ${brand.tagline}`,
  sr: `Rent a car sa ${brand.name}.`,
  ro: `Închirieri auto cu ${brand.name}.`,
  bg: `Наем на коли с ${brand.name}.`,
  el: `Ενοικίαση αυτοκινήτου με ${brand.name}.`,
  es: greece
    ? `${brand.tagline} Alquila un coche con ${brand.name}.`
    : `Alquila un coche en España con ${brand.name}. ${brand.tagline} Flotas locales, precios claros y reserva online sencilla.`,
};

export const multilingualTitles = {
  en: greece
    ? `${brand.name} - Car Rental in Halkidiki, Greece`
    : `${brand.name} — Car Rental in Spain | ${brand.tagline}`,
  ru: `${brand.name} — аренда авто`,
  uk: `${brand.name} — оренда авто`,
  de: greece
    ? `${brand.name} — Mietwagen`
    : `${brand.name} — Mietwagen Spanien`,
  sr: `${brand.name} — rent a car`,
  ro: `${brand.name} — închirieri auto`,
  bg: `${brand.name} — рент а кар`,
  el: `${brand.name} — ενοικίαση αυτοκινήτου`,
  es: greece
    ? `${brand.name} — ${brand.tagline}`
    : `${brand.name} — Alquiler de coches en España | ${brand.tagline}`,
};

/**
 * Get SEO configuration
 * @param {Object} [dbCompanyData] - Company data from database (optional)
 * @returns {Object} SEO configuration object
 */
export function getSeoConfig(dbCompanyData = null) {
  const companyData = dbCompanyData || fallbackCompanyData;
  const siteName = getBrandName();
  const siteCountry = getSiteCountryConfig();

  return {
    siteName,
    baseUrl: getBaseUrl(),
    defaultLocale: "en",
    supportedLocales: greece
      ? ["en", "ru", "uk", "de", "sr", "ro", "bg", "el", "pl", "es"]
      : ["en", "es", "de", "ru"],
    primaryLocation: greece ? "Halkidiki, Greece" : "Spain",
    addressCountry: siteCountry.country,
    addressLocality: greece ? "Nea Kallikratia" : "Madrid",
    addressRegion: greece ? "Halkidiki" : "Community of Madrid",
    postalCode: greece ? "63080" : "",
    titleTemplate: `%s | ${siteName}`,
    defaultTitle: multilingualTitles.en,
    defaultDescription: multilingualDescriptions.en,
    descriptions: multilingualDescriptions,
    titles: multilingualTitles,
    social: {
      facebook: "",
      instagram: "",
      linkedin: "https://www.linkedin.com/in/natalia-kirejeva/",
    },
    contact: {
      email: companyData?.email || fallbackCompanyData.email || "admin@bbqr.site",
      phone: companyData?.tel || fallbackCompanyData.tel || siteCountry.defaultTel,
      address:
        companyData?.address ||
        fallbackCompanyData.address ||
        siteCountry.defaultAddress,
    },
    coordinates: {
      lat:
        companyData?.coords?.lat ||
        fallbackCompanyData.coords?.lat ||
        siteCountry.defaultCoords.lat,
      lon:
        companyData?.coords?.lon ||
        fallbackCompanyData.coords?.lon ||
        siteCountry.defaultCoords.lon,
    },
    heroImageUrl: process.env.NEXT_PUBLIC_HERO_IMAGE_URL || null,
    heroImages: getHeroImages(),
  };
}

function getHeroImages() {
  const raw =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_HERO_IMAGES) || "";
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => typeof item === "string" && item.trim().length > 0
    );
  } catch {
    return [];
  }
}

export const seoConfig = getSeoConfig();
