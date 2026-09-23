import { notFound } from "next/navigation";

import Feed from "@app/components/Feed";
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
    title: "Data Protection Schedule",
    description:
      "How Rovaro and partner rental companies handle personal data.",
    alternates: {
      canonical: absoluteUrl(`/${normalized}/data-protection-schedule`),
    },
    robots: { index: true, follow: true },
  };
}

export default async function DataProtectionSchedulePage({ params }) {
  const { locale } = await params;
  if (!isRoutableLocale(locale)) notFound();
  const normalized = normalizeRoutableLocale(locale);

  return (
    <Feed locale={normalized}>
      <RovaroLegalDocument
        documentType={LEGAL_DOCUMENT_TYPE.DATA_PROTECTION_SCHEDULE}
        locale={normalized}
      />
    </Feed>
  );
}
