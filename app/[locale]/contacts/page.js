import { Suspense } from "react";
import { notFound } from "next/navigation";
import LoadingSpinner from "@app/loading";
import Feed from "@app/components/Feed";
import Contacts from "@app/components/Contacts/Contacts";
import {
  isSupportedLocale,
  normalizeLocale,
} from "@domain/locationSeo/locationSeoService";
import { STATIC_PAGE_KEYS } from "@domain/locationSeo/locationSeoKeys";
import { buildStaticPageMetadata } from "@/services/seo/metadataBuilder";

export async function generateMetadata({ params }) {
  return buildStaticPageMetadata(params.locale, STATIC_PAGE_KEYS.CONTACTS);
}

export default function LocalizedContactsPage({ params }) {
  const locale = normalizeLocale(params.locale);
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <Feed locale={locale}>
      <Suspense fallback={<LoadingSpinner />}>
        <Contacts />
      </Suspense>
    </Feed>
  );
}
