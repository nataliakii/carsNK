/**
 * Spain SEO location landings (Barcelona + Costa Brava).
 * Locales: en, es, ru, uk, de, fr, sv, no
 */

import { getBrandName, getBrandTagline } from "@config/brand";

export const SPAIN_SEO_LOCALES = [
  "en",
  "es",
  "ru",
  "uk",
  "de",
  "fr",
  "sv",
  "no",
] as const;

export type SpainSeoLocale = (typeof SPAIN_SEO_LOCALES)[number];

export const SPAIN_LOCATION_IDS = {
  BARCELONA: "barcelona",
  COSTA_BRAVA: "costa-brava",
} as const;

export type SpainLocationId =
  (typeof SPAIN_LOCATION_IDS)[keyof typeof SPAIN_LOCATION_IDS];

type LocaleCopy = {
  name: string;
  shortName: string;
  slug: string;
  h1: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  whyTitle: string;
  whyItems: string[];
  tipsTitle: string;
  tips: string[];
  ctaLabel: string;
};

type SpainLocationDef = {
  id: SpainLocationId;
  kind: "city" | "region";
  copy: Record<SpainSeoLocale, LocaleCopy>;
};

const brand = () => getBrandName();
const tagline = () => getBrandTagline();

function L(
  partial: Record<SpainSeoLocale, LocaleCopy>
): Record<SpainSeoLocale, LocaleCopy> {
  return partial;
}

