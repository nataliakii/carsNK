import {
  LOCATION_IDS,
  SUPPORTED_LOCALES,
  type LocationId,
  type SupportedLocale,
} from "@domain/locationSeo/locationSeoKeys";
import type {
  CarCategoryDefinition,
  CarCategoryFilter,
  SeoLocationDefinition,
  SeoPageEntry,
  ProgrammaticPageEntry,
  BrandPageEntry,
  CarCategorySeoContent,
} from "./types";

// ---------------------------------------------------------------------------
// SEO locations — the 4 primary markets
// ---------------------------------------------------------------------------

// Single source of truth for location page URLs: /{locale}/locations/{seoSlugByLocale[locale]}
export const SEO_LOCATIONS: SeoLocationDefinition[] = [
  {
    id: "halkidiki",
    locationId: LOCATION_IDS.HALKIDIKI,
    seoSlugByLocale: {
      en: "car-rental-halkidiki",
      ru: "arenda-avto-halkidiki",
      uk: "orenda-avto-halkidiki",
      el: "enoikiasi-autokinitou-halkidiki",
      de: "mietwagen-halkidiki",
      bg: "koli-pod-naem-halkidiki",
      ro: "inchirieri-auto-halkidiki",
      sr: "rent-a-car-halkidiki",
      pl: "car-rental-halkidiki",
    },
    nameByLocale: {
      en: "Halkidiki", ru: "Халкидики", uk: "Халкідіки", el: "Χαλκιδική",
      de: "Chalkidiki", bg: "Халкидики", ro: "Halkidiki", sr: "Halkidiki",
      pl: "Chalkidiki",
    },
  },
  {
    id: "thessaloniki-airport",
    locationId: LOCATION_IDS.THESSALONIKI_AIRPORT,
    seoSlugByLocale: {
      en: "car-rental-thessaloniki-airport",
      ru: "arenda-avto-aeroport-saloniki",
      uk: "orenda-avto-aeroport-saloniky",
      el: "enoikiasi-autokinitou-aerodromio-thessalonikis",
      de: "mietwagen-thessaloniki-flughafen",
      bg: "koli-pod-naem-letishte-solun",
      ro: "inchirieri-auto-aeroport-salonic",
      sr: "rent-a-car-aerodrom-solun",
      pl: "car-rental-thessaloniki-airport",
    },
    nameByLocale: {
      en: "Thessaloniki Airport", ru: "аэропорт Салоники", uk: "аеропорт Салоніки",
      el: "Αεροδρόμιο Θεσσαλονίκης", de: "Flughafen Thessaloniki",
      bg: "летище Солун", ro: "Aeroportul Salonic", sr: "Aerodrom Solun",
      pl: "Lotnisko Saloniki",
    },
  },
  {
    id: "nea-kallikratia",
    locationId: LOCATION_IDS.NEA_KALLIKRATIA,
    seoSlugByLocale: {
      en: "car-rental-nea-kallikratia",
      ru: "arenda-avto-nea-kallikratia",
      uk: "orenda-avto-nea-kallikratia",
      el: "enoikiasi-autokinitou-nea-kallikratia",
      de: "mietwagen-nea-kallikratia",
      bg: "koli-pod-naem-nea-kallikratia",
      ro: "inchirieri-auto-nea-kallikratia",
      sr: "rent-a-car-nea-kallikratia",
      pl: "car-rental-nea-kallikratia",
    },
    nameByLocale: {
      en: "Nea Kallikratia", ru: "Неа Каликратия", uk: "Неа Калікратія",
      el: "Νέα Καλλικράτεια", de: "Nea Kallikratia", bg: "Неа Каликратия",
      ro: "Nea Kallikratia", sr: "Nea Kalikratija",
      pl: "Nea Kallikratia",
    },
  },
  {
    id: "thessaloniki",
    locationId: LOCATION_IDS.THESSALONIKI,
    seoSlugByLocale: {
      en: "car-rental-thessaloniki",
      ru: "arenda-avto-saloniki",
      uk: "orenda-avto-saloniky",
      el: "enoikiasi-autokinitou-thessaloniki",
      de: "mietwagen-thessaloniki",
      bg: "koli-pod-naem-solun",
      ro: "inchirieri-auto-salonic",
      sr: "rent-a-car-solun",
      pl: "car-rental-thessaloniki",
    },
    nameByLocale: {
      en: "Thessaloniki", ru: "Салоники", uk: "Салоніки",
      el: "Θεσσαλονίκη", de: "Thessaloniki", bg: "Солун",
      ro: "Salonic", sr: "Solun",
      pl: "Saloniki",
    },
  },
];

/** Single source: SEO_LOCATIONS. Returns slug for /{locale}/locations/{slug}; fallback to en. */
export function getLocationSeoSlug(locationId: LocationId, locale: SupportedLocale): string | undefined {
  const entry = SEO_LOCATIONS.find((e) => e.locationId === locationId);
  if (!entry?.seoSlugByLocale) return undefined;
  return entry.seoSlugByLocale[locale] ?? entry.seoSlugByLocale.en;
}

/** Resolve locale + slug to locationId from SEO_LOCATIONS (fallback to en slug). */
export function getLocationIdBySeoSlug(locale: SupportedLocale, slug: string): LocationId | undefined {
  const entry = SEO_LOCATIONS.find(
    (e) =>
      e.seoSlugByLocale?.[locale] === slug || e.seoSlugByLocale?.en === slug
  );
  return entry?.locationId as LocationId | undefined;
}

// ---------------------------------------------------------------------------
// Car category definitions — 5 categories × 4 locations = 20 pages
// ---------------------------------------------------------------------------

function expandContent(
  partial: Partial<Record<SupportedLocale, CarCategorySeoContent>> & { en: CarCategorySeoContent }
): Record<SupportedLocale, CarCategorySeoContent> {
  const fallback = partial.en;
  return SUPPORTED_LOCALES.reduce((acc, locale) => {
    acc[locale] = partial[locale] || fallback;
    return acc;
  }, {} as Record<SupportedLocale, CarCategorySeoContent>);
}

/** Category IDs for "Browse by category" block on location pages. Edit here to change which categories appear. */
export const BROWSE_BY_CATEGORY_IDS = [
  "automatic",
  "cheap",
  "family",
  "luxury",
  "cabrio",
] as const;

/** Max number of cars in "Popular cars in this location" block. Edit here to change limit (6–8). */
export const POPULAR_CARS_LIMIT = 8;

