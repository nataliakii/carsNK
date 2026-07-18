import { notFound } from "next/navigation";
import {
  getHubLocationGroupsForNav,
  getLocaleDictionary,
  getLocaleRouteParams,
  isSupportedLocale,
  normalizeLocale,
} from "@domain/locationSeo/locationSeoService";
import { NavLocationsProvider } from "@app/context/NavLocationsContext";

export const dynamicParams = false;

export function generateStaticParams() {
  return getLocaleRouteParams();
}

export default function LocaleLayout({ children, params }) {
  const locale = normalizeLocale(params.locale);
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const locationGroups = getHubLocationGroupsForNav(locale);
  const dictionary = getLocaleDictionary(locale);
  const navLocationsDescription = dictionary?.links?.navLocationsDropdownDescription ?? "";

  return (
    <NavLocationsProvider
      locationGroups={locationGroups}
      navLocationsDescription={navLocationsDescription}
    >
      {children}
    </NavLocationsProvider>
  );
}
