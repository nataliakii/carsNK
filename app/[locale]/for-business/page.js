import { Suspense } from "react";
import { notFound } from "next/navigation";
import LoadingSpinner from "@app/loading";
import Feed from "@app/components/Feed";
import ForBusinessSection from "@app/components/ForBusinessSection";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { STATIC_PAGE_KEYS } from "@domain/locationSeo/locationSeoKeys";
import { buildStaticPageMetadata } from "@/services/seo/metadataBuilder";

export async function generateMetadata({ params }) {
  return buildStaticPageMetadata(params.locale, STATIC_PAGE_KEYS.FOR_BUSINESS);
}

export default function LocalizedForBusinessPage({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  if (!isRoutableLocale(params.locale)) {
    notFound();
  }

  return (
    <Feed locale={locale}>
      <Suspense fallback={<LoadingSpinner />}>
        <ForBusinessSection />
      </Suspense>
    </Feed>
  );
}