export const CAR_CATEGORIES: CarCategoryDefinition[] = [
  // ── AUTOMATIC ──────────────────────────────────────────────────
  {
    id: "automatic",
    filter: { type: "transmission", value: "automatic" },
    content: expandContent({
      en: {
        h1: "Automatic Car Rental in {location}",
        seoTitle: "Automatic Car Rental in {location} | Natali Cars",
        seoDescription: "Rent an automatic car in {location} with Natali Cars. Wide selection of automatic transmission vehicles. Free pickup at {location}. Book online today.",
        introText: "Looking for an automatic car rental in {location}? Natali Cars offers a great selection of vehicles with automatic transmission — perfect for comfortable driving on Greek roads. Whether you're arriving at Thessaloniki Airport or staying in Halkidiki, our automatic cars are easy to drive and fuel-efficient. All vehicles come with full insurance, air conditioning, and free cancellation. We provide convenient pickup and return in {location} and across the Halkidiki peninsula. Our fleet includes economy automatics like Toyota Yaris, compact crossovers, and premium sedans. Enjoy a stress-free holiday — no clutch, no gear shifting, just smooth driving along the beautiful coastline. Book your automatic rental car online and secure the best rates for your trip to {location}.",
        faq: [
          { question: "Do you have automatic cars available in {location}?", answer: "Yes, Natali Cars offers a wide range of automatic transmission vehicles available for pickup in {location} and surrounding areas." },
          { question: "Is an automatic car more expensive to rent?", answer: "Automatic cars may have a small premium over manual options, but we offer competitive rates starting from €20/day depending on the season." },
          { question: "Can I pick up an automatic car at Thessaloniki Airport?", answer: "Absolutely! We offer free airport pickup and delivery for all our automatic rental cars." },
          { question: "Do I need an international driving license?", answer: "EU driving licenses are accepted. Non-EU visitors should carry an International Driving Permit along with their national license." },
          { question: "Is insurance included with automatic car rental?", answer: "Yes, all our rental cars come with comprehensive insurance included in the price." },
        ],
      },
      ru: {
        h1: "Аренда автомата в {location}",
        seoTitle: "Аренда авто с автоматом в {location} | Natali Cars",
        seoDescription: "Арендуйте авто с автоматической коробкой в {location}. Широкий выбор автомобилей АКПП. Бесплатная подача в {location}. Бронируйте онлайн.",
        introText: "Ищете автомобиль с автоматической коробкой передач в {location}? Natali Cars предлагает отличный выбор авто с АКПП — идеальный вариант для комфортного вождения по греческим дорогам. Будь то прилёт в аэропорт Салоники или отдых на Халкидиках, наши машины с автоматом просты в управлении и экономичны. Все автомобили застрахованы, оснащены кондиционером, с возможностью бесплатной отмены. Мы предоставляем удобную подачу и возврат в {location} и по всему полуострову Халкидики. Наш автопарк включает экономичные автоматы Toyota Yaris, компактные кроссоверы и премиальные седаны. Наслаждайтесь отдыхом без забот — без сцепления, без переключения передач, только плавная езда вдоль красивого побережья. Забронируйте авто с автоматом онлайн и получите лучшие цены для поездки в {location}.",
        faq: [
          { question: "Есть ли у вас автомобили с автоматом в {location}?", answer: "Да, Natali Cars предлагает широкий выбор автомобилей с АКПП для подачи в {location} и окрестностях." },
          { question: "Автомат дороже в аренду?", answer: "Автомобили с АКПП могут стоить немного дороже механики, но мы предлагаем конкурентные цены от €20/день в зависимости от сезона." },
          { question: "Можно забрать авто с автоматом в аэропорту Салоники?", answer: "Конечно! Мы бесплатно доставляем все арендованные автомобили в аэропорт и обратно." },
          { question: "Нужны ли международные права?", answer: "Водительские удостоверения ЕС принимаются. Гражданам других стран рекомендуется международное водительское удостоверение." },
          { question: "Включена ли страховка?", answer: "Да, все наши авто застрахованы — страховка включена в стоимость аренды." },
        ],
      },
      uk: {
        h1: "Оренда авто з автоматом у {location}",
        seoTitle: "Оренда авто з автоматом у {location} | Natali Cars",
        seoDescription: "Орендуйте авто з автоматичною коробкою у {location}. Широкий вибір автомобілів АКПП. Безкоштовна подача в {location}. Бронюйте онлайн.",
        introText: "Шукаєте авто з автоматичною коробкою передач у {location}? Natali Cars пропонує чудовий вибір автомобілів з АКПП — ідеальний варіант для комфортного водіння по грецьких дорогах. Чи то приліт в аеропорт Салоніки, чи відпочинок на Халкідіках — наші авто з автоматом прості в управлінні та економічні. Усі авто застраховані, з кондиціонером та можливістю безкоштовного скасування. Ми пропонуємо зручну подачу та повернення в {location} та по всьому Халкідіках. Наш автопарк включає економічні автомати Toyota Yaris, кросовери та преміальні седани. Насолоджуйтесь відпочинком без турбот — без зчеплення, без перемикання передач, лише плавна їзда вздовж красивого узбережжя.",
        faq: [
          { question: "Чи є у вас авто з автоматом у {location}?", answer: "Так, Natali Cars пропонує широкий вибір авто з АКПП для подачі в {location} та околицях." },
          { question: "Авто з автоматом дорожче?", answer: "Авто з АКПП можуть коштувати трохи більше за механіку, але ми пропонуємо конкурентні ціни від €20/день залежно від сезону." },
          { question: "Чи можна забрати авто з автоматом в аеропорту Салоніки?", answer: "Звичайно! Ми безкоштовно доставляємо всі орендовані авто в аеропорт." },
          { question: "Чи потрібні міжнародні права?", answer: "Посвідчення водія ЄС приймаються. Громадянам інших країн рекомендується міжнародне посвідчення." },
          { question: "Чи включена страховка?", answer: "Так, усі наші авто застраховані — страховка включена у вартість оренди." },
        ],
      },
      el: {
        h1: "Ενοικίαση αυτόματου αυτοκινήτου στη {location}",
        seoTitle: "Ενοικίαση αυτόματου αυτοκινήτου στη {location} | Natali Cars",
        seoDescription: "Νοικιάστε αυτόματο αυτοκίνητο στη {location} με την Natali Cars. Μεγάλη ποικιλία αυτοκινήτων με αυτόματο κιβώτιο. Δωρεάν παραλαβή στη {location}.",
        introText: "Ψάχνετε ενοικίαση αυτοκινήτου με αυτόματο κιβώτιο στη {location}; Η Natali Cars προσφέρει μια εξαιρετική γκάμα αυτοκινήτων με αυτόματο κιβώτιο ταχυτήτων — ιδανικά για άνετη οδήγηση στους ελληνικούς δρόμους. Είτε φτάνετε στο Αεροδρόμιο Θεσσαλονίκης είτε μένετε στη Χαλκιδική, τα αυτόματα αυτοκίνητά μας είναι εύκολα στην οδήγηση και οικονομικά. Όλα τα οχήματα περιλαμβάνουν πλήρη ασφάλεια, κλιματισμό και δωρεάν ακύρωση. Παρέχουμε άνετη παραλαβή και επιστροφή στη {location} και σε ολόκληρη τη χερσόνησο της Χαλκιδικής.",
        faq: [
          { question: "Έχετε αυτόματα αυτοκίνητα στη {location};", answer: "Ναι, η Natali Cars προσφέρει μεγάλη ποικιλία αυτοκινήτων με αυτόματο κιβώτιο για παραλαβή στη {location}." },
          { question: "Είναι πιο ακριβό το αυτόματο;", answer: "Τα αυτόματα αυτοκίνητα μπορεί να κοστίζουν ελαφρώς περισσότερο, αλλά προσφέρουμε ανταγωνιστικές τιμές από €20/ημέρα." },
          { question: "Μπορώ να παραλάβω στο αεροδρόμιο;", answer: "Φυσικά! Προσφέρουμε δωρεάν παραλαβή και παράδοση στο αεροδρόμιο Θεσσαλονίκης." },
          { question: "Χρειάζομαι διεθνές δίπλωμα;", answer: "Τα ευρωπαϊκά διπλώματα οδήγησης γίνονται αποδεκτά. Οι υπόλοιποι επισκέπτες χρειάζονται διεθνές δίπλωμα." },
          { question: "Περιλαμβάνεται ασφάλεια;", answer: "Ναι, όλα τα ενοικιαζόμενα αυτοκίνητα περιλαμβάνουν πλήρη ασφάλεια στην τιμή." },
        ],
      },
    }),
  },

  // ── CHEAP / ECONOMY ────────────────────────────────────────────
  {
    id: "cheap",
    filter: { type: "classes", value: ["economy", "compact"] },
    content: expandContent({
      en: {
        h1: "Cheap Car Rental in {location}",
        seoTitle: "Cheap Car Rental in {location} — From €15/day | Natali Cars",
        seoDescription: "Affordable car rental in {location} starting from €15/day. Economy and compact cars with full insurance. Free pickup in {location}. Book the cheapest rental car online.",
        introText: "Looking for a cheap car rental in {location}? Natali Cars offers some of the best rates in the region with economy and compact cars starting from just €15 per day. Our affordable fleet is perfect for budget-conscious travelers who still want reliable, well-maintained vehicles. Every rental includes comprehensive insurance, air conditioning, and free cancellation — no hidden fees, no surprises. Whether you need a small city car for exploring Halkidiki or a compact hatchback for airport transfers, we have affordable options waiting for you. Pick up your car in {location} or at Thessaloniki Airport with zero extra delivery charges. Our economy range includes popular models like Fiat Panda, Hyundai i10, and Toyota Yaris — small on price, big on value. Save money on your Greek holiday without sacrificing comfort. Book online and lock in the lowest available rate for your dates.",
        faq: [
          { question: "What is the cheapest car you can rent in {location}?", answer: "Our most affordable cars start from €15/day in low season. Economy models like Fiat Panda and Hyundai i10 are the cheapest options." },
          { question: "Are there hidden fees with cheap car rental?", answer: "No. Our prices include full insurance, taxes, and unlimited mileage. No hidden charges." },
          { question: "Can I get a cheap rental with automatic transmission?", answer: "We have a few economy automatics. Availability varies by season — book early for the best selection." },
          { question: "Is a deposit required for budget car rental?", answer: "Some economy cars require no deposit at all. Others may require a small refundable deposit." },
          { question: "Do cheap rental cars include insurance?", answer: "Yes, all our vehicles — including budget options — come with comprehensive insurance included." },
        ],
      },
      ru: {
        h1: "Дешёвая аренда авто в {location}",
        seoTitle: "Дешёвая аренда авто в {location} — от €15/день | Natali Cars",
        seoDescription: "Бюджетная аренда авто в {location} от €15/день. Эконом и компакт-класс с полной страховкой. Бесплатная подача в {location}. Бронируйте онлайн.",
        introText: "Ищете недорогую аренду авто в {location}? Natali Cars предлагает одни из лучших цен в регионе — от €15 в день за автомобили эконом- и компакт-класса. Наш автопарк идеально подходит бюджетным путешественникам, которые хотят надёжные и ухоженные машины. Каждая аренда включает полную страховку, кондиционер и бесплатную отмену — без скрытых платежей. Нужен маленький городской авто для Халкидиков или компактный хэтчбек для трансфера из аэропорта? У нас есть доступные варианты. Получите автомобиль в {location} или в аэропорту Салоники без дополнительной платы за доставку. В нашем эконом-сегменте — Fiat Panda, Hyundai i10, Toyota Yaris. Экономьте на отдыхе в Греции без потери комфорта.",
        faq: [
          { question: "Какой самый дешёвый авто в {location}?", answer: "Самые доступные авто — от €15/день в низкий сезон. Эконом-модели Fiat Panda и Hyundai i10 — самые бюджетные." },
          { question: "Есть ли скрытые платежи?", answer: "Нет. Цены включают полную страховку, налоги и безлимитный пробег. Никаких скрытых доплат." },
          { question: "Можно ли недорого арендовать автомат?", answer: "У нас есть несколько автоматов эконом-класса. Наличие зависит от сезона — бронируйте заранее." },
          { question: "Нужен ли депозит для бюджетного авто?", answer: "Некоторые эконом-авто не требуют депозита. Для других может потребоваться небольшой возвратный залог." },
          { question: "Включена ли страховка в дешёвую аренду?", answer: "Да, все наши авто, включая бюджетные, застрахованы — страховка включена в стоимость." },
        ],
      },
      uk: {
        h1: "Дешева оренда авто у {location}",
        seoTitle: "Дешева оренда авто у {location} — від €15/день | Natali Cars",
        seoDescription: "Бюджетна оренда авто у {location} від €15/день. Економ та компакт-клас з повним страхуванням. Безкоштовна подача у {location}.",
        introText: "Шукаєте недорогу оренду авто у {location}? Natali Cars пропонує одні з найкращих цін у регіоні — від €15 на день за авто економ- та компакт-класу. Наш автопарк ідеально підходить бюджетним мандрівникам, які хочуть надійні та доглянуті машини. Кожна оренда включає повне страхування, кондиціонер та безкоштовне скасування. Потрібен маленький міський авто для Халкідіків або компактний хетчбек? У нас є доступні варіанти. Отримайте авто у {location} або в аеропорту Салоніки без додаткової плати за доставку.",
        faq: [
          { question: "Яке найдешевше авто у {location}?", answer: "Найдоступніші авто — від €15/день у низький сезон. Економ-моделі Fiat Panda та Hyundai i10 — найбюджетніші." },
          { question: "Чи є приховані платежі?", answer: "Ні. Ціни включають повне страхування, податки та безлімітний пробіг." },
          { question: "Чи можна недорого орендувати автомат?", answer: "У нас є кілька автоматів економ-класу. Наявність залежить від сезону." },
          { question: "Чи потрібен депозит?", answer: "Деякі економ-авто не потребують депозиту. Для інших може знадобитися невеликий залог." },
          { question: "Чи включене страхування?", answer: "Так, усі наші авто, включаючи бюджетні, застраховані." },
        ],
      },
      el: {
        h1: "Φθηνή ενοικίαση αυτοκινήτου στη {location}",
        seoTitle: "Φθηνή ενοικίαση αυτοκινήτου στη {location} — από €15/ημέρα | Natali Cars",
        seoDescription: "Οικονομική ενοικίαση αυτοκινήτου στη {location} από €15/ημέρα. Αυτοκίνητα κατηγορίας economy και compact με πλήρη ασφάλεια. Δωρεάν παραλαβή.",
        introText: "Ψάχνετε φθηνή ενοικίαση αυτοκινήτου στη {location}; Η Natali Cars προσφέρει εξαιρετικές τιμές με αυτοκίνητα economy και compact από μόλις €15 την ημέρα. Ο στόλος μας είναι ιδανικός για ταξιδιώτες με περιορισμένο προϋπολογισμό που θέλουν αξιόπιστα, καλοσυντηρημένα οχήματα. Κάθε ενοικίαση περιλαμβάνει πλήρη ασφάλεια, κλιματισμό και δωρεάν ακύρωση — χωρίς κρυφές χρεώσεις. Παραλάβετε το αυτοκίνητό σας στη {location} ή στο Αεροδρόμιο Θεσσαλονίκης χωρίς επιπλέον κόστος παράδοσης.",
        faq: [
          { question: "Ποιο είναι το φθηνότερο αυτοκίνητο στη {location};", answer: "Τα πιο οικονομικά μας αυτοκίνητα ξεκινούν από €15/ημέρα. Μοντέλα economy όπως Fiat Panda είναι τα πιο φθηνά." },
          { question: "Υπάρχουν κρυφές χρεώσεις;", answer: "Όχι. Οι τιμές μας περιλαμβάνουν πλήρη ασφάλεια, φόρους και απεριόριστα χιλιόμετρα." },
          { question: "Χρειάζεται εγγύηση;", answer: "Ορισμένα οικονομικά αυτοκίνητα δεν απαιτούν καθόλου εγγύηση." },
          { question: "Περιλαμβάνεται ασφάλεια;", answer: "Ναι, όλα τα οχήματα, συμπεριλαμβανομένων των οικονομικών, περιλαμβάνουν πλήρη ασφάλεια." },
          { question: "Μπορώ να παραλάβω στο αεροδρόμιο;", answer: "Ναι! Δωρεάν παραλαβή και παράδοση στο αεροδρόμιο Θεσσαλονίκης." },
        ],
      },
    }),
  },

  // ── CABRIO / CONVERTIBLE ───────────────────────────────────────
  {
    id: "cabrio",
    filter: { type: "classes", value: ["convertible"] },
    content: expandContent({
      en: {
        h1: "Cabrio Car Rental in {location}",
        seoTitle: "Convertible Car Rental in {location} | Natali Cars",
        seoDescription: "Rent a convertible in {location} with Natali Cars. Enjoy the Greek sunshine with a cabrio. Free pickup in {location}. Book your cabriolet online.",
        introText: "There's no better way to experience {location} than behind the wheel of a convertible. Feel the warm Mediterranean breeze, enjoy panoramic views of the turquoise sea, and make every drive an unforgettable experience. Natali Cars offers stylish cabriolets perfect for the Greek summer. Our convertible fleet includes popular models like the Fiat 500 Cabrio — compact enough for village streets yet fun enough for coastal highways. Every cabrio rental includes comprehensive insurance, air conditioning (for when you want it), and free cancellation. Pick up your convertible in {location} or at Thessaloniki Airport and cruise along the stunning Halkidiki coastline. Whether it's a romantic getaway, a beach-hopping adventure, or simply the joy of open-top driving under the Greek sun — our cabrios deliver the ultimate holiday experience. Book online and secure your dream car today.",
        faq: [
          { question: "Do you have convertibles available in {location}?", answer: "Yes! We offer convertible models like the Fiat 500 Cabrio for rent in {location} and across Halkidiki." },
          { question: "Is renting a convertible more expensive?", answer: "Convertibles are slightly above economy rates, but offer a unique driving experience. Contact us for current pricing." },
          { question: "Can I take the cabrio on unpaved roads?", answer: "We recommend sticking to paved roads for convertible vehicles to avoid damage to the soft top." },
          { question: "Do convertibles have air conditioning?", answer: "Yes, all our convertibles come equipped with air conditioning." },
          { question: "Can I pick up a cabrio at the airport?", answer: "Yes, we offer free airport pickup and delivery for all vehicle types including convertibles." },
        ],
      },
      ru: {
        h1: "Аренда кабриолета в {location}",
        seoTitle: "Аренда кабриолета в {location} | Natali Cars",
        seoDescription: "Арендуйте кабриолет в {location} с Natali Cars. Наслаждайтесь греческим солнцем с открытым верхом. Бесплатная подача. Бронируйте онлайн.",
        introText: "Нет лучшего способа познакомиться с {location}, чем за рулём кабриолета. Почувствуйте тёплый средиземноморский бриз, наслаждайтесь панорамными видами на бирюзовое море. Natali Cars предлагает стильные кабриолеты для греческого лета. В нашем автопарке — Fiat 500 Cabrio — компактные для узких улочек и достаточно весёлые для прибрежных шоссе. Каждая аренда включает полную страховку, кондиционер и бесплатную отмену. Получите кабриолет в {location} или в аэропорту Салоники. Романтическое путешествие, пляжные приключения или просто удовольствие от езды с открытым верхом — наши кабриолеты подарят незабываемый отпуск.",
        faq: [
          { question: "Есть ли у вас кабриолеты в {location}?", answer: "Да! Мы предлагаем кабриолеты, включая Fiat 500 Cabrio, для аренды в {location} и по всему Халкидики." },
          { question: "Кабриолет дороже в аренде?", answer: "Кабриолеты стоят немного выше эконом-класса, но дарят уникальный опыт. Свяжитесь с нами для актуальных цен." },
          { question: "Можно ли ехать на кабриолете по грунтовым дорогам?", answer: "Рекомендуем использовать кабриолет на асфальтированных дорогах для сохранности мягкого верха." },
          { question: "Есть ли кондиционер в кабриолетах?", answer: "Да, все наши кабриолеты оснащены кондиционером." },
          { question: "Можно забрать кабриолет в аэропорту?", answer: "Да, бесплатная подача и возврат в аэропорту для всех типов авто, включая кабриолеты." },
        ],
      },
      uk: {
        h1: "Оренда кабріолета у {location}",
        seoTitle: "Оренда кабріолета у {location} | Natali Cars",
        seoDescription: "Орендуйте кабріолет у {location} з Natali Cars. Насолоджуйтесь грецьким сонцем з відкритим верхом. Безкоштовна подача. Бронюйте онлайн.",
        introText: "Немає кращого способу пізнати {location}, ніж за кермом кабріолета. Відчуйте теплий середземноморський бриз та панорамні краєвиди. Natali Cars пропонує стильні кабріолети для грецького літа. Наш автопарк включає Fiat 500 Cabrio — компактний для вузьких вуличок та достатньо веселий для прибережних шосе. Кожна оренда включає повне страхування, кондиціонер та безкоштовне скасування.",
        faq: [
          { question: "Чи є у вас кабріолети у {location}?", answer: "Так! Ми пропонуємо Fiat 500 Cabrio для оренди у {location}." },
          { question: "Кабріолет дорожче?", answer: "Трохи вище економ-класу, але дарує унікальний досвід." },
          { question: "Чи є кондиціонер?", answer: "Так, усі кабріолети оснащені кондиціонером." },
          { question: "Можна забрати в аеропорту?", answer: "Так, безкоштовна подача в аеропорт Салоніки." },
          { question: "Чи включене страхування?", answer: "Так, повне страхування включене у вартість." },
        ],
      },
      el: {
        h1: "Ενοικίαση κάμπριο στη {location}",
        seoTitle: "Ενοικίαση κάμπριο στη {location} | Natali Cars",
        seoDescription: "Νοικιάστε κάμπριο στη {location} με την Natali Cars. Απολαύστε τον ελληνικό ήλιο. Δωρεάν παραλαβή. Κλείστε online.",
        introText: "Δεν υπάρχει καλύτερος τρόπος να ζήσετε τη {location} από πίσω από το τιμόνι ενός κάμπριο. Νιώστε τη ζεστή μεσογειακή αύρα και απολαύστε τη θέα. Η Natali Cars προσφέρει κομψά κάμπριο για το ελληνικό καλοκαίρι. Κάθε ενοικίαση περιλαμβάνει πλήρη ασφάλεια, κλιματισμό και δωρεάν ακύρωση. Παραλάβετε στη {location} ή στο αεροδρόμιο.",
        faq: [
          { question: "Έχετε κάμπριο στη {location};", answer: "Ναι! Προσφέρουμε κάμπριο μοντέλα στη {location}." },
          { question: "Είναι πιο ακριβό;", answer: "Ελαφρώς υψηλότερες τιμές, αλλά μοναδική εμπειρία." },
          { question: "Παραλαβή στο αεροδρόμιο;", answer: "Ναι, δωρεάν παραλαβή στο αεροδρόμιο Θεσσαλονίκης." },
          { question: "Έχει κλιματισμό;", answer: "Ναι, όλα τα κάμπριο διαθέτουν κλιματισμό." },
          { question: "Περιλαμβάνεται ασφάλεια;", answer: "Ναι, πλήρης ασφάλεια περιλαμβάνεται." },
        ],
      },
    }),
  },

  // ── FAMILY ─────────────────────────────────────────────────────
  {
    id: "family",
    filter: { type: "familySeats", minSeats: 5 },
    content: expandContent({
      en: {
        h1: "Family Car Rental in {location}",
        seoTitle: "Family Car Rental in {location} | Natali Cars",
        seoDescription: "Rent a family car in {location} with Natali Cars. Spacious vehicles with 5+ seats, ideal for family holidays. Free pickup in {location}. Book online.",
        introText: "Planning a family holiday in {location}? Natali Cars offers spacious, comfortable vehicles perfect for families. Our family car fleet includes crossovers, minivans, and large sedans — all with 5 or more seats, plenty of luggage space, and child-friendly features. Every family rental comes with comprehensive insurance, air conditioning, and free cancellation. Whether you're exploring the beaches of Kassandra, visiting the natural beauty of Sithonia, or touring the villages of Halkidiki — our family cars provide the space, safety, and comfort your family deserves. Pick up your car in {location} or at Thessaloniki Airport with free delivery. Our family range includes roomy models perfect for car seats, strollers, and all the essentials for a relaxing Greek getaway. Book your family car online and enjoy stress-free travel across northern Greece.",
        faq: [
          { question: "What family cars do you have in {location}?", answer: "We offer crossovers, minivans, and spacious sedans with 5+ seats, perfect for families traveling with children." },
          { question: "Can I add a child car seat?", answer: "Yes, child seats and booster seats are available on request. Please mention this when booking." },
          { question: "Do family cars have enough luggage space?", answer: "Absolutely. Our family vehicles are selected for generous boot space to accommodate strollers and luggage." },
          { question: "Is pickup at the airport available?", answer: "Yes! We offer free pickup and delivery at Thessaloniki Airport for all family vehicles." },
          { question: "Do family cars come with insurance?", answer: "Yes, all vehicles including family cars come with comprehensive insurance included." },
        ],
      },
      ru: {
        h1: "Аренда семейного авто в {location}",
        seoTitle: "Аренда семейного авто в {location} | Natali Cars",
        seoDescription: "Арендуйте семейный автомобиль в {location}. Просторные авто от 5 мест для семейного отдыха. Бесплатная подача в {location}. Бронируйте онлайн.",
        introText: "Планируете семейный отпуск в {location}? Natali Cars предлагает просторные и комфортные автомобили для семей. Наш семейный автопарк включает кроссоверы, минивэны и большие седаны — от 5 мест, много места для багажа, идеальные для путешествия с детьми. Каждая аренда включает полную страховку, кондиционер и бесплатную отмену. Исследуйте пляжи Кассандры, красоту Ситонии или деревни Халкидиков. Получите авто в {location} или в аэропорту Салоники бесплатно. Забронируйте онлайн и наслаждайтесь комфортным путешествием по северной Греции.",
        faq: [
          { question: "Какие семейные авто есть в {location}?", answer: "Кроссоверы, минивэны и просторные седаны от 5 мест — идеальны для семей с детьми." },
          { question: "Можно ли добавить детское кресло?", answer: "Да, детские кресла доступны по запросу. Укажите при бронировании." },
          { question: "Достаточно ли места для багажа?", answer: "Да, наши семейные авто выбраны за вместительный багажник — для колясок и чемоданов." },
          { question: "Есть подача в аэропорт?", answer: "Да, бесплатная подача и возврат в аэропорту Салоники." },
          { question: "Включена ли страховка?", answer: "Да, все авто включают полную страховку." },
        ],
      },
      uk: {
        h1: "Оренда сімейного авто у {location}",
        seoTitle: "Оренда сімейного авто у {location} | Natali Cars",
        seoDescription: "Орендуйте сімейне авто у {location}. Просторні автомобілі від 5 місць для сімейного відпочинку. Безкоштовна подача. Бронюйте онлайн.",
        introText: "Плануєте сімейну відпустку у {location}? Natali Cars пропонує просторні та комфортні авто для сімей. Наш сімейний автопарк включає кросовери, мінівени та великі седани — від 5 місць, багато місця для багажу. Кожна оренда включає повне страхування, кондиціонер та безкоштовне скасування. Отримайте авто у {location} або в аеропорту Салоніки безкоштовно.",
        faq: [
          { question: "Які сімейні авто є у {location}?", answer: "Кросовери, мінівени та просторні седани від 5 місць." },
          { question: "Чи можна додати дитяче крісло?", answer: "Так, дитячі крісла доступні за запитом." },
          { question: "Чи достатньо місця для багажу?", answer: "Так, наші сімейні авто мають вмісткий багажник." },
          { question: "Чи є подача в аеропорт?", answer: "Так, безкоштовна подача в аеропорт Салоніки." },
          { question: "Чи включене страхування?", answer: "Так, усі авто застраховані." },
        ],
      },
      el: {
        h1: "Ενοικίαση οικογενειακού αυτοκινήτου στη {location}",
        seoTitle: "Ενοικίαση οικογενειακού αυτοκινήτου στη {location} | Natali Cars",
        seoDescription: "Νοικιάστε οικογενειακό αυτοκίνητο στη {location}. Ευρύχωρα οχήματα 5+ θέσεων. Δωρεάν παραλαβή στη {location}.",
        introText: "Σχεδιάζετε οικογενειακές διακοπές στη {location}; Η Natali Cars προσφέρει ευρύχωρα, άνετα οχήματα για οικογένειες. Ο στόλος μας περιλαμβάνει crossover, minivan και μεγάλα σεντάν — 5+ θέσεις, μεγάλο χώρο αποσκευών. Κάθε ενοικίαση περιλαμβάνει ασφάλεια, κλιματισμό και δωρεάν ακύρωση.",
        faq: [
          { question: "Τι οικογενειακά αυτοκίνητα έχετε;", answer: "Crossover, minivan και ευρύχωρα σεντάν με 5+ θέσεις." },
          { question: "Μπορώ να προσθέσω παιδικό κάθισμα;", answer: "Ναι, παιδικά καθίσματα διατίθενται κατόπιν αιτήματος." },
          { question: "Παραλαβή στο αεροδρόμιο;", answer: "Ναι, δωρεάν παραλαβή στο αεροδρόμιο Θεσσαλονίκης." },
          { question: "Περιλαμβάνεται ασφάλεια;", answer: "Ναι, πλήρης ασφάλεια περιλαμβάνεται." },
          { question: "Υπάρχει χώρος αποσκευών;", answer: "Ναι, μεγάλοι χώροι αποσκευών για καρότσια και βαλίτσες." },
        ],
      },
    }),
  },

  // ── LUXURY / PREMIUM ───────────────────────────────────────────
  {
    id: "luxury",
    filter: { type: "classes", value: ["premium", "limousine"] },
    content: expandContent({
      en: {
        h1: "Luxury Car Rental in {location}",
        seoTitle: "Luxury Car Rental in {location} | Natali Cars",
        seoDescription: "Rent a luxury car in {location} with Natali Cars. Premium and executive vehicles for a sophisticated driving experience. Free delivery in {location}.",
        introText: "Elevate your {location} experience with a luxury car from Natali Cars. Our premium fleet features sophisticated sedans and executive vehicles that combine power, comfort, and style. Whether you're attending a special event, impressing business partners, or simply treating yourself to the best — our luxury cars deliver an unparalleled driving experience on the scenic roads of Halkidiki. Every premium rental includes comprehensive insurance, premium road assistance, and free delivery anywhere in {location}. Enjoy leather interiors, advanced technology, and the prestige of arriving in style. From Thessaloniki Airport to the exclusive resorts of Sani and Kassandra — make your journey as memorable as the destination. Book your luxury rental online and experience the finest driving in northern Greece.",
        faq: [
          { question: "What luxury cars are available in {location}?", answer: "Our premium fleet includes executive sedans and luxury vehicles. Contact us for current availability." },
          { question: "Is airport delivery included for luxury cars?", answer: "Yes, free pickup and delivery at Thessaloniki Airport is included for all luxury rentals." },
          { question: "What insurance do luxury cars include?", answer: "All premium vehicles come with comprehensive insurance and premium road assistance." },
          { question: "Can I rent a luxury car for a wedding or event?", answer: "Absolutely! We offer special packages for weddings, events, and VIP occasions." },
          { question: "Is a larger deposit required for premium cars?", answer: "Premium vehicles may require a higher deposit. Contact us for specific details." },
        ],
      },
      ru: {
        h1: "Аренда премиум авто в {location}",
        seoTitle: "Аренда люкс автомобиля в {location} | Natali Cars",
        seoDescription: "Арендуйте премиум автомобиль в {location}. Люкс и бизнес-класс для изысканного вождения. Бесплатная доставка в {location}.",
        introText: "Поднимите ваш отдых в {location} на новый уровень с премиальным авто от Natali Cars. Наш люкс-автопарк включает изысканные седаны и бизнес-автомобили. Будь то особое мероприятие, деловая встреча или желание побаловать себя — наши премиум-авто обеспечат непревзойдённый опыт вождения по живописным дорогам Халкидиков. Каждая аренда включает полную страховку, премиум помощь на дороге и бесплатную доставку по {location}. Кожаный салон, передовые технологии и престиж. Забронируйте онлайн.",
        faq: [
          { question: "Какие премиум авто есть в {location}?", answer: "Бизнес-седаны и люкс-автомобили. Свяжитесь с нами для актуального наличия." },
          { question: "Доставка в аэропорт включена?", answer: "Да, бесплатная подача и возврат в аэропорту Салоники." },
          { question: "Какая страховка у премиум авто?", answer: "Все премиальные авто включают полную страховку и помощь на дороге." },
          { question: "Можно арендовать на свадьбу?", answer: "Конечно! Специальные условия для свадеб и мероприятий." },
          { question: "Нужен ли больший депозит?", answer: "Для премиум-авто может потребоваться повышенный депозит. Свяжитесь для деталей." },
        ],
      },
      uk: {
        h1: "Оренда преміум авто у {location}",
        seoTitle: "Оренда люкс автомобіля у {location} | Natali Cars",
        seoDescription: "Орендуйте преміум автомобіль у {location}. Люкс та бізнес-клас для вишуканого водіння. Безкоштовна доставка у {location}.",
        introText: "Підніміть ваш відпочинок у {location} на новий рівень з преміальним авто від Natali Cars. Наш люкс-автопарк включає вишукані седани та бізнес-автомобілі. Кожна оренда включає повне страхування, преміум допомогу на дорозі та безкоштовну доставку.",
        faq: [
          { question: "Які преміум авто є у {location}?", answer: "Бізнес-седани та люкс-авто. Зверніться для актуальної наявності." },
          { question: "Доставка в аеропорт включена?", answer: "Так, безкоштовна подача в аеропорт Салоніки." },
          { question: "Яке страхування?", answer: "Усі преміальні авто включають повне страхування та допомогу на дорозі." },
          { question: "Чи можна орендувати на весілля?", answer: "Звичайно! Спеціальні умови для весіль та заходів." },
          { question: "Чи потрібен більший депозит?", answer: "Для преміум-авто може знадобитися підвищений депозит." },
        ],
      },
      el: {
        h1: "Ενοικίαση πολυτελούς αυτοκινήτου στη {location}",
        seoTitle: "Ενοικίαση πολυτελούς αυτοκινήτου στη {location} | Natali Cars",
        seoDescription: "Νοικιάστε πολυτελές αυτοκίνητο στη {location}. Premium και executive οχήματα. Δωρεάν παράδοση στη {location}.",
        introText: "Αναβαθμίστε την εμπειρία σας στη {location} με ένα πολυτελές αυτοκίνητο. Ο premium στόλος μας περιλαμβάνει κομψά σεντάν και executive οχήματα. Κάθε ενοικίαση περιλαμβάνει πλήρη ασφάλεια και δωρεάν παράδοση.",
        faq: [
          { question: "Τι πολυτελή αυτοκίνητα έχετε;", answer: "Executive σεντάν και πολυτελή οχήματα. Επικοινωνήστε μαζί μας." },
          { question: "Δωρεάν παραλαβή στο αεροδρόμιο;", answer: "Ναι, δωρεάν παραλαβή στο αεροδρόμιο Θεσσαλονίκης." },
          { question: "Τι ασφάλεια περιλαμβάνεται;", answer: "Πλήρης ασφάλεια και premium οδική βοήθεια." },
          { question: "Για γάμο;", answer: "Φυσικά! Ειδικά πακέτα για γάμους και εκδηλώσεις." },
          { question: "Χρειάζεται μεγαλύτερη εγγύηση;", answer: "Τα premium οχήματα μπορεί να απαιτούν υψηλότερη εγγύηση." },
        ],
      },
    }),
  },
];

