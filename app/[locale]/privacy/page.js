import { permanentRedirect } from "next/navigation";
import { normalizeRoutableLocale } from "@domain/locationSeo/locationSeoService";

/** Public alias: /privacy → Privacy Policy. */
export default function LocalizedPrivacyAliasPage({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  permanentRedirect(`/${locale}/privacy-policy`);
}
