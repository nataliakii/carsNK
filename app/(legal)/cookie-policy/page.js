import { permanentRedirect } from "next/navigation";
import { getDefaultLocale } from "@domain/locationSeo/locationSeoService";

export default function LegacyCookiePolicyRedirectPage() {
  permanentRedirect(`/${getDefaultLocale()}/cookie-policy`);
}