// ---------------------------------------------------------------------------
// SEO page slug matrix: {category}-car-rental-{location} (localized via seoSlugByLocale)
// ---------------------------------------------------------------------------

/** Category × location SEO slug for a given locale. Uses centralized getLocationSeoSlug. */
export function getCategoryLocationSeoSlug(
  categoryId: string,
  locationId: string,
  locale: SupportedLocale
): string {
  const locSlug = getLocationSeoSlug(locationId as LocationId, locale);
  return `${categoryId}-car-rental-${locSlug || locationId}`;
}

/** All category×location SEO pages for a locale (localized slugs). */
export function getAllSeoPageSlugs(locale: SupportedLocale): SeoPageEntry[] {
  const entries: SeoPageEntry[] = [];
  for (const category of CAR_CATEGORIES) {
    for (const location of SEO_LOCATIONS) {
      const seoSlug = getCategoryLocationSeoSlug(category.id, location.locationId, locale);
      entries.push({
        seoSlug,
        categoryId: category.id,
        locationId: location.locationId,
      });
    }
  }
  return entries;
}

/** Resolve category×location page by locale and slug (localized seoSlugByLocale). */
export function getSeoPageBySlug(locale: SupportedLocale, slug: string): SeoPageEntry | null {
  for (const category of CAR_CATEGORIES) {
    for (const location of SEO_LOCATIONS) {
      const expected = getCategoryLocationSeoSlug(category.id, location.locationId, locale);
      if (expected === slug) {
        return { seoSlug: slug, categoryId: category.id, locationId: location.locationId };
      }
    }
  }
  return null;
}

