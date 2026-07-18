import { permanentRedirect } from "next/navigation";
import { normalizeLocale } from "@domain/locationSeo/locationSeoService";

export default function LocalizedTermsAliasPage({ params }) {
  const locale = normalizeLocale(params.locale);
  permanentRedirect(`/${locale}/rental-terms`);
}
