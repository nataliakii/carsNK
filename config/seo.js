/**
 * SEO Configuration
 * Centralized SEO constants to avoid duplication
 * Can accept companyData from DB or fallback to config
 *
 * Supports multilingual SEO for target markets.
 * Canonical / OG / sitemap base URL always comes from getBaseUrl() → carsnk.gr
 */

import { getBaseUrl } from "@config/domain";

const fallbackCompanyData = {
  name: "CarsNK",
  tel: "+380 68 100 3771",
  tel2: "+353 85 270 96 05",
  email: "admin@bbqr.site",
  address: "Antonioy Kelesi 12, Nea Kallikratia 630 80",
  coords: { lat: "40.311273589340836", lon: "23.06426516796098" },
};

/** Single source of truth for production base URL (carsnk.gr). */
export const PRODUCTION_BASE_URL = getBaseUrl();

export const multilingualDescriptions = {
  en: "Rent a car in Halkidiki, Greece with CarsNK. Affordable car hire with flexible pickup and return options. Best car rental aggregator in Halkidiki, Nea Kallikratia, Kassandra, Sithonia.",
  ru: "Аренда авто в Халкидики, Греция — CarsNK. Прокат машин без депозита. Гибкие условия получения и возврата. Лучший агрегатор проката авто в Халкидики, Неа Каликратия, Кассандра, Ситония.",
  uk: "Оренда авто в Халкідіках, Греція — CarsNK. Прозорі умови, гнучка видача та повернення, підтримка для маршрутів Халкідіки, Ситонії та Кассандри.",
  de: "Mietwagen in Chalkidiki, Griechenland bei CarsNK. Günstige Autovermietung mit flexiblen Abhol- und Rückgabeoptionen. Autovermietungs-Aggregator in Chalkidiki, Nea Kallikratia, Kassandra, Sithonia.",
  sr: "Rent a car u Halkidikiju, Grčka — CarsNK. Povoljno iznajmljivanje auta bez depozita. Fleksibilni uslovi preuzimanja i vraćanja. Najbolji rent a car aggregator u Halkidikiju.",
  ro: "Închirieri auto în Halkidiki, Grecia — CarsNK. Rent a car ieftin fără depozit. Condiții flexibile de preluare și returnare. Aggregator de închirieri auto în Halkidiki.",
  bg: "Рент а кар в Халкидики, Гърция — CarsNK. Евтин наем на коли без депозит. Гъвкави условия за получаване и връщане. Агрегатор за рент а кар в Халкидики.",
  el: "Ενοικίαση αυτοκινήτου στη Χαλκιδική, Ελλάδα με την CarsNK. Οικονομική ενοικίαση με ευέλικτες επιλογές παραλαβής και επιστροφής. Aggregator ενοικίασης στη Χαλκιδική.",
};

export const multilingualTitles = {
  en: "CarsNK - Car Rental in Halkidiki, Greece",
  ru: "CarsNK - Аренда авто в Халкидики, Греция",
  uk: "CarsNK - Оренда авто в Халкідіках, Греція",
  de: "CarsNK - Mietwagen in Chalkidiki, Griechenland",
  sr: "CarsNK - Rent a car Halkidiki, Grčka",
  ro: "CarsNK - Închirieri auto Halkidiki, Grecia",
  bg: "CarsNK - Рент а кар Халкидики, Гърция",
  el: "CarsNK - Ενοικίαση αυτοκινήτου Χαλκιδική",
};

/**
 * Get SEO configuration
 * @param {Object} [dbCompanyData] - Company data from database (optional)
 * @returns {Object} SEO configuration object
 */
export function getSeoConfig(dbCompanyData = null) {
  const companyData = dbCompanyData || fallbackCompanyData;
  const siteName = companyData?.name || fallbackCompanyData.name || "CarsNK";

  return {
    siteName,
    baseUrl: getBaseUrl(),
    defaultLocale: "en",
    supportedLocales: ["en", "ru", "uk", "de", "sr", "ro", "bg", "el", "pl"],
    primaryLocation: "Halkidiki, Greece",
    titleTemplate: `%s | ${siteName} - Car Rental in Halkidiki`,
    defaultTitle: `${siteName} - Car Rental in Halkidiki, Greece`,
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
      phone: companyData?.tel || fallbackCompanyData.tel || "+380 68 100 3771",
      address:
        companyData?.address ||
        fallbackCompanyData.address ||
        "Antonioy Kelesi 12, Nea Kallikratia 630 80",
    },
    coordinates: {
      lat:
        companyData?.coords?.lat ||
        fallbackCompanyData.coords?.lat ||
        "40.311273589340836",
      lon:
        companyData?.coords?.lon ||
        fallbackCompanyData.coords?.lon ||
        "23.06426516796098",
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
