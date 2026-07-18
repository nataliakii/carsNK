import { permanentRedirect } from "next/navigation";
import { getDefaultLocale } from "@domain/locationSeo/locationSeoService";

export default function LegacyContactsRedirectPage() {
  permanentRedirect(`/${getDefaultLocale()}/contacts`);
}
