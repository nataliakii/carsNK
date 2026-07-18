import { notFound } from "next/navigation";
import Feed from "@app/components/Feed";
import RentalTermsContent from "@app/(legal)/_components/RentalTermsContent";
import {
  isSupportedLocale,
  normalizeLocale,
} from "@domain/locationSeo/locationSeoService";
import { STATIC_PAGE_KEYS } from "@domain/locationSeo/locationSeoKeys";
import { buildStaticPageMetadata } from "@/services/seo/metadataBuilder";

export async function generateMetadata({ params }) {
  return buildStaticPageMetadata(params.locale, STATIC_PAGE_KEYS.RENTAL_TERMS);
}

export default function LocalizedRentalTermsPage({ params }) {
  const locale = normalizeLocale(params.locale);
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <Feed locale={locale}>
      <RentalTermsContent forcedLang={locale} />
    </Feed>
  );
}
