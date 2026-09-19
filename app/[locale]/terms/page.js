import { permanentRedirect } from "next/navigation";
import { normalizeRoutableLocale } from "@domain/locationSeo/locationSeoService";

export default function LocalizedTermsAliasPage({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  permanentRedirect(`/${locale}/rental-terms`);
}
