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
  getCarPath,
  getCarSeoJsonLdLocation,
  getCarSeoPickupLinks,
  getCarSeoPillarLinks,
  getCarSeoPrimaryLocationName,
  getLocaleDictionary,
  getLocationSeoSlug,
  getSupportedLocales,
  isRoutableLocale,
  normalizeRoutableLocale,
  getSeoLocale,
  usesLegacySeoLocations,
} from "@domain/locationSeo/locationSeoService";
import { getCarSeoUiCopy } from "@domain/locationSeo/carSeoUiCopy";
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
} from "@domain/seoPages/seoPageRegistry";

const MONGO_ID_REGEX = /^[0-9a-f]{24}$/i;

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
  const routeLocale = normalizeRoutableLocale(params.locale);
  const car = await getCarBySlug(params.slug).catch(() => null);

  if (!car) {
    return { robots: { index: false, follow: false } };
  }

  const locationName = getCarSeoPrimaryLocationName(routeLocale);
  const ui = getCarSeoUiCopy(routeLocale);

  // Use DB slug for canonical so /en/cars/Toyota-Yaris and /en/cars/toyota-yaris converge.
  const canonicalSlug = car.slug || params.slug;

  return buildCarMetadata({
    localeCandidate: routeLocale,
    carSlug: canonicalSlug,
    carModel: car.model || canonicalSlug,
    locationName,
    transmission: ui.translateValue(car.transmission),
    fuelType: ui.translateValue(car.fueltype),
    seats: car.seats ? String(car.seats) : "",
  });
}

