import { notFound, permanentRedirect } from "next/navigation";
import JsonLdScript from "@app/components/seo/JsonLdScript";
import Feed from "@app/components/Feed";
import SingleCarDisplay from "@app/components/SingleCarDisplay";
import {
  SeoIntroBlock,
  SeoFaqBlock,
  SeoLinksBlock,
  SeoSingleLinkBlock,
  SeoVehicleSpecsBlock,
  SeoBreadcrumbNav,
  SeoQuickSpecsBlock,
  SeoCarFeaturesBlock,
  SeoWhyRentBlock,
  SeoPillarLinksBlock,
} from "@app/components/seo/SeoContentBlocks";
import {
  buildCarSeoText,
  getAllLocationsForLocale,
  getCarPath,
  getLocaleDictionary,
  getLocationById,
  getLocationPathFromLocation,
  getLocationSeoSlug,
  getSupportedLocales,
  isSupportedLocale,
  normalizeLocale,
} from "@domain/locationSeo/locationSeoService";
import { LOCATION_IDS } from "@domain/locationSeo/locationSeoKeys";
import { COMPANY_ID } from "@config/company";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import {
  getCars,
  getCarById,
  getCarBySlug,
  getCompany,
  getActiveOrders,
} from "@/domain/services";
import {
  buildAutoRentalJsonLd,
  buildCarProductJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
} from "@/services/seo/jsonLdBuilder";
import { buildCarMetadata } from "@/services/seo/metadataBuilder";
import { toAbsoluteUrl } from "@/services/seo/urlBuilder";
import {
  CAR_CATEGORIES,
  SEO_LOCATIONS,
  getResolvedCategoryContent,
  getResolvedBrandContent,
  getSeoPagePath,
  buildBrandPageSlug,
  extractBrandFromModel,
  extractUniqueBrands,
} from "@domain/seoPages/seoPageRegistry";

const MONGO_ID_REGEX = /^[0-9a-f]{24}$/i;

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getLowestDailyPrice(car) {
  const tiers = car?.pricingTiers;
  if (!tiers || typeof tiers !== "object") return undefined;
  let min = Infinity;
  for (const tier of Object.values(tiers)) {
    if (tier?.days && typeof tier.days === "object") {
      for (const p of Object.values(tier.days)) {
        if (typeof p === "number" && p < min) min = p;
      }
    }
  }
  return Number.isFinite(min) ? min : undefined;
}

function getPublicCars(cars) {
  return (cars || []).filter(
    (car) =>
      car?.slug &&
      String(car.slug).trim() &&
      car?.isActive !== false &&
      car?.isHidden !== true &&
      !car?.deletedAt
  );
}

export async function generateStaticParams() {
  const cars = await getCars().catch(() => []);
  const publicCars = getPublicCars(cars);
  const locales = getSupportedLocales();

  return locales.flatMap((locale) =>
    publicCars.map((car) => ({ locale, slug: String(car.slug).trim() }))
  );
}

export async function generateMetadata({ params }) {
  const locale = normalizeLocale(params.locale);
  const car = await getCarBySlug(params.slug).catch(() => null);

  if (!car) {
    return { robots: { index: false, follow: false } };
  }

  const fallbackLocation = getLocationById(locale, LOCATION_IDS.HALKIDIKI);
  const locationName = fallbackLocation?.shortName || "Halkidiki";

  // Use DB slug for canonical so /en/cars/Toyota-Yaris and /en/cars/toyota-yaris converge.
  const canonicalSlug = car.slug || params.slug;

  return buildCarMetadata({
    localeCandidate: locale,
    carSlug: canonicalSlug,
    carModel: car.model || canonicalSlug,
    locationName,
    transmission: capitalize(car.transmission),
    fuelType: capitalize(car.fueltype),
    seats: car.seats ? String(car.seats) : "",
  });
}

