import { notFound } from "next/navigation";
import Feed from "@app/components/Feed";
import CarGrid from "@app/components/CarGrid";
import ForBusinessSection from "@app/components/ForBusinessSection";
import JsonLdScript from "@app/components/seo/JsonLdScript";
import SeoHeroSliderCard from "@app/components/seo/SeoHeroSliderCard";
import {
  getHubSeo,
  getLocationById,
  isRoutableLocale,
  normalizeRoutableLocale,
  getSeoLocale,
} from "@domain/locationSeo/locationSeoService";
import { LOCATION_IDS } from "@domain/locationSeo/locationSeoKeys";
import { COMPANY_ID } from "@config/company";
import { getSeoConfig } from "@config/seo";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { getCars, getCompany, getActiveOrders } from "@/domain/services";
import { filterPublicCars } from "@/domain/owners/ownerScope";
import { buildHubJsonLd } from "@/services/seo/jsonLdBuilder";
import { buildHubMetadata } from "@/services/seo/metadataBuilder";
import { getSiteCountryConfig } from "@config/siteCountry";
import { getSpainPrimaryLocationForJsonLd } from "@domain/locationSeo/spainSeoContent";

export async function generateMetadata({ params }) {
  return buildHubMetadata(params.locale);
}

export default async function LocalizedHomePage({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  if (!isRoutableLocale(params.locale)) {
    notFound();
  }
  const session = await getServerSession(authOptions);
  const [carsData, ordersData, companyData] = await Promise.all([
    getCars({ session, marketplaceOnly: true }),
    getActiveOrders({ session }),
    getCompany(COMPANY_ID),
  ]);

  // Public homepage never shows inactive / testing cars, even if an admin is logged in.
  const publicCars = filterPublicCars(carsData);

  const country = getSiteCountryConfig();
  const seoLocale = getSeoLocale(locale);
  const hubSeo = getHubSeo(locale);
  const primaryLocation = country.showLegacySeoLocations
    ? getLocationById(seoLocale, LOCATION_IDS.HALKIDIKI)
    : getSpainPrimaryLocationForJsonLd(locale);

  const hubJsonLd = primaryLocation
    ? buildHubJsonLd({
        localeCandidate: locale,
        pagePath: `/${locale}`,
        primaryLocation,
      })
    : null;

  const seoConfig = getSeoConfig(companyData ?? undefined);
  const heroImagesRaw = seoConfig?.heroImages ?? [];
  const heroImageUrl = seoConfig?.heroImageUrl ?? null;
  const defaultHeroImage = "/car-rental-thessaloniki-airport.png";
  const heroImages =
    heroImagesRaw.length > 0
      ? heroImagesRaw
      : heroImageUrl
        ? [heroImageUrl]
        : [defaultHeroImage];

  return (
    <>
      <JsonLdScript id={`hub-jsonld-${locale}`} data={hubJsonLd} />
      <Feed
        cars={publicCars}
        orders={ordersData}
        isMain={true}
        company={companyData}
        locale={locale}
      >
        {/* <SeoHeroSliderCard
          title={hubSeo.h1}
          introText={hubSeo.introText}
          chips={[]}
          imageUrls={heroImages}
        /> */}
        <CarGrid />
        <ForBusinessSection />
      </Feed>
    </>
  );
}
