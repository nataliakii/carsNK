import { permanentRedirect } from "next/navigation";
import { getDefaultLocale } from "@domain/locationSeo/locationSeoService";

export default function LegacyTermsOfServiceRedirectPage() {
  permanentRedirect(`/${getDefaultLocale()}/terms-of-service`);
}
