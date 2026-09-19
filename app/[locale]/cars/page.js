import { notFound } from "next/navigation";
import Feed from "@app/components/Feed";
import CarGrid from "@app/components/CarGrid";
import {
  getCarPath,
  getLocaleDictionary,
  getSupportedLocales,
  isRoutableLocale,
  normalizeRoutableLocale,
  getSeoLocale,
} from "@domain/locationSeo/locationSeoService";
import { COMPANY_ID } from "@config/company";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { getCars, getCompany, getActiveOrders } from "@/domain/services";
import { SeoLinksBlock, SeoIntroBlock } from "@app/components/seo/SeoContentBlocks";
import { buildHreflangAlternates } from "@/services/seo/hreflangBuilder";
import { getRobotsForPath } from "@/services/seo/indexingPolicy";
import { toAbsoluteUrl } from "@/services/seo/urlBuilder";
import { getSiteCountryConfig } from "@config/siteCountry";
import { getBrandName, isGreeceSite } from "@config/brand";

function getPublicCars(cars) {
  return (cars || []).filter(
    (c) =>
      c?.slug &&
      String(c.slug).trim() &&
      c?.isActive !== false &&
      c?.isHidden !== true &&
      !c?.deletedAt
  );
}

const CARS_INDEX_ALTERNATES = Object.fromEntries(
  getSupportedLocales().map((l) => [l, `/${l}/cars`])
);

export async function generateMetadata({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  const dictionary = getLocaleDictionary(locale);
  const brandName = getBrandName();
  const country = getSiteCountryConfig();
  const title = `${dictionary.links.carsListTitle} | ${brandName}`;
  const description = isGreeceSite()
    ? `Browse all rental cars available in Halkidiki and Thessaloniki. Compare models, prices and book online with ${brandName}.`
    : `Browse rental cars available in ${country.countryName}. Compare models, prices and book online with ${brandName}.`;
  const path = `/${locale}/cars`;
  return {
    title,
    description,
    alternates: {
      canonical: toAbsoluteUrl(path),
      languages: buildHreflangAlternates(CARS_INDEX_ALTERNATES),
    },
    openGraph: { title, description },
    robots: getRobotsForPath(path),
  };
}

export default async function CarsIndexPage({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  if (!isRoutableLocale(params.locale)) notFound();
  const seoLocale = getSeoLocale(locale);
  const session = await getServerSession(authOptions);
  const [allCarsData, ordersData, companyData] = await Promise.all([
    getCars({ session, marketplaceOnly: true }).catch(() => []),
    getActiveOrders({ session }).catch(() => []),
    getCompany(COMPANY_ID).catch(() => null),
  ]);

  const publicCars = getPublicCars(allCarsData);
  const dictionary = getLocaleDictionary(seoLocale);

  const carLinks = publicCars.map((c) => ({
    href: getCarPath(locale, c.slug),
    label: c.model || c.slug,
  }));

  const country = getSiteCountryConfig();
  const introText = isGreeceSite()
    ? "Browse our full fleet of rental cars available in Halkidiki, Thessaloniki Airport and Nea Kallikratia. Each vehicle can be picked up at your chosen location. Book online to secure the best rate."
    : `Browse our full fleet of rental cars available in ${country.countryName}. Each vehicle can be picked up at your chosen location. Book online to secure the best rate.`;

  return (
    <Feed
      cars={allCarsData}
      orders={ordersData}
      company={companyData}
      locale={locale}
      isMain={true}
    >
      <SeoIntroBlock
        title={dictionary.links.carsListTitle}
        introText={introText}
      />
      {carLinks.length > 0 && (
        <SeoLinksBlock
          title="All car models"
          links={carLinks}
        />
      )}
      <CarGrid />
    </Feed>
  );
}
