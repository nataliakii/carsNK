import { getBrandName, getBrandTagline } from "@config/brand";

export type SpainSeoLang = "en" | "es";

export function resolveSpainSeoLang(
  localeCandidate: string | undefined | null
): SpainSeoLang {
  const raw = String(localeCandidate || "en")
    .toLowerCase()
    .split("-")[0];
  return raw === "es" ? "es" : "en";
}

const brand = () => getBrandName();
const tagline = () => getBrandTagline();

const HUB = {
  en: {
    h1: "Car rental in Spain",
    seoTitle: () =>
      `Car Rental in Spain | ${tagline()} | ${brand()}`,
    seoDescription: () =>
      `Rent a car in Spain with ${brand()}. ${tagline()} Local partner fleets, transparent pricing, and easy online booking with flexible pickup and return.`,
    introText: () =>
      `${brand()} connects you with local car rental partners across Spain. Clear terms, easy booking, and flexible pickup options.`,
  },
  es: {
    h1: "Alquiler de coches en España",
    seoTitle: () =>
      `Alquiler de coches en España | ${tagline()} | ${brand()}`,
    seoDescription: () =>
      `Alquila un coche en España con ${brand()}. ${tagline()} Flotas locales asociadas, precios transparentes y reserva online sencilla con recogida y devolución flexibles.`,
    introText: () =>
      `${brand()} te conecta con socios locales de alquiler de coches en España. Condiciones claras, reserva fácil y opciones de recogida flexibles.`,
  },
} as const;

const CAR = {
  en: {
    seoTitleTemplate: `Rent {carModel} in Spain | ${brand()}`,
    seoDescriptionTemplate: `Book {carModel} car rental in Spain with ${brand()}. Pickup near {locationName}. {transmission} transmission, air conditioning, fuel efficient.`,
    carH1Template: "Rent {carModel} in {locationName}",
    introTemplate: `The {carModel} is available for rent in {locationName}, Spain, with flexible pickup and return. {transmission} transmission, {fuelType} fuel, {seats} seats.`,
    introLongTemplate: `Rent the {carModel} in {locationName} with ${brand()}. Ideal for city trips and coastal drives across Spain. {transmission} transmission and air conditioning included. Book online for clear terms and easy confirmation.`,
  },
  es: {
    seoTitleTemplate: `Alquila {carModel} en España | ${brand()}`,
    seoDescriptionTemplate: `Reserva el alquiler de {carModel} en España con ${brand()}. Recogida cerca de {locationName}. Cambio {transmission}, aire acondicionado, eficiente.`,
    carH1Template: "Alquila {carModel} en {locationName}",
    introTemplate: `El {carModel} está disponible para alquilar en {locationName}, España, con recogida y devolución flexibles. Cambio {transmission}, combustible {fuelType}, {seats} plazas.`,
    introLongTemplate: `Alquila el {carModel} en {locationName} con ${brand()}. Ideal para ciudad y costa en España. Cambio {transmission} y aire acondicionado. Reserva online con condiciones claras.`,
  },
} as const;

const STATIC = {
  en: {
    contacts: {
      seoTitle: () => `Contact ${brand()} | Car Rental Spain`,
      seoDescription: () =>
        `Contact ${brand()} for booking questions, pickup planning, and support for car rental in Spain.`,
    },
    privacy: {
      seoTitle: () => `Privacy Policy | ${brand()}`,
      seoDescription: () =>
        `Read how ${brand()} processes and protects personal data for bookings in Spain.`,
    },
    terms: {
      seoTitle: () => `Terms of Service | ${brand()}`,
      seoDescription: () =>
        `Review ${brand()} service terms and booking responsibilities for car rental in Spain.`,
    },
    cookies: {
      seoTitle: () => `Cookie Policy | ${brand()}`,
      seoDescription: () =>
        `Learn which cookies ${brand()} uses for booking flow, analytics, and website performance.`,
    },
    rentalTerms: {
      seoTitle: () => `Rental Terms | ${brand()}`,
      seoDescription: () =>
        `Rental conditions, insurance options, and pickup rules for car hire in Spain with ${brand()}.`,
    },
  },
  es: {
    contacts: {
      seoTitle: () => `Contacto ${brand()} | Alquiler de coches España`,
      seoDescription: () =>
        `Contacta con ${brand()} para reservas, recogida y soporte de alquiler de coches en España.`,
    },
    privacy: {
      seoTitle: () => `Política de privacidad | ${brand()}`,
      seoDescription: () =>
        `Cómo ${brand()} trata y protege los datos personales de las reservas en España.`,
    },
    terms: {
      seoTitle: () => `Términos del servicio | ${brand()}`,
      seoDescription: () =>
        `Términos del servicio y obligaciones de reserva de ${brand()} para alquiler en España.`,
    },
    cookies: {
      seoTitle: () => `Política de cookies | ${brand()}`,
      seoDescription: () =>
        `Qué cookies usa ${brand()} para el flujo de reserva, analítica y rendimiento del sitio.`,
    },
    rentalTerms: {
      seoTitle: () => `Condiciones de alquiler | ${brand()}`,
      seoDescription: () =>
        `Condiciones de alquiler, seguros y normas de recogida en España con ${brand()}.`,
    },
  },
} as const;

export function getSpainHubSeo(localeCandidate: string | undefined | null) {
  const lang = resolveSpainSeoLang(localeCandidate);
  const hub = HUB[lang];
  return {
    locale: lang,
    h1: hub.h1,
    seoTitle: hub.seoTitle(),
    seoDescription: hub.seoDescription(),
    introText: hub.introText(),
  };
}

export function getSpainCarTemplates(localeCandidate: string | undefined | null) {
  return CAR[resolveSpainSeoLang(localeCandidate)];
}

export function getSpainStaticPageSeo(
  localeCandidate: string | undefined | null,
  pageKey: string
) {
  const lang = resolveSpainSeoLang(localeCandidate);
  const map: Record<string, { seoTitle: () => string; seoDescription: () => string }> = {
    contacts: STATIC[lang].contacts,
    "privacy-policy": STATIC[lang].privacy,
    "terms-of-service": STATIC[lang].terms,
    "cookie-policy": STATIC[lang].cookies,
    "rental-terms": STATIC[lang].rentalTerms,
    terms: STATIC[lang].rentalTerms,
  };
  const page = map[pageKey] || STATIC[lang].contacts;
  return {
    locale: lang,
    seoTitle: page.seoTitle(),
    seoDescription: page.seoDescription(),
  };
}

/** Default area names for AutoRental JSON-LD on Spain hub. */
export function getSpainAreaServedNames() {
  return ["Spain", "Madrid", "Barcelona", "Valencia", "Málaga", "Seville"];
}

export function getSpainPrimaryLocationForJsonLd(
  localeCandidate: string | undefined | null
) {
  const hub = getSpainHubSeo(localeCandidate);
  const lang = resolveSpainSeoLang(localeCandidate);
  return {
    seoDescription: hub.seoDescription,
    areaServed: getSpainAreaServedNames(),
    pickupLocation: lang === "es" ? "España" : "Spain",
    offerName:
      lang === "es"
        ? `Alquiler de coches con ${brand()}`
        : `Car rental with ${brand()}`,
    offerDescription: hub.seoDescription,
  };
}
