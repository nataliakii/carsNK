import { permanentRedirect } from "next/navigation";
import { getDefaultLocale } from "@domain/locationSeo/locationSeoService";
import { canonicalTermsPath } from "@domain/legal/customerTermsRoute";

/** Bare `/rental-terms` → `/{defaultLocale}/terms`, preserving query params. */
export default async function LegacyRentalTermsRedirectPage({ searchParams }) {
  const query = await searchParams;
  permanentRedirect(canonicalTermsPath(getDefaultLocale(), query));
}
