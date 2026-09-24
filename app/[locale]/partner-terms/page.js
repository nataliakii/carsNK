import { notFound } from "next/navigation";

import PublicLegalPageLayout from "@app/(legal)/_components/PublicLegalPageLayout";
import RovaroLegalDocument from "@app/(legal)/_components/RovaroLegalDocument";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { absoluteUrl } from "@config/domain";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const normalized = normalizeRoutableLocale(locale);
  return {
    title: "Partner Terms",
    description:
      "The agreement between Rovaro and the rental companies that supply vehicles through the platform.",
    alternates: { canonical: absoluteUrl(`/${normalized}/partner-terms`) },
    robots: { index: true, follow: true },
  };
}

export default async function PartnerTermsPage({ params }) {
  const { locale } = await params;
  if (!isRoutableLocale(locale)) notFound();
  const normalized = normalizeRoutableLocale(locale);

  return (
    <PublicLegalPageLayout locale={normalized}>
      <RovaroLegalDocument
        documentType={LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT}
        locale={normalized}
        publishedOnly
      />
      <div style={{ padding: "0 0 24px" }}>
        <a
          href={`/${normalized}/partner-operating-rules`}
          style={{ color: "#E9004F", fontSize: 14 }}
        >
          Partner Operating Rules →
        </a>
      </div>
    </PublicLegalPageLayout>
  );
}
