# Location slug simplification — change summary

**Goal:** Make `slugByLocale` the single source of truth for **primary** location page URLs; remove `canonicalSlug` from the domain; keep `seoSlugByLocale` only in SEO_LOCATIONS for programmatic pages (category×location, car×location, brand×location).

**URL architecture (do not change):**
- **Primary SEO locations** (the 4: Halkidiki, Thessaloniki, Thessaloniki Airport, Nea Kallikratia) → **localized single-segment slugs** (e.g. `/{locale}/locations/car-rental-halkidiki`, `/{locale}/locations/enoikiasi-autokinitou-halkidiki`).
- **Hierarchy locations** (subregions and cities, e.g. Sithonia, Kassandra, Nikiti) → **multi-segment hierarchy paths** (e.g. `/{locale}/locations/halkidiki/sithonia`, `/{locale}/locations/halkidiki/sithonia/nikiti`). Do **not** collapse these into single-segment canonical URLs.

**No code has been applied yet.** This document lists every file and change for review before implementation.

---

## 1. Domain types

**File:** `domain/locationSeo/types.ts`

| Change | Detail |
|--------|--------|
| **LocationSeoRepoItem** | Remove `canonicalSlug: string`. |
| **LocationSeoResolved** | Remove `canonicalSlug: string`. Add `slugEn: string` (same value as `slugByLocale.en` from repo), used for homepage pickup param and any “language-independent” lookup. |

---

## 2. Location repo

**File:** `domain/locationSeo/locationSeoRepo.ts`

| Change | Detail |
|--------|--------|
| Remove **canonicalSlug** from every repo item | Delete the `canonicalSlug: "..."` line from all ~24 location objects. Values are redundant with `slugByLocale.en` (they match). |

---

## 3. Location service

**File:** `domain/locationSeo/locationSeoService.ts`

| Function / block | Change |
|------------------|--------|
| **buildLocationSeoRecord** | Stop setting `canonicalSlug`. Set `slugEn: repoItem.slugByLocale[DEFAULT_LOCALE]` (or `slugByLocale.en`). |
| **assertRepositoryIsValid** | Remove the `canonicalSet` / duplicate `canonicalSlug` check. Keep: slugByLocale present for every locale, no duplicate slug per locale. Optionally add: `slugByLocale.en` unique across locations (replaces canonical uniqueness). |
| **getLocationSeoSlug** (export) | No change. Still delegates to SEO_LOCATIONS for programmatic pages, fallback to repo `slugByLocale`. Used only for category/brand/programmatic slugs, not for location page routing. |
| **getLocationBySeoSlug** | **Change:** Resolve from repo only. Replace `getLocationIdBySeoSlug(locale, slug)` with: find repo item where `item.slugByLocale[locale] === slug` or `item.slugByLocale.en === slug`, then `buildLocationSeoRecord(locale, item)`. Remove dependency on `getLocationIdBySeoSlug` for this function. |
| **getLocationPathFromLocation** | **Do not collapse hierarchy.** Keep current behaviour: (1) If location is in SEO_LOCATIONS → single-segment from `getLocationSeoSlugFromSeoLocations` (or, after simplification, from repo `slugByLocale[locale]` for primary locations only). (2) Else if `getLocationPathSegments(location.id)` returns segments → **multi-segment** path `/{locale}/locations/{segments.join("/")}` for hierarchy locations. (3) Else fallback `/{locale}/locations/{location.slug}`. So primary SEO locations use localized single-segment slugs; hierarchy locations keep multi-segment paths. |
| **getLocationByCanonicalSlug** | **Change:** Implement via English slug. Find repo item where `item.slugByLocale.en === slugCandidate`. Keep the same function name and signature for callers; JSDoc: “Find a location by English slug (language-independent).” |
| **getLocationByAnySlug** | **Change:** Find repo item only by `Object.values(item.slugByLocale).includes(slugCandidate)`; remove `item.canonicalSlug === slugCandidate`. |
| **getHomepageSearchUrl** | **Change:** Rename second parameter to `locationSlugEn` (or keep name and document). Behavior: use `slugByLocale.en` as the pickup param value. Callers must pass `location.slugEn`. |
| **switchPathLocale** | **Change:** When resolving current slug, find repo item by `Object.values(item.slugByLocale).includes(currentSlug)` only; remove `item.canonicalSlug === currentSlug`. |