export const SPAIN_LOCATIONS: SpainLocationDef[] = [
  {
    id: SPAIN_LOCATION_IDS.BARCELONA,
    kind: "city",
    copy: L({
      en: {
        name: "Barcelona",
        shortName: "Barcelona",
        slug: "car-rental-barcelona",
        h1: "Car rental in Barcelona",
        seoTitle: `Car Rental Barcelona | ${tagline()} | ${brand()}`,
        seoDescription: `Rent a car in Barcelona with ${brand()}. ${tagline()} Easy online booking, clear terms, and flexible pickup near the city and airport.`,
        intro: `${brand()} helps you book a rental car in Barcelona with transparent pricing and local partner fleets. Ideal for city days and trips along the Catalan coast.`,
        whyTitle: "Why rent a car in Barcelona",
        whyItems: [
          "Reach beaches and day trips beyond the metro map",
          "Flexible pickup options with clear rental terms",
          `Easy online booking with ${brand()}`,
        ],
        tipsTitle: "Useful tips",
        tips: [
          "Compare airport vs city pickup if you arrive by plane",
          "Check ZBE low-emission rules before driving downtown",
          "Costa Brava is an easy coastal drive from Barcelona",
        ],
        ctaLabel: "Search cars",
      },
      es: {
        name: "Barcelona",
        shortName: "Barcelona",
        slug: "alquiler-coches-barcelona",
        h1: "Alquiler de coches en Barcelona",
        seoTitle: `Alquiler de coches Barcelona | ${tagline()} | ${brand()}`,
        seoDescription: `Alquila un coche en Barcelona con ${brand()}. ${tagline()} Reserva online fácil, condiciones claras y recogida flexible en la ciudad o cerca del aeropuerto.`,
        intro: `${brand()} te ayuda a reservar un coche de alquiler en Barcelona con precios transparentes y flotas locales. Ideal para la ciudad y escapadas por la costa catalana.`,
        whyTitle: "Por qué alquilar un coche en Barcelona",
        whyItems: [
          "Llega a playas y excursiones fuera del mapa del metro",
          "Opciones de recogida flexibles con condiciones claras",
          `Reserva online sencilla con ${brand()}`,
        ],
        tipsTitle: "Consejos útiles",
        tips: [
          "Compara recogida en aeropuerto vs ciudad si llegas en avión",
          "Revisa las normas ZBE antes de circular por el centro",
          "La Costa Brava está a un corto trayecto desde Barcelona",
        ],
        ctaLabel: "Buscar coches",
      },
      ru: {
        name: "Барселона",
        shortName: "Барселона",
        slug: "arenda-avto-barselona",
        h1: "Аренда авто в Барселоне",
        seoTitle: `Аренда авто Барселона | ${tagline()} | ${brand()}`,
        seoDescription: `Арендуйте авто в Барселоне с ${brand()}. ${tagline()} Простое онлайн-бронирование, понятные условия и гибкая выдача в городе или у аэропорта.`,
        intro: `${brand()} помогает забронировать аренду авто в Барселоне с прозрачными ценами и локальными партнёрами. Удобно для города и поездок по каталонскому побережью.`,
        whyTitle: "Зачем арендовать авто в Барселоне",
        whyItems: [
          "Доезжайте до пляжей и мест за пределами метро",
          "Гибкая выдача и понятные условия аренды",
          `Простое онлайн-бронирование с ${brand()}`,
        ],
        tipsTitle: "Полезные советы",
        tips: [
          "Сравните выдачу в аэропорту и в городе",
          "Учитывайте зону ZBE в центре Барселоны",
          "Коста-Брава — удобная поездка из Барселоны",
        ],
        ctaLabel: "Смотреть авто",
      },
      uk: {
        name: "Барселона",
        shortName: "Барселона",
        slug: "orenda-avto-barselona",
        h1: "Оренда авто в Барселоні",
        seoTitle: `Оренда авто Барселона | ${tagline()} | ${brand()}`,
        seoDescription: `Орендуйте авто в Барселоні з ${brand()}. ${tagline()} Зручне онлайн-бронювання, зрозумілі умови та гнучка видача в місті чи біля аеропорту.`,
        intro: `${brand()} допомагає забронювати оренду авто в Барселоні з прозорими цінами та локальними партнерами. Зручно для міста й поїздок уздовж каталонського узбережжя.`,
        whyTitle: "Навіщо орендувати авто в Барселоні",
        whyItems: [
          "Діставайтеся пляжів і місць поза картою метро",
          "Гнучка видача та зрозумілі умови оренди",
          `Зручне онлайн-бронювання з ${brand()}`,
        ],
        tipsTitle: "Корисні поради",
        tips: [
          "Порівняйте видачу в аеропорту та в місті",
          "Враховуйте зону ZBE в центрі Барселони",
          "Коста-Брава — зручна поїздка з Барселони",
        ],
        ctaLabel: "Шукати авто",
      },
      de: {
        name: "Barcelona",
        shortName: "Barcelona",
        slug: "mietwagen-barcelona",
        h1: "Mietwagen in Barcelona",
        seoTitle: `Mietwagen Barcelona | ${tagline()} | ${brand()}`,
        seoDescription: `Mietwagen in Barcelona mit ${brand()}. ${tagline()} Einfache Online-Buchung, klare Konditionen und flexible Abholung in der Stadt oder am Flughafen.`,
        intro: `${brand()} hilft dir, einen Mietwagen in Barcelona mit transparenten Preisen und lokalen Partnerflotten zu buchen — ideal für Stadt und Küstenausflüge.`,
        whyTitle: "Warum in Barcelona einen Wagen mieten",
        whyItems: [
          "Strände und Ausflüge jenseits der Metro erreichen",
          "Flexible Abholung mit klaren Mietbedingungen",
          `Einfache Online-Buchung mit ${brand()}`,
        ],
        tipsTitle: "Nützliche Tipps",
        tips: [
          "Flughafen- vs. Stadt-Abholung vergleichen",
          "ZBE-Umweltzone im Zentrum beachten",
          "Die Costa Brava ist von Barcelona gut erreichbar",
        ],
        ctaLabel: "Autos suchen",
      },
      fr: {
        name: "Barcelone",
        shortName: "Barcelone",
        slug: "location-voiture-barcelone",
        h1: "Location de voiture à Barcelone",
        seoTitle: `Location voiture Barcelone | ${tagline()} | ${brand()}`,
        seoDescription: `Louez une voiture à Barcelone avec ${brand()}. ${tagline()} Réservation en ligne simple, conditions claires et prise en charge flexible en ville ou près de l'aéroport.`,
        intro: `${brand()} vous aide à réserver une voiture de location à Barcelone avec des tarifs transparents et des flottes partenaires locales — idéal pour la ville et la côte catalane.`,
        whyTitle: "Pourquoi louer une voiture à Barcelone",
        whyItems: [
          "Accédez aux plages et excursions hors du métro",
          "Prise en charge flexible et conditions claires",
          `Réservation en ligne simple avec ${brand()}`,
        ],
        tipsTitle: "Conseils utiles",
        tips: [
          "Comparez aéroport vs centre-ville pour la prise en charge",
          "Vérifiez la zone ZBE avant de circuler au centre",
          "La Costa Brava est facilement accessible depuis Barcelone",
        ],
        ctaLabel: "Voir les voitures",
      },
      sv: {
        name: "Barcelona",
        shortName: "Barcelona",
        slug: "hyrbil-barcelona",
        h1: "Hyrbil i Barcelona",
        seoTitle: `Hyrbil Barcelona | ${tagline()} | ${brand()}`,
        seoDescription: `Hyr bil i Barcelona med ${brand()}. ${tagline()} Enkel onlinebokning, tydliga villkor och flexibel upphämtning i staden eller nära flygplatsen.`,
        intro: `${brand()} hjälper dig boka hyrbil i Barcelona med transparenta priser och lokala partnerflottor — perfekt för staden och katalanska kusten.`,
        whyTitle: "Varför hyra bil i Barcelona",
        whyItems: [
          "Nå stränder och utflykter utanför tunnelbanan",
          "Flexibel upphämtning med tydliga hyresvillkor",
          `Enkel onlinebokning med ${brand()}`,
        ],
        tipsTitle: "Användbara tips",
        tips: [
          "Jämför flygplats vs stad för upphämtning",
          "Kolla ZBE-regler i centrala Barcelona",
          "Costa Brava är en enkel bilresa från Barcelona",
        ],
        ctaLabel: "Sök bilar",
      },
      no: {
        name: "Barcelona",
        shortName: "Barcelona",
        slug: "leiebil-barcelona",
        h1: "Leiebil i Barcelona",
        seoTitle: `Leiebil Barcelona | ${tagline()} | ${brand()}`,
        seoDescription: `Lei bil i Barcelona med ${brand()}. ${tagline()} Enkel netbookning, tydelige vilkår og fleksibel henting i byen eller nær flyplassen.`,
        intro: `${brand()} hjelper deg å booke leiebil i Barcelona med transparente priser og lokale partnerflåter — ideelt for byen og den katalanske kysten.`,
        whyTitle: "Hvorfor leie bil i Barcelona",
        whyItems: [
          "Nå strender og turer utenfor metroen",
          "Fleksibel henting med tydelige leievilkår",
          `Enkel netbookning med ${brand()}`,
        ],
        tipsTitle: "Nyttige tips",
        tips: [
          "Sammenlign flyplass vs by for henting",
          "Sjekk ZBE-regler i sentrum av Barcelona",
          "Costa Brava er en enkel bilreise fra Barcelona",
        ],
        ctaLabel: "Søk biler",
      },
    }),
  },
  {
    id: SPAIN_LOCATION_IDS.COSTA_BRAVA,
    kind: "region",
    copy: L({
      en: {
        name: "Costa Brava",
        shortName: "Costa Brava",
        slug: "car-rental-costa-brava",
        h1: "Car rental on the Costa Brava",
        seoTitle: `Car Rental Costa Brava | ${tagline()} | ${brand()}`,
        seoDescription: `Rent a car on the Costa Brava with ${brand()}. ${tagline()} Explore coastal towns from Barcelona with clear terms and easy online booking.`,
        intro: `The Costa Brava sits just north of Barcelona — cliffs, coves, and coastal towns. ${brand()} connects you with local rental partners so you can explore at your own pace.`,
        whyTitle: "Why rent a car on the Costa Brava",
        whyItems: [
          "Reach coves and villages that public transport skips",
          "Combine Barcelona with a coastal road trip",
          `Book online with clear terms via ${brand()}`,
        ],
        tipsTitle: "Useful tips",
        tips: [
          "Barcelona is the natural pickup hub for Costa Brava trips",
          "Summer traffic is busier — book ahead for peak weeks",
          "Plan fuel and parking in smaller coastal towns",
        ],
        ctaLabel: "Search cars",
      },
      es: {
        name: "Costa Brava",
        shortName: "Costa Brava",
        slug: "alquiler-coches-costa-brava",
        h1: "Alquiler de coches en la Costa Brava",
        seoTitle: `Alquiler de coches Costa Brava | ${tagline()} | ${brand()}`,
        seoDescription: `Alquila un coche en la Costa Brava con ${brand()}. ${tagline()} Explora pueblos costeros desde Barcelona con condiciones claras y reserva online fácil.`,
        intro: `La Costa Brava está al norte de Barcelona: acantilados, calas y pueblos. ${brand()} te conecta con socios locales de alquiler para recorrerla a tu ritmo.`,
        whyTitle: "Por qué alquilar un coche en la Costa Brava",
        whyItems: [
          "Llega a calas y pueblos sin buen transporte público",
          "Combina Barcelona con una ruta por la costa",
          `Reserva online con condiciones claras en ${brand()}`,
        ],
        tipsTitle: "Consejos útiles",
        tips: [
          "Barcelona es el hub natural de recogida para la Costa Brava",
          "En verano hay más tráfico: reserva con antelación",
          "Planifica combustible y parking en pueblos pequeños",
        ],
        ctaLabel: "Buscar coches",
      },
      ru: {
        name: "Коста-Брава",
        shortName: "Коста-Брава",
        slug: "arenda-avto-kosta-brava",
        h1: "Аренда авто на Коста-Браве",
        seoTitle: `Аренда авто Коста-Брава | ${tagline()} | ${brand()}`,
        seoDescription: `Арендуйте авто на Коста-Браве с ${brand()}. ${tagline()} Исследуйте побережье от Барселоны с понятными условиями и простым онлайн-бронированием.`,
        intro: `Коста-Брава — к северу от Барселоны: скалы, бухты и прибрежные городки. ${brand()} соединяет вас с локальными партнёрами по аренде.`,
        whyTitle: "Зачем арендовать авто на Коста-Браве",
        whyItems: [
          "Доезжайте до бухт и посёлков без удобного транспорта",
          "Совместите Барселону с поездкой по побережью",
          `Бронируйте онлайн с понятными условиями через ${brand()}`,
        ],
        tipsTitle: "Полезные советы",
        tips: [
          "Барселона — удобная точка выдачи для Коста-Бравы",
          "Летом больше трафика — бронируйте заранее",
          "Заранее планируйте парковку в небольших городках",
        ],
        ctaLabel: "Смотреть авто",
      },
      uk: {
        name: "Коста-Брава",
        shortName: "Коста-Брава",
        slug: "orenda-avto-kosta-brava",
        h1: "Оренда авто на Коста-Браві",
        seoTitle: `Оренда авто Коста-Брава | ${tagline()} | ${brand()}`,
        seoDescription: `Орендуйте авто на Коста-Браві з ${brand()}. ${tagline()} Досліджуйте узбережжя від Барселони зі зрозумілими умовами та зручним онлайн-бронюванням.`,
        intro: `Коста-Брава — на північ від Барселони: скелі, бухти й прибережні містечка. ${brand()} з'єднує вас із локальними партнерами з оренди.`,
        whyTitle: "Навіщо орендувати авто на Коста-Браві",
        whyItems: [
          "Діставайтеся бухт і селищ без зручного транспорту",
          "Поєднайте Барселону з поїздкою уздовж узбережжя",
          `Бронюйте онлайн зі зрозумілими умовами через ${brand()}`,
        ],
        tipsTitle: "Корисні поради",
        tips: [
          "Барселона — зручна точка видачі для Коста-Брави",
          "Влітку більше трафіку — бронюйте заздалегідь",
          "Заздалегідь плануйте паркування в невеликих містечках",
        ],
        ctaLabel: "Шукати авто",
      },
      de: {
        name: "Costa Brava",
        shortName: "Costa Brava",
        slug: "mietwagen-costa-brava",
        h1: "Mietwagen an der Costa Brava",
        seoTitle: `Mietwagen Costa Brava | ${tagline()} | ${brand()}`,
        seoDescription: `Mietwagen an der Costa Brava mit ${brand()}. ${tagline()} Küstenorte von Barcelona aus entdecken — klare Konditionen und einfache Online-Buchung.`,
        intro: `Die Costa Brava liegt nördlich von Barcelona: Klippen, Buchten und Küstenorte. ${brand()} verbindet dich mit lokalen Mietpartnern.`,
        whyTitle: "Warum an der Costa Brava mieten",
        whyItems: [
          "Buchten und Dörfer ohne guten ÖPNV erreichen",
          "Barcelona mit einer Küstenroute kombinieren",
          `Online buchen mit klaren Konditionen über ${brand()}`,
        ],
        tipsTitle: "Nützliche Tipps",
        tips: [
          "Barcelona ist der natürliche Abholpunkt für die Costa Brava",
          "Im Sommer mehr Verkehr — rechtzeitig buchen",
          "Parkplätze in kleineren Orten einplanen",
        ],
        ctaLabel: "Autos suchen",
      },
      fr: {
        name: "Costa Brava",
        shortName: "Costa Brava",
        slug: "location-voiture-costa-brava",
        h1: "Location de voiture sur la Costa Brava",
        seoTitle: `Location voiture Costa Brava | ${tagline()} | ${brand()}`,
        seoDescription: `Louez une voiture sur la Costa Brava avec ${brand()}. ${tagline()} Explorez la côte depuis Barcelone avec des conditions claires et une réservation simple.`,
        intro: `La Costa Brava se trouve au nord de Barcelone : falaises, criques et villages. ${brand()} vous relie à des partenaires de location locaux.`,
        whyTitle: "Pourquoi louer sur la Costa Brava",
        whyItems: [
          "Atteignez criques et villages mal desservis",
          "Combinez Barcelone et une route côtière",
          `Réservez en ligne avec des conditions claires via ${brand()}`,
        ],
        tipsTitle: "Conseils utiles",
        tips: [
          "Barcelone est le hub naturel de prise en charge",
          "En été, plus de trafic — réservez à l'avance",
          "Anticipez le parking dans les petits villages",
        ],
        ctaLabel: "Voir les voitures",
      },
      sv: {
        name: "Costa Brava",
        shortName: "Costa Brava",
        slug: "hyrbil-costa-brava",
        h1: "Hyrbil på Costa Brava",
        seoTitle: `Hyrbil Costa Brava | ${tagline()} | ${brand()}`,
        seoDescription: `Hyr bil på Costa Brava med ${brand()}. ${tagline()} Upptäck kusten från Barcelona med tydliga villkor och enkel onlinebokning.`,
        intro: `Costa Brava ligger norr om Barcelona: klippor, vikar och kustorter. ${brand()} kopplar dig till lokala hyrbilspartners.`,
        whyTitle: "Varför hyra bil på Costa Brava",
        whyItems: [
          "Nå vikar och byar utan bra kollektivtrafik",
          "Kombinera Barcelona med en kustresa",
          `Boka online med tydliga villkor via ${brand()}`,
        ],
        tipsTitle: "Användbara tips",
        tips: [
          "Barcelona är den naturliga upphämtningspunkten",
          "På sommaren mer trafik — boka i förväg",
          "Planera parkering i mindre kustorter",
        ],
        ctaLabel: "Sök bilar",
      },
      no: {
        name: "Costa Brava",
        shortName: "Costa Brava",
        slug: "leiebil-costa-brava",
        h1: "Leiebil på Costa Brava",
        seoTitle: `Leiebil Costa Brava | ${tagline()} | ${brand()}`,
        seoDescription: `Lei bil på Costa Brava med ${brand()}. ${tagline()} Utforsk kysten fra Barcelona med tydelige vilkår og enkel netbookning.`,
        intro: `Costa Brava ligger nord for Barcelona: klipper, viker og kystbyer. ${brand()} kobler deg til lokale leiebilpartnere.`,
        whyTitle: "Hvorfor leie bil på Costa Brava",
        whyItems: [
          "Nå viker og landsbyer uten god kollektivtrafikk",
          "Kombiner Barcelona med en kysttur",
          `Book online med tydelige vilkår via ${brand()}`,
        ],
        tipsTitle: "Nyttige tips",
        tips: [
          "Barcelona er det naturlige hentepunktet",
          "Om sommeren mer trafikk — book i forkant",
          "Planlegg parkering i mindre kystbyer",
        ],
        ctaLabel: "Søk biler",
      },
    }),
  },
];

