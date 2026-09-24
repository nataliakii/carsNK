import { notFound } from "next/navigation";

import Feed from "@app/components/Feed";
import RovaroLegalDocument from "@app/(legal)/_components/RovaroLegalDocument";
import BookingFeeOutcomesTable from "@app/components/Legal/BookingFeeOutcomesTable";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { absoluteUrl } from "@config/domain";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";

export const dynamic = "force-dynamic";

/**
 * Canonical customer Terms page. `/booking-terms` and `/rental-terms` redirect
 * here, so the customer terms are rendered in exactly one place.
 */
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const normalized = normalizeRoutableLocale(locale);
  return {
    title: "Booking Terms",
    description:
      "Terms for booking a rental vehicle through the Rovaro booking platform.",
    alternates: { canonical: absoluteUrl(`/${normalized}/terms`) },
    robots: { index: true, follow: true },
  };
}

export default async function CustomerTermsPage({ params }) {
  const { locale } = await params;
  if (!isRoutableLocale(locale)) notFound();
  const normalized = normalizeRoutableLocale(locale);

  return (
    <Feed locale={normalized}>
      <RovaroLegalDocument
        documentType={LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS}
        locale={normalized}
        publishedOnly
      />
      <BookingFeeOutcomesTable language={normalized} />
    </Feed>
  );
}