export function getCategoryById(id: string): CarCategoryDefinition | null {
  return CAR_CATEGORIES.find((c) => c.id === id) || null;
}

export function getSeoLocationById(id: string): SeoLocationDefinition | null {
  return SEO_LOCATIONS.find((l) => l.locationId === id) || null;
}

/** Find SEO location by localized slug for a locale (seoSlugByLocale). */
export function getSeoLocationBySeoSlug(
  locale: SupportedLocale,
  locationSlug: string
): SeoLocationDefinition | null {
  return (
    SEO_LOCATIONS.find(
      (l) => getLocationSeoSlug(l.locationId as LocationId, locale) === locationSlug
    ) || null
  );
}

/** @deprecated Use getSeoLocationBySeoSlug(locale, slug) with localized slug. */
export function getSeoLocationBySlugSuffix(suffix: string): SeoLocationDefinition | null {
  return SEO_LOCATIONS.find((l) => l.slugSuffix === suffix) || null;
}

/** Localized location slug for a given locale, with English fallback. Uses seoSlugByLocale. */
export function getLocationSlugForLocale(
  location: SeoLocationDefinition,
  locale: SupportedLocale
): string {
  return location.seoSlugByLocale?.[locale] ?? location.seoSlugByLocale?.en ?? "";
}