const SPAIN_LOCALE_SET = new Set<string>(SPAIN_SEO_LOCALES);

export function resolveSpainLocationLocale(
  localeCandidate: string | undefined | null
): SpainSeoLocale {
  const raw = String(localeCandidate || "en")
    .toLowerCase()
    .split("-")[0];
  return SPAIN_LOCALE_SET.has(raw) ? (raw as SpainSeoLocale) : "en";
}

export function getSpainLocationById(id: string): SpainLocationDef | null {
  return SPAIN_LOCATIONS.find((l) => l.id === id) || null;
}

export function getSpainLocationCopy(
  id: string,
  localeCandidate: string | undefined | null
): LocaleCopy | null {
  const loc = getSpainLocationById(id);
  if (!loc) return null;
  const lang = resolveSpainLocationLocale(localeCandidate);
  return loc.copy[lang] || loc.copy.en;
}

export function getSpainLocationBySlug(
  localeCandidate: string | undefined | null,
  slug: string
): SpainLocationDef | null {
  const lang = resolveSpainLocationLocale(localeCandidate);
  const needle = String(slug || "").trim().toLowerCase();
  if (!needle) return null;
  return (
    SPAIN_LOCATIONS.find((loc) => {
      const forLang = loc.copy[lang]?.slug?.toLowerCase();
      if (forLang === needle) return true;
      return SPAIN_SEO_LOCALES.some((l) => loc.copy[l]?.slug?.toLowerCase() === needle);
    }) || null
  );
}

