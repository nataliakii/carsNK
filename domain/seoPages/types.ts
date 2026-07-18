import type { SupportedLocale } from "@domain/locationSeo/locationSeoKeys";

export interface CarCategoryFaqItem {
  question: string;
  answer: string;
}

export interface CarCategorySeoContent {
  h1: string;
  seoTitle: string;
  seoDescription: string;
  introText: string;
  faq: CarCategoryFaqItem[];
}

export type CarCategoryFilterType =
  | "transmission"
  | "classes"
  | "familySeats"
  | "cheapest";

export interface CarCategoryFilter {
  type: CarCategoryFilterType;
  value?: string | string[];
  minSeats?: number;
}

export interface CarCategoryDefinition {
  id: string;
  filter: CarCategoryFilter;
  content: Record<SupportedLocale, CarCategorySeoContent>;
}

export interface SeoLocationDefinition {
  id: string;
  locationId: string;
  /** Single source of truth for location page URL segment: /{locale}/locations/{seoSlugByLocale[locale]} */
  seoSlugByLocale: Record<SupportedLocale, string>;
  /** @deprecated Use seoSlugByLocale for routing. Kept for backward compatibility. */
  slugSuffix?: string;
  /** @deprecated Use seoSlugByLocale for routing. Kept for backward compatibility. */
  slugByLocale?: Record<SupportedLocale, string>;
  nameByLocale: Record<SupportedLocale, string>;
}

export interface SeoPageEntry {
  seoSlug: string;
  categoryId: string;
  locationId: string;
}

export interface ProgrammaticPageEntry {
  seoSlug: string;
  carSlug: string;
  locationId: string;
}

export interface BrandPageEntry {
  seoSlug: string;
  brand: string;
  brandSlug: string;
  locationId: string;
  locationSlugSuffix: string;
}