// ---------------------------------------------------------------------------
// Car filtering logic
// ---------------------------------------------------------------------------

export function filterCarsByCategory(
  cars: Array<Record<string, unknown>>,
  filter: CarCategoryFilter
): Array<Record<string, unknown>> {
  switch (filter.type) {
    case "transmission":
      return cars.filter(
        (c) =>
          typeof c.transmission === "string" &&
          c.transmission.toLowerCase() === (filter.value as string).toLowerCase()
      );
    case "classes":
      return cars.filter(
        (c) =>
          typeof c.class === "string" &&
          (filter.value as string[]).includes(c.class.toLowerCase())
      );
    case "familySeats":
      return cars.filter((c) => {
        const seats = typeof c.seats === "number" ? c.seats : 0;
        const carClass = typeof c.class === "string" ? c.class.toLowerCase() : "";
        return seats >= (filter.minSeats || 5) || ["crossover", "minibus", "combi"].includes(carClass);
      });
    case "cheapest":
      return [...cars].sort((a, b) => {
        const pa = getLowestPrice(a);
        const pb = getLowestPrice(b);
        return pa - pb;
      });
    default:
      return cars;
  }
}

function getLowestPrice(car: Record<string, unknown>): number {
  const tiers = car.pricingTiers as Record<string, { days?: Record<string, number> }> | undefined;
  if (!tiers) return Infinity;
  let min = Infinity;
  for (const tier of Object.values(tiers)) {
    if (tier?.days) {
      for (const price of Object.values(tier.days)) {
        if (typeof price === "number" && price < min) min = price;
      }
    }
  }
  return min;
}

