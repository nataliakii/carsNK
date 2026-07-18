import { redirect } from "next/navigation";
import { LOCATION_IDS } from "@domain/locationSeo/locationSeoKeys";
import {
  getDefaultLocale,
  getLocationById,
  getLocationPathFromLocation,
} from "@domain/locationSeo/locationSeoService";

export default function HomePageRedirect() {
  const locale = getDefaultLocale();
  const airportLocation = getLocationById(locale, LOCATION_IDS.THESSALONIKI_AIRPORT);
  const fallbackPath = `/${locale}`;

  redirect(
    airportLocation
      ? getLocationPathFromLocation(locale, airportLocation)
      : fallbackPath
  );
}