**Imports:** Remove `getLocationIdBySeoSlug` from `@domain/seoPages/seoPageRegistry` if it is no longer used in this file (only `getLocationBySeoSlug` was using it for routing; after the change it is not). Keep `getLocationSeoSlugFromSeoLocations` only if still used for `getLocationSeoSlug` fallback; for `getLocationPathFromLocation` we remove its use.

---

## 4. Middleware

**File:** `middleware.ts`

| Change | Detail |
|--------|--------|
| **legacyLocationByCanonicalSlug** | Rename to e.g. `legacyLocationByEnSlug`. Build map from English slug to location id: `getAllLocationsForLocale("en").map((loc) => [loc.slug, loc.id])` (since for locale `en`, `loc.slug` is `slugByLocale.en`). So keys stay the same (e.g. `car-rental-halkidiki`). |
| **buildLegacyLocationRedirect** | Use the new map name. Logic unchanged: match path segment to map key → get location → redirect to `getLocationPathFromLocation(locale, location)` (primary = single-segment, hierarchy = multi-segment). |

---

## 5. Locations page

**File:** `app/[locale]/locations/[[...path]]/page.js`

| Change | Detail |
|--------|--------|
| **CTA href** | Replace `location.canonicalSlug` with `location.slugEn`. Use `getHomepageSearchUrl(locale, location.slugEn)`. |
| **generateStaticParams** | Optional improvement: include **primary** location single-segment paths and **hierarchy** paths from `getLocationHierarchyRouteParams()` so both `/{locale}/locations/{slug}` and `/{locale}/locations/halkidiki/sithonia/nikiti` are predeclared. Do not generate only single-segment for hierarchy locations. |

---

## 6. Location SEO registry

**File:** `domain/locationSeo/locationSeoRegistry.ts`

| Change | Detail |
|--------|--------|
| **LocationSeoRegistryEntry** | Remove `canonicalSlug`. Keep `seoSlugByLocale` (it is built from repo `slugByLocale` here). If any code needs “English slug” from the registry, use `entry.seoSlugByLocale.en` (same as repo). |
| **buildRegistryOnce** | Stop setting `canonicalSlug` on the entry. |

---

## 7. Sitemap and hreflang

**Files:** `lib/sitemap/sitemapBuilder.ts`, `services/seo/metadataBuilder.ts`

| Change | Detail |
|--------|--------|
| **Sitemap** | No change to logic. It uses `getLocationPathFromLocation(locale, localizedLocation)`, which already returns single-segment for primary locations and multi-segment for hierarchy locations. Sitemap and hreflang stay correct. |
| **Metadata** | No change. Still uses `getLocationPathFromLocation` and `getLocationAlternatesById`. |

---

## 8. Other call sites

| File | Current usage | Change |
|------|----------------|--------|
| **app/[locale]/cars/[slug]/page.js** | `canonicalSlug` there is for **car** slug, not location. | No change. |
| **docs/HOW_TO_ADD_LOCATION.md** | Describes `canonicalSlug`, CTA URL, static params. | Update: remove references to `canonicalSlug`. Document that CTA uses `getHomepageSearchUrl(locale, location.slugEn)` and that “English slug” (`slugByLocale.en`) is used for the pickup param. Update static params section if we change generateStaticParams. |
| **docs/adr/ADR-001-locale-routing-and-location-seo.md** | Mentions canonical slug for legacy redirects. | Update: say legacy redirects use English slug (`slugByLocale.en`); source of truth is repo with `slugByLocale` (no `canonicalSlug`). |

---

## 9. SEO_LOCATIONS and programmatic pages

**File:** `domain/seoPages/seoPageRegistry.ts`

