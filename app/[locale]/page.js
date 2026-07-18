import { notFound } from "next/navigation";
import Feed from "@app/components/Feed";
import CarGrid from "@app/components/CarGrid";
import JsonLdScript from "@app/components/seo/JsonLdScript";
import SeoHeroSliderCard from "@app/components/seo/SeoHeroSliderCard";
import {
  getHubSeo,
  getLocationById,
  isSupportedLocale,
  normalizeLocale,
} from "@domain/locationSeo/locationSeoService";
import { LOCATION_IDS } from "@domain/locationSeo/locationSeoKeys";
import { COMPANY_ID } from "@config/company";
import { getSeoConfig } from "@config/seo";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { getCars, getCompany, getActiveOrders } from "@/domain/services";
import { buildHubJsonLd } from "@/services/seo/jsonLdBuilder";
import { buildHubMetadata } from "@/services/seo/metadataBuilder";

export async function generateMetadata({ params }) {
  const locale = normalizeLocale(params.locale);
  return buildHubMetadata(locale);
}

export default async function LocalizedHomePage({ params }) {
  const locale = normalizeLocale(params.locale);
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const session = await getServerSession(authOptions);
  const [carsData, ordersData, companyData] = await Promise.all([
    getCars({ session }),
    getActiveOrders({ session }),
    getCompany(COMPANY_ID),
  ]);

  const hubSeo = getHubSeo(locale);
  const primaryLocation = getLocationById(locale, LOCATION_IDS.HALKIDIKI);

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
        cars={carsData}
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
      </Feed>
    </>
  );
}
