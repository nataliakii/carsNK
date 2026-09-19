import { notFound } from "next/navigation";
import Feed from "@app/components/Feed";
import LegalPageContent from "@app/(legal)/_components/LegalPageContent";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { STATIC_PAGE_KEYS } from "@domain/locationSeo/locationSeoKeys";
import { buildStaticPageMetadata } from "@/services/seo/metadataBuilder";

export async function generateMetadata({ params }) {
  return buildStaticPageMetadata(params.locale, STATIC_PAGE_KEYS.TERMS_OF_SERVICE);
}

export default function LocalizedTermsOfServicePage({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  if (!isRoutableLocale(params.locale)) {
    notFound();
  }

  return (
    <Feed locale={locale}>
      <LegalPageContent docType="terms-of-service" forcedLang={locale} />
    </Feed>
  );
}