export default async function LocalizedCarPage({ params }) {
  const locale = normalizeLocale(params.locale);
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const session = await getServerSession(authOptions);

  // MongoDB ObjectId in URL → redirect to real slug
  if (MONGO_ID_REGEX.test(params.slug)) {
    const carById = await getCarById(params.slug, { session }).catch(() => null);
    if (carById?.slug) {
      permanentRedirect(getCarPath(locale, carById.slug));
    }
    notFound();
  }

  // ── Data fetching ──────────────────────────────────────────────────
  const [allCarsData, ordersData, companyData] = await Promise.all([
    getCars({ session }).catch(() => []),
    getActiveOrders({ session }).catch(() => []),
    getCompany(COMPANY_ID).catch(() => null),
  ]);

  const carFromList = (allCarsData || []).find(
    (c) => c?.slug && c.slug.toLowerCase() === params.slug.toLowerCase()
  );

  let resolvedCar = carFromList;
  if (!resolvedCar) {
    const carDirect = await getCarBySlug(params.slug, { session }).catch(() => null);
    if (!carDirect) notFound();
    resolvedCar = carDirect;
  }

  // Redirect to canonical slug when URL differs (e.g. case) to avoid duplicate content.
  if (params.slug !== resolvedCar.slug) {
    permanentRedirect(getCarPath(locale, resolvedCar.slug));
  }

  const car = resolvedCar;

  // ── Locale dictionary & location data ──────────────────────────────
  const dictionary = getLocaleDictionary(locale);
  const carDict = dictionary.car;
  const fallbackLocation =
    getLocationById(locale, LOCATION_IDS.HALKIDIKI) ||
    getAllLocationsForLocale(locale)[0] ||
    null;

  const locationName = fallbackLocation?.shortName || "Halkidiki";
  const carModel = car?.model || car?.slug || params.slug;

  const carSeoText = buildCarSeoText(locale, {
    carModel,
    locationName,
    transmission: capitalize(car?.transmission),
    fuelType: capitalize(car?.fueltype),
    seats: car?.seats ? String(car.seats) : "",
  });

  // ── Pillar links (Car rental in Halkidiki, Car rental at Thessaloniki Airport, etc.) ─
  const pillarLocations = getAllLocationsForLocale(locale).filter((loc) =>
    [LOCATION_IDS.HALKIDIKI, LOCATION_IDS.THESSALONIKI_AIRPORT, LOCATION_IDS.NEA_KALLIKRATIA].includes(loc.id)
  );
  const pillarLinks = pillarLocations.slice(0, 3).map((loc) => ({
    href: getLocationPathFromLocation(locale, loc),
    label: (carDict.breadcrumbCarRentalLocation || "").replace(/\{locationName\}/g, loc.shortName) || `Car rental ${loc.shortName}`,
  }));

  // ── Quick specs (at a glance: Transmission, Fuel, Seats, AC, Luggage) ─
  const quickSpecs = [
    car?.transmission && { label: "Transmission", value: capitalize(car.transmission) },
    car?.fueltype && { label: "Fuel type", value: capitalize(car.fueltype) },
    car?.seats && { label: "Seats", value: String(car.seats) },
    car?.airConditioning != null && { label: "Air conditioning", value: car.airConditioning ? "Yes" : "No" },
    { label: "Luggage", value: "2 suitcases" },
  ].filter(Boolean);

  // ── Car features list (for Features of X block) ─
  const carFeatures = [
    car?.transmission && `${capitalize(car.transmission)} transmission`,
    car?.airConditioning && "Air conditioning",
    "Bluetooth audio",
    "Fuel efficient engine",
    "Compact size – easy parking",
  ].filter(Boolean);

  // ── Pickup locations with links ────────────────────────────────────
  const locationLinks = getAllLocationsForLocale(locale).map((location) => ({
    href: getLocationPathFromLocation(locale, location),
    label: location.shortName,
  }));

  // ── Vehicle specifications ─────────────────────────────────────────
  const vehicleSpecs = [
    car?.transmission && { label: "Transmission", value: capitalize(car.transmission) },
    car?.fueltype && { label: "Fuel Type", value: capitalize(car.fueltype) },
    car?.seats && { label: "Seats", value: String(car.seats) },
    car?.airConditioning != null && { label: "Air Conditioning", value: car.airConditioning ? "Yes" : "No" },
    { label: "Luggage capacity", value: "2 suitcases" },
    car?.numberOfDoors && { label: "Doors", value: String(car.numberOfDoors) },
    car?.enginePower && { label: "Engine Power", value: `${car.enginePower} HP` },
    car?.engine && { label: "Engine", value: `${car.engine} cc` },
    car?.registration && { label: "Year", value: String(car.registration) },
    car?.class && { label: "Class", value: capitalize(car.class) },
    car?.deposit != null && { label: "Deposit", value: car.deposit > 0 ? `${car.deposit} €` : "No deposit" },
  ].filter(Boolean);

  // ── Related cars: same class first, then fill up to 4 ──────────────
  const publicCars = getPublicCars(allCarsData).filter(
    (c) => c.slug !== car?.slug
  );
  const sameClassCars = publicCars.filter(
    (c) => car?.class && c.class === car.class
  );
  const otherCars = publicCars.filter(
    (c) => !car?.class || c.class !== car.class
  );
  const relatedCars = [...sameClassCars, ...otherCars].slice(0, 4);
  const relatedCarLinks = relatedCars.map((c) => ({
    href: getCarPath(locale, c.slug),
    label: c.model || c.slug,
  }));

  // ── Category × location links (cross-linking to SEO landing pages) ─
  const categoryLinks = SEO_LOCATIONS.slice(0, 2).flatMap((location) =>
    CAR_CATEGORIES.filter((cat) => {
      if (cat.filter.type === "transmission" && car?.transmission) {
        return cat.filter.value === car.transmission.toLowerCase();
      }
      if (cat.filter.type === "classes" && car?.class) {
        return (cat.filter.value).includes(car.class.toLowerCase());
      }
      return false;
    }).map((cat) => {
      const locationName = location.nameByLocale[locale];
      const content = getResolvedCategoryContent(cat.id, locale, locationName);
      const locSlug = getLocationSeoSlug(location.locationId, locale);
      return {
        href: getSeoPagePath(locale, `${cat.id}-car-rental-${locSlug}`),
        label: content?.h1 || `${cat.id} car rental`,
      };
    })
  );

  // Add general category links for the main location
  const mainLocation = SEO_LOCATIONS[0];
  const mainLocSlug = getLocationSeoSlug(mainLocation.locationId, locale);
  const generalCategoryLinks = CAR_CATEGORIES
    .filter((cat) => !categoryLinks.some((cl) => cl.href.includes(cat.id)))
    .slice(0, 3)
    .map((cat) => {
      const content = getResolvedCategoryContent(cat.id, locale, mainLocation.nameByLocale[locale]);
      return {
        href: getSeoPagePath(locale, `${cat.id}-car-rental-${mainLocSlug}`),
        label: content?.h1 || `${cat.id} car rental`,
      };
    });

  const allCategoryLinks = [...categoryLinks, ...generalCategoryLinks].slice(0, 5);

  // ── Brand links (link to brand pages for this car's brand) ─────────
  const carBrand = car ? extractBrandFromModel(car.model || "") : "";
  const carBrandSlug = carBrand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const brandLinks = carBrandSlug
    ? SEO_LOCATIONS.slice(0, 2).map((location) => {
        const brandContent = getResolvedBrandContent(carBrand, locale, location.nameByLocale[locale]);
        const locSlug = getLocationSeoSlug(location.locationId, locale);
        return {
          href: getSeoPagePath(locale, buildBrandPageSlug(carBrandSlug, locSlug)),
          label: brandContent.h1,
        };
      })
    : [];

  // ── Breadcrumbs (Home → Cars → Toyota Yaris Automatic) for SEO and internal linking ─
  const breadcrumbItems = [
    { href: `/${locale}`, label: carDict.breadcrumbHome },
    { href: `/${locale}/cars`, label: carDict.breadcrumbCars },
    { href: getCarPath(locale, car?.slug || params.slug), label: carModel },
  ];

  const breadcrumbJsonLdItems = breadcrumbItems.map((item) => ({
    name: item.label,
    url: toAbsoluteUrl(item.href),
  }));

  // ── FAQ ─────────────────────────────────────────────────────────────
  const faqItems = carDict.faq || [];

  // ── JSON-LD structured data ────────────────────────────────────────
  const carPagePath = getCarPath(locale, car?.slug || params.slug);

  const autoRentalJsonLd = fallbackLocation
    ? buildAutoRentalJsonLd({
        localeCandidate: locale,
        pagePath: carPagePath,
        offerUrlPath: carPagePath,
        location: {
          seoDescription: carSeoText.seoDescription,
          areaServed: fallbackLocation.areaServed,
          pickupLocation: fallbackLocation.pickupLocation,
          offerName: fallbackLocation.offerName,
          offerDescription: fallbackLocation.offerDescription,
        },
      })
    : null;

  const productJsonLd = car
    ? buildCarProductJsonLd({
        localeCandidate: locale,
        pagePath: carPagePath,
        car: {
          model: car.model,
          transmission: car.transmission,
          fueltype: car.fueltype,
          seats: car.seats,
          airConditioning: car.airConditioning,
          engine: car.engine,
          enginePower: car.enginePower,
          numberOfDoors: car.numberOfDoors,
          registration: car.registration,
          photoUrl: car.photoUrl,
          priceFrom: getLowestDailyPrice(car),
        },
        locationName,
      })
    : null;

  const faqJsonLd = buildFaqJsonLd(faqItems);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbJsonLdItems);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <>
      <JsonLdScript id={`car-autorental-${car?.slug || params.slug}-${locale}`} data={autoRentalJsonLd} />
      <JsonLdScript id={`car-product-${car?.slug || params.slug}-${locale}`} data={productJsonLd} />
      <JsonLdScript id={`car-faq-${car?.slug || params.slug}-${locale}`} data={faqJsonLd} />
      <JsonLdScript id={`car-breadcrumb-${car?.slug || params.slug}-${locale}`} data={breadcrumbJsonLd} />

      <Feed
        cars={allCarsData}
        orders={ordersData}
        company={companyData}
        locale={locale}
      >
        {/* 1. Breadcrumbs */}
        <SeoBreadcrumbNav items={breadcrumbItems} />

        {/* 2. Pillar links (Car rental in Halkidiki, Car rental at Thessaloniki Airport) */}
        {pillarLinks.length > 0 && (
          <SeoPillarLinksBlock title={carSeoText.pillarLinksTitle} links={pillarLinks} />
        )}

        {/* 3. H1 + SEO intro (150–200 words) */}
        <SeoIntroBlock title={carSeoText.h1Text || carModel} introText={carSeoText.introLongText || carSeoText.introText} />

        {/* 4. Quick specs (at a glance) */}
        <SeoQuickSpecsBlock title={carDict.quickSpecsTitle} specs={quickSpecs} />

        {/* 5. Hero: Car card with gallery, calendar, booking */}
        <SingleCarDisplay carSlug={params.slug} />

        {/* 6. Car features (checkmarks) */}
        <SeoCarFeaturesBlock title={carSeoText.featuresTitle} features={carFeatures} />

        {/* 7. Full vehicle specifications */}
        <SeoVehicleSpecsBlock title={carDict.specsTitle} specs={vehicleSpecs} />

        {/* 8. Pickup locations with links */}
        <SeoLinksBlock title={carDict.pickupTitle} links={locationLinks} />

        {/* 9. Why rent this car */}
        {carSeoText.whyRentBullets?.length > 0 && (
          <SeoWhyRentBlock title={carSeoText.whyRentTitle} bullets={carSeoText.whyRentBullets} />
        )}

        {/* 10. Other cars you may like */}
        {relatedCarLinks.length > 0 && (
          <SeoLinksBlock title={dictionary.links.otherCarsTitle} links={relatedCarLinks} />
        )}

        {/* 11. Category pages */}
        {allCategoryLinks.length > 0 && (
          <SeoLinksBlock title="Browse by category" links={allCategoryLinks} />
        )}

        {/* 12. Brand pages */}
        {brandLinks.length > 0 && (
          <SeoLinksBlock title={`More ${carBrand} rentals`} links={brandLinks} />
        )}

        {/* 13. FAQ */}
        <SeoFaqBlock title={carDict.faqTitle} faq={faqItems} />

        {/* 14. Back to hub */}
        <SeoSingleLinkBlock
          title={dictionary.links.mainHubLabel}
          href={`/${locale}`}
          label={dictionary.links.carsToHubLabel}
        />
      </Feed>
    </>
  );
}
