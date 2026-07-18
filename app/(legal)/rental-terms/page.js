import { permanentRedirect } from "next/navigation";
import { getDefaultLocale } from "@domain/locationSeo/locationSeoService";

export default function LegacyRentalTermsRedirectPage() {
  permanentRedirect(`/${getDefaultLocale()}/rental-terms`);
}