// ---------------------------------------------------------------------------
// Resolve localized content for a page
// ---------------------------------------------------------------------------

export function fillSeoTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    template
  );
}

export function getResolvedCategoryContent(
  categoryId: string,
  locale: SupportedLocale,
  locationName: string
) {
  const category = getCategoryById(categoryId);
  if (!category) return null;

  const content = category.content[locale];
  const values = { location: locationName };

  return {
    h1: fillSeoTemplate(content.h1, values),
    seoTitle: fillSeoTemplate(content.seoTitle, values),
    seoDescription: fillSeoTemplate(content.seoDescription, values),
    introText: fillSeoTemplate(content.introText, values),
    faq: content.faq.map((item) => ({
      question: fillSeoTemplate(item.question, values),
      answer: fillSeoTemplate(item.answer, values),
    })),
  };
}

// ---------------------------------------------------------------------------
// Programmatic pages: {carSlug}-rental-{locationSeoSlug} (localized)
// ---------------------------------------------------------------------------

export function buildProgrammaticSlug(carSlug: string, locationSeoSlug: string): string {
  return `${carSlug}-rental-${locationSeoSlug}`;
}

/** All programmatic slugs for a locale (uses getLocationSeoSlug per location). */
export function buildAllProgrammaticSlugs(
  carSlugs: string[],
  locale: SupportedLocale
): ProgrammaticPageEntry[] {
  const entries: ProgrammaticPageEntry[] = [];
  for (const carSlug of carSlugs) {
    for (const location of SEO_LOCATIONS) {
      const locSlug = getLocationSeoSlug(location.locationId as LocationId, locale);
      const slug = buildProgrammaticSlug(carSlug, locSlug);
      entries.push({ seoSlug: slug, carSlug, locationId: location.locationId });
    }
  }
  return entries;
}

