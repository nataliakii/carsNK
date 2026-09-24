import { notFound } from "next/navigation";
import PublicLegalPageLayout from "@app/(legal)/_components/PublicLegalPageLayout";
import RovaroLegalDocument from "@app/(legal)/_components/RovaroLegalDocument";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { STATIC_PAGE_KEYS } from "@domain/locationSeo/locationSeoKeys";
import { buildStaticPageMetadata } from "@/services/seo/metadataBuilder";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return buildStaticPageMetadata(locale, STATIC_PAGE_KEYS.PRIVACY_POLICY);
}

export default async function LocalizedPrivacyPolicyPage({ params }) {
  const { locale } = await params;
  if (!isRoutableLocale(locale)) {
    notFound();
  }
  const normalized = normalizeRoutableLocale(locale);

  return (
    <PublicLegalPageLayout locale={normalized}>
      <RovaroLegalDocument
        documentType={LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY}
        locale={normalized}
        publishedOnly
      />
    </PublicLegalPageLayout>
  );
}