export function getSpainLocationPath(
  localeCandidate: string | undefined | null,
  locationId: string
): string | null {
  const copy = getSpainLocationCopy(locationId, localeCandidate);
  if (!copy?.slug) return null;
  const lang = resolveSpainLocationLocale(localeCandidate);
  return `/${lang}/locations/${copy.slug}`;
}

export function getSpainLocationGroupsForNav(
  localeCandidate: string | undefined | null
): Array<{ href: string; label: string }> {
  const lang = resolveSpainLocationLocale(localeCandidate);
  return SPAIN_LOCATIONS.map((loc) => {
    const copy = loc.copy[lang] || loc.copy.en;
    return {
      href: `/${lang}/locations/${copy.slug}`,
      label: copy.shortName,
    };
  });
}

export function getSpainLocationAlternates(
  locationId: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const lang of SPAIN_SEO_LOCALES) {
    const path = getSpainLocationPath(lang, locationId);
    if (path) out[lang] = path;
  }
  return out;
}

export function getSpainLocationsIndexAlternates(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const lang of SPAIN_SEO_LOCALES) {
    out[lang] = `/${lang}/locations`;
  }
  return out;
}

export function listSpainLocationStaticParams(): Array<{
  locale: SpainSeoLocale;
  path: string[];
}> {
  const params: Array<{ locale: SpainSeoLocale; path: string[] }> = [];
  for (const lang of SPAIN_SEO_LOCALES) {
    params.push({ locale: lang, path: [] });
    for (const loc of SPAIN_LOCATIONS) {
      const slug = loc.copy[lang]?.slug || loc.copy.en.slug;
      params.push({ locale: lang, path: [slug] });
    }
  }
  return params;
}
