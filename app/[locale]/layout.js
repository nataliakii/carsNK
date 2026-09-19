import { notFound } from "next/navigation";
import {
  getHubLocationGroupsForNav,
  getLocaleDictionary,
  getRoutableLocaleParams,
  getSeoLocale,
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { getSpainLocationGroupsForNav } from "@domain/locationSeo/spainLocations";
import { NavLocationsProvider } from "@app/context/NavLocationsContext";
import { getSiteCountryConfig } from "@config/siteCountry";

export const dynamicParams = false;

export function generateStaticParams() {
  return getRoutableLocaleParams();
}

export default function LocaleLayout({ children, params }) {
  const locale = normalizeRoutableLocale(params.locale);
  if (!isRoutableLocale(params.locale)) {
    notFound();
  }

  const country = getSiteCountryConfig();
  const seoLocale = getSeoLocale(locale);
  const locationGroups = country.showLegacySeoLocations
    ? getHubLocationGroupsForNav(seoLocale)
    : getSpainLocationGroupsForNav(locale);
  const dictionary = getLocaleDictionary(seoLocale);
  const navLocationsDescription =
    dictionary?.links?.navLocationsDropdownDescription ?? "";

  return (
    <NavLocationsProvider
      locationGroups={locationGroups}
      navLocationsDescription={navLocationsDescription}
    >
      {children}
    </NavLocationsProvider>
  );
}
