import { permanentRedirect } from "next/navigation";

import { normalizeRoutableLocale } from "@domain/locationSeo/locationSeoService";
import { canonicalTermsPath } from "@domain/legal/customerTermsRoute";

/** Legacy alias. The canonical customer Terms page is /{locale}/terms. */
export default async function BookingTermsAliasPage({ params, searchParams }) {
  const { locale } = await params;
  const query = await searchParams;
  permanentRedirect(canonicalTermsPath(normalizeRoutableLocale(locale), query));
}
