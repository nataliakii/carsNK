import { unstable_noStore } from "next/cache";
import { notFound } from "next/navigation";

import Feed from "@app/components/Feed";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { buildAlternativeOfferView } from "@/domain/booking/alternativeVehicleView";

import AlternativeOfferClient from "./AlternativeOfferClient";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export const metadata = {
  title: "Replacement vehicle offer",
  robots: { index: false, follow: false },
};

/**
 * Customer landing page for an alternative vehicle offer:
 * /{locale}/booking/alternative/{offerId}
 *
 * The offer id is the capability, exactly as the API route treats it. Rendering
 * is strictly read-only — accepting or declining is a separate POST the
 * customer has to make deliberately.
 */
export default async function AlternativeVehicleOfferPage({ params }) {
  unstable_noStore();

  const { locale: rawLocale, offerId } = await params;
  if (!isRoutableLocale(rawLocale)) notFound();
  const locale = normalizeRoutableLocale(rawLocale);

  const offer = await buildAlternativeOfferView(offerId);
  if (!offer) notFound();

  return (
    <Feed locale={locale}>
      <AlternativeOfferClient offer={offer} locale={locale} />
    </Feed>
  );
}