export default async function LocalizedCarPage({ params }) {
  const routeLocale = normalizeRoutableLocale(params.locale);
  if (!isRoutableLocale(params.locale)) {
    notFound();
  }
  const locale = getSeoLocale(routeLocale);

  const session = await getServerSession(authOptions);

  // MongoDB ObjectId in URL → redirect to real slug
  if (MONGO_ID_REGEX.test(params.slug)) {
    const carById = await getCarById(params.slug, { session }).catch(() => null);
    if (carById?.slug) {
      permanentRedirect(getCarPath(routeLocale, carById.slug));
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

  // Inactive cars are not bookable on the public site.
  if (resolvedCar?.isActive === false && !session?.user?.isAdmin) {
    notFound();
  }

  // Redirect to canonical slug when URL differs (e.g. case) to avoid duplicate content.
  if (params.slug !== resolvedCar.slug) {
    permanentRedirect(getCarPath(routeLocale, resolvedCar.slug));
  }

  const car = resolvedCar;

  // ── Locale dictionary & location data ──────────────────────────────
  const dictionary = getLocaleDictionary(locale);
  const greeceSeo = usesLegacySeoLocations();
  const ui = getCarSeoUiCopy(routeLocale);
  const locationName = getCarSeoPrimaryLocationName(routeLocale);
  const carModel = car?.model || car?.slug || params.slug;

  const carSeoText = buildCarSeoText(routeLocale, {
    carModel,
    locationName,
    transmission: ui.translateValue(car?.transmission),
    fuelType: ui.translateValue(car?.fueltype),
    seats: car?.seats ? String(car.seats) : "",
  });

  const pillarLinks = getCarSeoPillarLinks(routeLocale);

  // ── Quick specs (at a glance — only real car fields) ─
  const quickSpecs = [
    car?.transmission && {
      label: ui.transmission,
      value: ui.translateValue(car.transmission),
    },
    car?.fueltype && {
      label: ui.fuel,
      value: ui.translateValue(car.fueltype),
    },
    car?.seats && { label: ui.seats, value: String(car.seats) },
    car?.airConditioning != null && {
      label: ui.air,
      value: car.airConditioning ? ui.yes : ui.no,
    },
  ].filter(Boolean);

  // ── Car features list (for Features of X block) ─
  const carFeatures = [
    car?.transmission &&
      `${ui.translateValue(car.transmission)} ${ui.transmission}`.trim(),
    car?.airConditioning && ui.air,
  ].filter(Boolean);

  // ── Pickup locations with links ────────────────────────────────────
  const locationLinks = getCarSeoPickupLinks(routeLocale);

  // ── Vehicle specifications ─────────────────────────────────────────
  const vehicleSpecs = [
    car?.transmission && {
      label: ui.transmission,
      value: ui.translateValue(car.transmission),
    },
    car?.fueltype && {
      label: ui.fuel,
      value: ui.translateValue(car.fueltype),
    },
    car?.seats && { label: ui.seats, value: String(car.seats) },
    car?.airConditioning != null && {
      label: ui.air,
      value: car.airConditioning ? ui.yes : ui.no,
    },
    car?.numberOfDoors && { label: ui.doors, value: String(car.numberOfDoors) },
    car?.enginePower && {
      label: ui.enginePow,
      value: `${car.enginePower} HP`,
    },
    car?.engine && { label: ui.engine, value: `${car.engine} cc` },
    car?.registration && { label: ui.year, value: String(car.registration) },
    car?.class && {
      label: ui.classLabel,
      value: ui.translateValue(car.class),
    },
    car?.deposit != null && {
      label: ui.deposit,
      value: car.deposit > 0 ? `${car.deposit} €` : ui.noDeposit,
    },
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
    href: getCarPath(routeLocale, c.slug),
    label: c.model || c.slug,
  }));

  // Greece-only programmatic SEO landings (404 on Spain / Rovaro).
  const categoryLinks = greeceSeo
    ? SEO_LOCATIONS.slice(0, 2).flatMap((location) =>
        CAR_CATEGORIES.filter((cat) => {
          if (cat.filter.type === "transmission" && car?.transmission) {
            return cat.filter.value === car.transmission.toLowerCase();
          }
          if (cat.filter.type === "classes" && car?.class) {
            return cat.filter.value.includes(car.class.toLowerCase());
          }
          return false;
        }).map((cat) => {
          const categoryLocationName = location.nameByLocale[locale];
          const content = getResolvedCategoryContent(
            cat.id,
            locale,
            categoryLocationName
          );
          const locSlug = getLocationSeoSlug(location.locationId, locale);
          return {
            href: getSeoPagePath(locale, `${cat.id}-car-rental-${locSlug}`),
            label: content?.h1 || `${cat.id} car rental`,
          };
        })
      )
    : [];

  const mainLocation = greeceSeo ? SEO_LOCATIONS[0] : null;
  const mainLocSlug = mainLocation
    ? getLocationSeoSlug(mainLocation.locationId, locale)
    : "";
  const generalCategoryLinks =
    greeceSeo && mainLocation
      ? CAR_CATEGORIES.filter(
          (cat) => !categoryLinks.some((cl) => cl.href.includes(cat.id))
        )
          .slice(0, 3)
          .map((cat) => {
            const content = getResolvedCategoryContent(
              cat.id,
              locale,
              mainLocation.nameByLocale[locale]
            );
            return {
              href: getSeoPagePath(
                locale,
                `${cat.id}-car-rental-${mainLocSlug}`
              ),
              label: content?.h1 || `${cat.id} car rental`,
            };
          })
      : [];

  const allCategoryLinks = [...categoryLinks, ...generalCategoryLinks].slice(
    0,
    5
  );

  const carBrand = car ? extractBrandFromModel(car.model || "") : "";
  const carBrandSlug = carBrand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const brandLinks =
    greeceSeo && carBrandSlug
      ? SEO_LOCATIONS.slice(0, 2).map((location) => {
          const brandContent = getResolvedBrandContent(
            carBrand,
            locale,
            location.nameByLocale[locale]
          );
          const locSlug = getLocationSeoSlug(location.locationId, locale);
          return {
            href: getSeoPagePath(
              locale,
              buildBrandPageSlug(carBrandSlug, locSlug)
            ),
            label: brandContent.h1,
          };
        })
      : [];

  const breadcrumbItems = [
    { href: `/${routeLocale}`, label: carSeoText.breadcrumbHome },
    { href: `/${routeLocale}/cars`, label: carSeoText.breadcrumbCars },
    {
      href: getCarPath(routeLocale, car?.slug || params.slug),
      label: carModel,
    },
  ];

  const breadcrumbJsonLdItems = breadcrumbItems.map((item) => ({
    name: item.label,
    url: toAbsoluteUrl(item.href),
  }));

  const faqItems = carSeoText.faq || [];

  const carPagePath = getCarPath(routeLocale, car?.slug || params.slug);
  const jsonLdLocation = getCarSeoJsonLdLocation(
    routeLocale,
    carSeoText.seoDescription
  );

  const autoRentalJsonLd = jsonLdLocation
    ? buildAutoRentalJsonLd({
        localeCandidate: routeLocale,
        pagePath: carPagePath,
        offerUrlPath: carPagePath,
        location: jsonLdLocation,
      })
    : null;

  const productJsonLd = car
    ? buildCarProductJsonLd({
        localeCandidate: routeLocale,
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
      <JsonLdScript id={`car-autorental-${car?.slug || params.slug}-${routeLocale}`} data={autoRentalJsonLd} />
      <JsonLdScript id={`car-product-${car?.slug || params.slug}-${routeLocale}`} data={productJsonLd} />
      <JsonLdScript id={`car-faq-${car?.slug || params.slug}-${routeLocale}`} data={faqJsonLd} />
      <JsonLdScript id={`car-breadcrumb-${car?.slug || params.slug}-${routeLocale}`} data={breadcrumbJsonLd} />

      <Feed
        cars={allCarsData}
        orders={ordersData}
        company={companyData}
        locale={routeLocale}
      >
        {/* 1. Breadcrumbs */}
        <SeoBreadcrumbNav items={breadcrumbItems} />

        {/* 2. Pillar links (country-specific SEO locations) */}
        {pillarLinks.length > 0 && (
          <SeoPillarLinksBlock title={carSeoText.pillarLinksTitle} links={pillarLinks} />
        )}

        {/* 3. H1 + SEO intro (150–200 words) */}
        <SeoIntroBlock title={carSeoText.h1Text || carModel} introText={carSeoText.introLongText || carSeoText.introText} />

        {/* 4. Quick specs (at a glance) */}
        <SeoQuickSpecsBlock title={carSeoText.quickSpecsTitle} specs={quickSpecs} />

        {/* 5. Hero: catalog booking card */}
        <SingleCarDisplay carSlug={params.slug} />

        {/* 6. Car features (checkmarks) */}
        <SeoCarFeaturesBlock title={carSeoText.featuresTitle} features={carFeatures} />

        {/* 7. Full vehicle specifications */}
        <SeoVehicleSpecsBlock title={carSeoText.specsTitle} specs={vehicleSpecs} />

        {/* 8. Pickup locations with links */}
        <SeoLinksBlock title={carSeoText.pickupTitle} links={locationLinks} />

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
        <SeoFaqBlock title={carSeoText.faqTitle} faq={faqItems} />

        {/* 14. Back to hub */}
        <SeoSingleLinkBlock
          title={dictionary.links.mainHubLabel}
          href={`/${routeLocale}`}
          label={dictionary.links.carsToHubLabel}
        />
      </Feed>
    </>
  );
}