/** Resolve programmatic page by locale and slug (localized seoSlugByLocale). */
export function getProgrammaticPageBySlug(
  locale: SupportedLocale,
  slug: string
): ProgrammaticPageEntry | null {
  for (const location of SEO_LOCATIONS) {
    const suffix = `-rental-${getLocationSeoSlug(location.locationId as LocationId, locale)}`;
    if (!slug.endsWith(suffix)) continue;
    const carSlugCandidate = slug.slice(0, slug.length - suffix.length);
    if (!carSlugCandidate) continue;
    return { seoSlug: slug, carSlug: carSlugCandidate, locationId: location.locationId };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Brand pages: {brand}-car-rental-{locationSuffix}
// ---------------------------------------------------------------------------

const CATEGORY_IDS_SET = new Set(CAR_CATEGORIES.map((c) => c.id));

export function extractBrandFromModel(model: string): string {
  const trimmed = (model || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

function toBrandSlug(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildBrandPageSlug(brandSlug: string, locationSeoSlug: string): string {
  return `${brandSlug}-car-rental-${locationSeoSlug}`;
}

export function extractUniqueBrands(
  cars: Array<Record<string, unknown>>
): Array<{ brand: string; brandSlug: string }> {
  const seen = new Set<string>();
  const result: Array<{ brand: string; brandSlug: string }> = [];

  for (const car of cars) {
    const model = typeof car.model === "string" ? car.model : "";
    const brand = extractBrandFromModel(model);
    if (!brand) continue;

    const slug = toBrandSlug(brand);
    if (!slug || seen.has(slug) || CATEGORY_IDS_SET.has(slug)) continue;

    seen.add(slug);
    result.push({ brand, brandSlug: slug });
  }

  return result;
}

/** All brand×location pages for a locale (uses getLocationSeoSlug). */
export function buildAllBrandPageSlugs(
  cars: Array<Record<string, unknown>>,
  locale: SupportedLocale
): BrandPageEntry[] {
  const brands = extractUniqueBrands(cars);
  const entries: BrandPageEntry[] = [];
  for (const { brand, brandSlug } of brands) {
    for (const location of SEO_LOCATIONS) {
      const locSlug = getLocationSeoSlug(location.locationId as LocationId, locale);
      entries.push({
        seoSlug: buildBrandPageSlug(brandSlug, locSlug),
        brand,
        brandSlug,
        locationId: location.locationId,
        locationSlugSuffix: locSlug,
      });
    }
  }
  return entries;
}

export function filterCarsByBrand(
  cars: Array<Record<string, unknown>>,
  brand: string
): Array<Record<string, unknown>> {
  const normalizedBrand = brand.toLowerCase();
  return cars.filter((car) => {
    const model = typeof car.model === "string" ? car.model : "";
    return extractBrandFromModel(model).toLowerCase() === normalizedBrand;
  });
}

/**
 * Build hreflang alternates for a brand×location page (localized slug per locale).
 * Used by getSeoPageAlternates (brand branch) and by sitemap; keeps page metadata in sync with sitemap.
 */
export function getBrandPageAlternates(
  brandSlug: string,
  locationId: string
): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const loc of SUPPORTED_LOCALES) {
    const slug = buildBrandPageSlug(
      brandSlug,
      getLocationSeoSlug(locationId as LocationId, loc)
    );
    alternates[loc] = getSeoPagePath(loc, slug);
  }
  return alternates;
}

/**
 * Parse a slug for the given locale to extract brandSlug and locationId if it matches brand×location pattern.
 * Used by getSeoPageAlternates to build correct hreflang without needing cars data.
 */
function parseBrandPageSlugParts(
  slug: string,
  locale: SupportedLocale
): { brandSlug: string; locationId: string } | null {
  if (!slug || !slug.includes("-car-rental-")) return null;
  const firstPart = slug.split("-car-rental-")[0];
  if (!firstPart || CATEGORY_IDS_SET.has(firstPart)) return null;

  for (const location of SEO_LOCATIONS) {
    const locSlug = getLocationSeoSlug(location.locationId as LocationId, locale);
    const suffix = `-car-rental-${locSlug}`;
    if (!slug.endsWith(suffix)) continue;

    const brandSlugCandidate = slug.slice(0, slug.length - suffix.length);
    if (!brandSlugCandidate) continue;

    return { brandSlug: brandSlugCandidate, locationId: location.locationId };
  }
  return null;
}

/** Resolve brand page by locale and slug (localized seoSlugByLocale). */
export function resolveBrandFromSlug(
  slug: string,
  cars: Array<Record<string, unknown>>,
  locale: SupportedLocale
): BrandPageEntry | null {
  if (CATEGORY_IDS_SET.has(slug.split("-car-rental-")[0])) return null;

  for (const location of SEO_LOCATIONS) {
    const locSlug = getLocationSeoSlug(location.locationId as LocationId, locale);
    const suffix = `-car-rental-${locSlug}`;
    if (!slug.endsWith(suffix)) continue;

    const brandSlugCandidate = slug.slice(0, slug.length - suffix.length);
    if (!brandSlugCandidate) continue;

    const brands = extractUniqueBrands(cars);
    const matched = brands.find((b) => b.brandSlug === brandSlugCandidate);
    if (matched) {
      return {
        seoSlug: slug,
        brand: matched.brand,
        brandSlug: matched.brandSlug,
        locationId: location.locationId,
        locationSlugSuffix: locSlug,
      };
    }
  }

  return null;
}

const BRAND_SEO_TEMPLATES: Record<
  string,
  { h1: string; seoTitle: string; seoDescription: string; introText: string }
> = {
  en: {
    h1: "{brand} Car Rental in {location}",
    seoTitle: "{brand} Car Rental in {location} | Natali Cars",
    seoDescription: "Rent a {brand} car in {location} with Natali Cars. Browse all available {brand} models with free pickup. Book your {brand} rental online.",
    introText: "Looking for a {brand} rental car in {location}? Natali Cars offers a range of {brand} vehicles available for hire in {location} and across Halkidiki. {brand} cars are known for reliability, comfort, and great value — perfect for your Greek holiday. All rentals include comprehensive insurance, air conditioning, and free cancellation. Pick up your {brand} at Thessaloniki Airport or in {location} with free delivery. Whether you need a compact city car or a spacious family vehicle, we have {brand} options to suit every need. Our {brand} fleet is well-maintained and ready for the beautiful roads of northern Greece. Book online and secure the best rate for your trip.",
  },
  ru: {
    h1: "Аренда {brand} в {location}",
    seoTitle: "Аренда {brand} в {location} | Natali Cars",
    seoDescription: "Арендуйте {brand} в {location} с Natali Cars. Все доступные модели {brand} с бесплатной подачей. Бронируйте онлайн.",
    introText: "Ищете {brand} в аренду в {location}? Natali Cars предлагает автомобили {brand} для аренды в {location} и по всему Халкидики. Автомобили {brand} известны надёжностью, комфортом и отличным соотношением цены и качества — идеальный выбор для отпуска в Греции. Все аренды включают полную страховку, кондиционер и бесплатную отмену. Получите {brand} в аэропорту Салоники или в {location} с бесплатной доставкой. Забронируйте онлайн и получите лучшую цену.",
  },
  uk: {
    h1: "Оренда {brand} у {location}",
    seoTitle: "Оренда {brand} у {location} | Natali Cars",
    seoDescription: "Орендуйте {brand} у {location} з Natali Cars. Усі доступні моделі {brand} з безкоштовною подачею. Бронюйте онлайн.",
    introText: "Шукаєте {brand} в оренду у {location}? Natali Cars пропонує автомобілі {brand} для оренди у {location} та по всьому Халкідіках. Автомобілі {brand} відомі надійністю та комфортом. Усі оренди включають повне страхування, кондиціонер та безкоштовне скасування. Отримайте {brand} в аеропорту Салоніки або у {location} з безкоштовною доставкою.",
  },
  el: {
    h1: "Ενοικίαση {brand} στη {location}",
    seoTitle: "Ενοικίαση {brand} στη {location} | Natali Cars",
    seoDescription: "Νοικιάστε {brand} στη {location} με Natali Cars. Όλα τα διαθέσιμα μοντέλα {brand}. Δωρεάν παραλαβή. Κλείστε online.",
    introText: "Ψάχνετε {brand} για ενοικίαση στη {location}; Η Natali Cars προσφέρει οχήματα {brand} στη {location} και στη Χαλκιδική. Τα αυτοκίνητα {brand} είναι γνωστά για αξιοπιστία και άνεση. Όλες οι ενοικιάσεις περιλαμβάνουν πλήρη ασφάλεια, κλιματισμό και δωρεάν ακύρωση. Παραλάβετε στο αεροδρόμιο ή στη {location}.",
  },
};

export function getResolvedBrandContent(
  brand: string,
  locale: SupportedLocale,
  locationName: string
) {
  const templates = BRAND_SEO_TEMPLATES[locale] || BRAND_SEO_TEMPLATES.en;
  const values = { brand, location: locationName };

  return {
    h1: fillSeoTemplate(templates.h1, values),
    seoTitle: fillSeoTemplate(templates.seoTitle, values),
    seoDescription: fillSeoTemplate(templates.seoDescription, values),
    introText: fillSeoTemplate(templates.introText, values),
  };
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function getSeoPagePath(locale: string, seoSlug: string): string {
  return `/${locale}/${seoSlug}`;
}

/** Alternates for a category×location page (localized slug per locale). */
export function getSeoPageAlternatesForCategoryLocation(
  categoryId: string,
  locationId: string
): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const slug = getCategoryLocationSeoSlug(categoryId, locationId, locale);
    alternates[locale] = getSeoPagePath(locale, slug);
  }
  return alternates;
}

/** Alternates for any SEO page: resolve slug for current locale then build per-locale paths. */
export function getSeoPageAlternates(locale: SupportedLocale, seoSlug: string): Record<string, string> {
  const entry = getSeoPageBySlug(locale, seoSlug);
  if (entry) {
    return getSeoPageAlternatesForCategoryLocation(entry.categoryId, entry.locationId);
  }
  const prog = getProgrammaticPageBySlug(locale, seoSlug);
  if (prog) {
    const alternates: Record<string, string> = {};
    for (const loc of SUPPORTED_LOCALES) {
      const slug = buildProgrammaticSlug(
        prog.carSlug,
        getLocationSeoSlug(prog.locationId as LocationId, loc)
      );
      alternates[loc] = getSeoPagePath(loc, slug);
    }
    return alternates;
  }
  const brandParts = parseBrandPageSlugParts(seoSlug, locale);
  if (brandParts) {
    return getBrandPageAlternates(brandParts.brandSlug, brandParts.locationId);
  }
  const fallback: Record<string, string> = {};
  for (const l of SUPPORTED_LOCALES) {
    fallback[l] = getSeoPagePath(l, seoSlug);
  }
  return fallback;
}
