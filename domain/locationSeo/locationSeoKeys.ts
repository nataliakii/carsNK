export const DEFAULT_LOCALE = "en" as const;

export const SUPPORTED_LOCALES = [
  "en",
  "ru",
  "uk",
  "el",
  "de",
  "bg",
  "ro",
  "sr",
  "pl",
] as const;

export const REQUIRED_CONTENT_LOCALES = ["en", "ru", "uk", "el"] as const;

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE" as const;
export const LOCALE_REQUEST_HEADER_NAME = "x-site-locale" as const;

export const LOCATION_ROUTE_SEGMENT = "locations" as const;
export const CARS_ROUTE_SEGMENT = "cars" as const;

export const LOCATION_TYPES = ["city", "airport", "region", "subRegion"] as const;

export const LOCATION_IDS = {
  THESSALONIKI: "thessaloniki",
  THESSALONIKI_AIRPORT: "thessaloniki-airport",
  HALKIDIKI: "halkidiki",
  SITHONIA: "sithonia",
  KASSANDRA: "kassandra",
  // Halkidiki city pages (SEO landings, CTA → homepage search)
  NEA_KALLIKRATIA: "nea-kallikratia",
  NEA_MOUDANIA: "nea-moudania",
  NIKITI: "nikiti",
  NEOS_MARMARAS: "neos-marmaras",
  SARTI: "sarti",
  KALLITHEA: "kallithea",
  PEFKOHORI: "pefkohori",
  HANIOTI: "hanioti",
  POLICHRONO: "polichrono",
  AFITOS: "afitos",
  KRIOPIGI: "kriopigi",
  SANI: "sani",
  KASSANDRIA: "kassandria",
  FOURKA: "fourka",
  METAMORFOSI: "metamorfosi",
  AGIOS_NIKOLAOS_HALKIDIKI: "agios-nikolaos-halkidiki",
  ORMILIA: "ormilia",
  PETRALONA: "petralona",
  VRASNA: "vrasna",
  OLYMPIADA: "olympiada",
} as const;

/** Main region IDs shown at top level in Locations nav (expandable regions + single links). */
export const MAIN_NAV_REGION_IDS = [
  LOCATION_IDS.THESSALONIKI_AIRPORT,
  LOCATION_IDS.THESSALONIKI,
  LOCATION_IDS.NEA_KALLIKRATIA,
  LOCATION_IDS.HALKIDIKI,
] as const;

/** IDs of the hub locations shown in the navbar Locations dropdown (flat list for legacy). */
export const HUB_NAV_LOCATION_IDS = [
  LOCATION_IDS.THESSALONIKI_AIRPORT,
  LOCATION_IDS.THESSALONIKI,
  LOCATION_IDS.NEA_KALLIKRATIA,
  LOCATION_IDS.HALKIDIKI,
  LOCATION_IDS.AFITOS,
  LOCATION_IDS.AGIOS_NIKOLAOS_HALKIDIKI,
  LOCATION_IDS.FOURKA,
  LOCATION_IDS.HANIOTI,
  LOCATION_IDS.KALLITHEA,
  LOCATION_IDS.KASSANDRA,
  LOCATION_IDS.KASSANDRIA,
  LOCATION_IDS.KRIOPIGI,
  LOCATION_IDS.METAMORFOSI,
  LOCATION_IDS.NEA_MOUDANIA,
  LOCATION_IDS.NEOS_MARMARAS,
  LOCATION_IDS.NIKITI,
  LOCATION_IDS.OLYMPIADA,
  LOCATION_IDS.ORMILIA,
  LOCATION_IDS.PEFKOHORI,
  LOCATION_IDS.PETRALONA,
  LOCATION_IDS.POLICHRONO,
  LOCATION_IDS.SANI,
  LOCATION_IDS.SARTI,
  LOCATION_IDS.SITHONIA,
  LOCATION_IDS.VRASNA,
] as const;

export const LOCATION_CONTENT_KEYS = {
  THESSALONIKI: "location.thessaloniki",
  THESSALONIKI_AIRPORT: "location.thessalonikiAirport",
  HALKIDIKI: "location.halkidiki",
  SITHONIA: "location.sithonia",
  KASSANDRA: "location.kassandra",
  NEA_KALLIKRATIA: "location.neaKallikratia",
  NEA_MOUDANIA: "location.neaMoudania",
  NIKITI: "location.nikiti",
  NEOS_MARMARAS: "location.neosMarmaras",
  SARTI: "location.sarti",
  KALLITHEA: "location.kallithea",
  PEFKOHORI: "location.pefkohori",
  HANIOTI: "location.hanioti",
  POLICHRONO: "location.polichrono",
  AFITOS: "location.afitos",
  KRIOPIGI: "location.kriopigi",
  SANI: "location.sani",
  KASSANDRIA: "location.kassandria",
  FOURKA: "location.fourka",
  METAMORFOSI: "location.metamorfosi",
  AGIOS_NIKOLAOS_HALKIDIKI: "location.agiosNikolaosHalkidiki",
  ORMILIA: "location.ormilia",
  PETRALONA: "location.petralona",
  VRASNA: "location.vrasna",
  OLYMPIADA: "location.olympiada",
} as const;

export const STATIC_PAGE_KEYS = {
  CONTACTS: "contacts",
  PRIVACY_POLICY: "privacy-policy",
  TERMS_OF_SERVICE: "terms-of-service",
  COOKIE_POLICY: "cookie-policy",
  RENTAL_TERMS: "rental-terms",
} as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type RequiredContentLocale = (typeof REQUIRED_CONTENT_LOCALES)[number];
export type LocationId = (typeof LOCATION_IDS)[keyof typeof LOCATION_IDS];
export type LocationType = (typeof LOCATION_TYPES)[number];
export type LocationContentKey =
  (typeof LOCATION_CONTENT_KEYS)[keyof typeof LOCATION_CONTENT_KEYS];
export type StaticPageKey = (typeof STATIC_PAGE_KEYS)[keyof typeof STATIC_PAGE_KEYS];
