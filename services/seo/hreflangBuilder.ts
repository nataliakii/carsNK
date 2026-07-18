import { getDefaultLocale } from "@domain/locationSeo/locationSeoService";
import type { LocationAlternateMap } from "@domain/locationSeo/types";
import { toAbsoluteUrl } from "./urlBuilder";
import { shouldIndexPath } from "./indexingPolicy";

/**
 * Builds hreflang alternates only for indexable locale versions.
 */
export function buildHreflangAlternates(pathsByLocale: LocationAlternateMap): Record<string, string> {
  const localeEntries = Object.entries(pathsByLocale).filter(
    ([, path]) => path && shouldIndexPath(path)
  );
  const alternates: Record<string, string> = {};

  if (localeEntries.length === 0) {
    return alternates;
  }

  for (const [locale, path] of localeEntries) {
    alternates[locale] = toAbsoluteUrl(path);
  }

  const defaultLocale = getDefaultLocale();
  const defaultLocalePath = pathsByLocale[defaultLocale];
  const defaultPath =
    defaultLocalePath && shouldIndexPath(defaultLocalePath)
      ? defaultLocalePath
      : localeEntries[0]?.[1] || `/${defaultLocale}`;

  alternates["x-default"] = toAbsoluteUrl(defaultPath);

  return alternates;
}
