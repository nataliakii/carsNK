import { notFound } from "next/navigation";
import Feed from "@app/components/Feed";
import LegalPageContent from "@app/(legal)/_components/LegalPageContent";
import {
  isSupportedLocale,
  normalizeLocale,
} from "@domain/locationSeo/locationSeoService";
import { STATIC_PAGE_KEYS } from "@domain/locationSeo/locationSeoKeys";
import { buildStaticPageMetadata } from "@/services/seo/metadataBuilder";

export async function generateMetadata({ params }) {
  return buildStaticPageMetadata(params.locale, STATIC_PAGE_KEYS.PRIVACY_POLICY);
}

export default function LocalizedPrivacyPolicyPage({ params }) {
  const locale = normalizeLocale(params.locale);
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <Feed locale={locale}>
      <LegalPageContent docType="privacy-policy" forcedLang={locale} />
    </Feed>
  );
}
