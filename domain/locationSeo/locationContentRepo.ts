/*
 * HOW TO EDIT LOCATION PAGE TEXTS
 *
 * All page body texts for location pages are served from this module.
 *
 * Structure:
 *
 * LOCATION_PAGE_CONTENT
 *   locationId (e.g. "nea-kallikratia")
 *     locale (en, ru, uk, el, de, bg, ro, sr)
 *       intro
 *       mainInfo
 *       distanceToThessaloniki
 *       pickupGuidance
 *       nearbyPlaces
 *       usefulTips
 *       faq
 *
 * If a locale translation is missing, the system automatically falls back to English.
 *
 * To add or edit FAQ:
 *   Edit the "faq" array in the relevant location content.
 *
 * To add useful tips:
 *   Edit the "usefulTips" array.
 *
 * To add distance text:
 *   Edit "distanceToThessaloniki".
 *
 * To add pickup guidance:
 *   Edit "pickupGuidance".
 *
 * Do NOT edit location page body texts in React components.
 * Use getLocationPageContent(locationId, locale) from locationSeoService.
 *
 * Note: SEO metadata (seoTitle, seoDescription) stays in locationSeoRepo.ts.
 */

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./locationSeoKeys";
import { locationContentByKey } from "./locationSeoRepo";
import { locationSeoRepo } from "./locationSeoRepo";
import type { LocationSeoFaqItem } from "./types";

export interface LocationPageContentItem {
  intro: string;
  mainInfo: string;
  distanceToThessaloniki: string;
  pickupGuidance: string;
  nearbyPlaces: string[];
  usefulTips: string[];
  faq: LocationSeoFaqItem[];
}

type LocationPageContentMap = Record<string, Partial<Record<SupportedLocale, LocationPageContentItem>>>;

function extractBodyContent(
  content: {
    introText?: string;
    mainInfoText?: string;
    distanceToThessalonikiText?: string;
    pickupGuidance?: string;
    nearbyPlaces?: string[];
    usefulTips?: string[];
    faq?: LocationSeoFaqItem[];
  } | null
): LocationPageContentItem {
  if (!content) {
    return {
      intro: "",
      mainInfo: "",
      distanceToThessaloniki: "",
      pickupGuidance: "",
      nearbyPlaces: [],
      usefulTips: [],
      faq: [],
    };
  }
  return {
    intro: content.introText ?? "",
    mainInfo: content.mainInfoText ?? "",
    distanceToThessaloniki: content.distanceToThessalonikiText ?? "",
    pickupGuidance: content.pickupGuidance ?? "",
    nearbyPlaces: content.nearbyPlaces ?? [],
    usefulTips: content.usefulTips ?? [],
    faq: content.faq ?? [],
  };
}

function buildLocationPageContentMap(): LocationPageContentMap {
  const map: LocationPageContentMap = {};
  for (const item of locationSeoRepo) {
    const contentByLocale = locationContentByKey[item.contentKey];
    if (!contentByLocale) continue;
    const entries: Partial<Record<SupportedLocale, LocationPageContentItem>> = {};
    for (const locale of SUPPORTED_LOCALES) {
      const content = contentByLocale[locale];
      entries[locale] = extractBodyContent(content);
    }
    map[item.id] = entries;
  }
  return map;
}

/** All location page body content, keyed by locationId → locale → content. */
export const LOCATION_PAGE_CONTENT = buildLocationPageContentMap();
