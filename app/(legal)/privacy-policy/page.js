import { permanentRedirect } from "next/navigation";
import { getDefaultLocale } from "@domain/locationSeo/locationSeoService";

export default function LegacyPrivacyPolicyRedirectPage() {
  permanentRedirect(`/${getDefaultLocale()}/privacy-policy`);
}
