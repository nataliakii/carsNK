import {
  DEFAULT_LOCALE,
  LOCATION_ROUTE_SEGMENT,
  SUPPORTED_LOCALES,
  type LocationId,
  type SupportedLocale,
} from "./locationSeoKeys";
import { locationSeoRepo, locationContentByKey } from "./locationSeoRepo";
import type { LocationAlternateMap } from "./types";

/**
 * Central registry for SEO locations.
 *
 * This wraps the existing locationSeoRepo so that slug and name logic
 * live in one place and can be reused consistently across routing,
 * sitemap generation, hreflang, and UI components.
 */

export type LocationSeoRegistryEntry = {
  /** Stable internal id (LOCATION_IDS.*). */
  locationId: LocationId;
  /** Canonical, language-independent slug used for legacy redirects. */
  canonicalSlug: string;
  /** Localized human-readable name per locale. */
  nameByLocale: Record<SupportedLocale, string>;
  /** Localized SEO slug per locale (used in /{locale}/locations/{slug}). */
  seoSlugByLocale: Record<SupportedLocale, string>;
};

const registryById: Map<LocationId, LocationSeoRegistryEntry> = new Map();
const registryByLocaleAndSlug: Map<string, LocationSeoRegistryEntry> = new Map();

function buildRegistryOnce(): void {
  if (registryById.size > 0) return;

  for (const item of locationSeoRepo) {
    const content = locationContentByKey[item.contentKey];
    const entry: LocationSeoRegistryEntry = {
      locationId: item.id,
      canonicalSlug: item.canonicalSlug,
      nameByLocale: {} as Record<SupportedLocale, string>,
      seoSlugByLocale: {} as Record<SupportedLocale, string>,
    };

    for (const locale of SUPPORTED_LOCALES) {
      entry.nameByLocale[locale] = content[locale].shortName;
      const seoSlug =
        item.slugByLocale[locale] ||
        item.slugByLocale[DEFAULT_LOCALE] ||
        item.canonicalSlug;
      entry.seoSlugByLocale[locale] = seoSlug;

      const key = `${locale}::${seoSlug}`;
      registryByLocaleAndSlug.set(key, entry);
    }

    registryById.set(item.id, entry);
  }
}

export function getLocationSeoRegistryEntry(locationId: LocationId): LocationSeoRegistryEntry | null {
  buildRegistryOnce();
  return registryById.get(locationId) || null;
}

/** Returns the localized SEO slug for a location id and locale, falling back to English. */
export function getLocationSeoSlug(
  locationId: LocationId,
  locale: SupportedLocale
): string | null {
  const entry = getLocationSeoRegistryEntry(locationId);
  if (!entry) return null;
  return entry.seoSlugByLocale[locale] || entry.seoSlugByLocale.en || null;
}

/**
 * Returns the canonical SEO path for a location:
 * /{locale}/locations/{localizedSeoSlug}
 */
export function getLocationSeoPath(
  locationId: LocationId,
  locale: SupportedLocale
): string | null {
  const slug = getLocationSeoSlug(locationId, locale);
  if (!slug) return null;
  // Use the same route segment so this stays in sync with the Next.js route.
  return `/${locale}/${LOCATION_ROUTE_SEGMENT}/${slug}`;
}

/**
 * Resolve a location by localized SEO slug for a given locale.
 * Uses English as fallback when the slug is shared across locales.
 */
export function getLocationBySeoSlug(
  locale: SupportedLocale,
  slug: string
): LocationSeoRegistryEntry | null {
  buildRegistryOnce();
  const directKey = `${locale}::${slug}`;
  const direct = registryByLocaleAndSlug.get(directKey);
  if (direct) return direct;

  // Fallback: try English if a user pasted an en slug into another locale.
  const enKey = `en::${slug}`;
  return registryByLocaleAndSlug.get(enKey) || null;
}

/**
 * Localized alternates for a location id, keyed by locale.
 * Delegates to the existing domain helper so sitemap and hreflang generation
 * continue to share the same source of truth.
 */
export function getLocationAlternates(locationId: LocationId): LocationAlternateMap {
  const alternates: LocationAlternateMap = {};
  for (const locale of SUPPORTED_LOCALES) {
    const path = getLocationSeoPath(locationId, locale);
    if (path) {
      alternates[locale] = path;
    }
  }
  return alternates;
}

/**
 * Helper exposed for tests and debugging.
 */
export function getAllLocationSeoRegistryEntries(): LocationSeoRegistryEntry[] {
  buildRegistryOnce();
  return Array.from(registryById.values());
}

