import { permanentRedirect } from "next/navigation";
import { normalizeRoutableLocale } from "@domain/locationSeo/locationSeoService";

/** Public alias: /cookies → Cookie Policy. */
export default function LocalizedCookiesAliasPage({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  permanentRedirect(`/${locale}/cookie-policy`);
}
