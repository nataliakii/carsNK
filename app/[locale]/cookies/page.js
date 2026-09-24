import { permanentRedirect } from "next/navigation";
import { normalizeRoutableLocale } from "@domain/locationSeo/locationSeoService";

/** Public alias: /cookies → Cookie Policy. */
export default async function LocalizedCookiesAliasPage({ params }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeRoutableLocale(rawLocale);
  permanentRedirect(`/${locale}/cookie-policy`);
}