| Change | Detail |
|--------|--------|
| **SEO_LOCATIONS** | Keep `seoSlugByLocale` as-is. Used for programmatic page slugs (e.g. `automatic-car-rental-halkidiki`, `toyota-yaris-rental-car-rental-halkidiki`). |
| **getLocationSeoSlug** (seoPageRegistry) | No change. Still returns `seoSlugByLocale[locale] ?? seoSlugByLocale.en` for the 4 locations. Used by category×location, programmatic, and brand page slug building. |
| **getLocationIdBySeoSlug** | Keep. Still used by programmatic/seo page resolution. Not used for location page routing after we change `getLocationBySeoSlug` in locationSeoService to use repo only. |

So: **primary** location page URLs use localized single-segment (repo `slugByLocale` or SEO_LOCATIONS); **hierarchy** location page URLs keep multi-segment paths from `getLocationPathSegments`. **Programmatic** pages (category, car×location, brand) keep using SEO_LOCATIONS’ `seoSlugByLocale` for the location part of their slugs.

---

## 10. Validation rules (summary)

- **slugByLocale** must exist for every `SUPPORTED_LOCALES` entry (already enforced).
- No duplicate slug per locale across locations (already enforced).
- Optionally: **slugByLocale.en** must be unique across all locations (replaces previous canonicalSlug uniqueness).

---

## 11. URL verification (after changes)

**Primary (single-segment)** — must still resolve:

| URL | Expected |
|-----|----------|
| `/en/locations/car-rental-halkidiki` | Halkidiki (repo `slugByLocale.en`) |
| `/ru/locations/arenda-avto-halkidiki` | Halkidiki (repo `slugByLocale.ru`) |
| `/el/locations/enoikiasi-autokinitou-halkidiki` | Halkidiki (repo `slugByLocale.el`) |

**Hierarchy (multi-segment)** — must remain canonical (do not redirect to single-segment):

| URL | Expected |
|-----|----------|
| `/en/locations/halkidiki/sithonia` | Sithonia (subregion) |
| `/en/locations/halkidiki/sithonia/nikiti` | Nikiti (city) |
| `/el/locations/halkidiki/sithonia/nikiti` | Nikiti (same path pattern, locale-prefixed) |

Resolution: single segment → `getLocationBySeoSlug` (primary); multi-segment → `getLocationByPath`. Hierarchy URLs are not collapsed to single-segment.

---

## 12. Legacy redirects (after changes)

- **Legacy map:** Built from `getAllLocationsForLocale("en")` → `[loc.slug, loc.id]` (loc.slug = slugByLocale.en). So keys are unchanged (e.g. `car-rental-thessaloniki`, `car-rental-halkidiki`).
- **Paths:** `/car-rental-halkidiki` or `/en/locations/car-rental-halkidiki` (when slug equals English slug) → redirect to `getLocationPathFromLocation(locale, location)`. For primary locations that is single-segment; for hierarchy locations that is multi-segment (unchanged). Legacy URLs still redirect to the correct canonical URL.

---

## 13. Checklist before applying

- [ ] Types: remove canonicalSlug, add slugEn to LocationSeoResolved; remove from LocationSeoRepoItem.
- [ ] Repo: remove canonicalSlug from every item.
- [ ] locationSeoService: buildLocationSeoRecord (slugEn), assertRepositoryIsValid (drop canonical check, optional slugEn uniqueness), getLocationBySeoSlug (repo lookup), **getLocationPathFromLocation (keep current: primary = single-segment, hierarchy = multi-segment)**, getLocationByCanonicalSlug (by slugByLocale.en), getLocationByAnySlug (slugByLocale only), getHomepageSearchUrl (param = slugEn), switchPathLocale (slugByLocale only).
- [ ] Middleware: legacy map from en slug → id; use new map name.
- [ ] Locations page: CTA use location.slugEn.
- [ ] locationSeoRegistry: remove canonicalSlug from type and build.
- [ ] Docs: HOW_TO_ADD_LOCATION, ADR-001 updated.
- [ ] Run tests and manual check: primary single-segment URLs, hierarchy multi-segment URLs (e.g. /en/locations/halkidiki/sithonia/nikiti), and legacy redirects.

---

**End of summary.** Proceed with implementation only after approval.
