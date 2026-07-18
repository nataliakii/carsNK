# SEO pages: hreflang and canonical audit report

**Scope:** Category×location pages, programmatic (car×location) pages, brand×location pages under `/{locale}/[seoSlug]`. Focus on hreflang generation, canonical URLs, sitemap entries, and programmatic slug localization.

**No code was modified.** This is an audit-only report.

---

## 1. Data flow summary

| Page type        | Slug pattern                    | Resolution                         | Alternates source (page)                    | Alternates source (sitemap)                    |
|------------------|----------------------------------|------------------------------------|---------------------------------------------|-----------------------------------------------|
| Category×location| `{category}-car-rental-{loc}`   | `getSeoPageBySlug(locale, slug)`   | `getSeoPageAlternates()` → category branch  | `getSeoPageAlternatesForCategoryLocation()`   |
| Brand×location   | `{brand}-car-rental-{loc}`      | `resolveBrandPage()` → `resolveBrandFromSlug()` | `getSeoPageAlternates()` → **fallback**  | `getBrandPageAlternates(brandSlug, locationId)` |
| Programmatic     | `{car}-rental-{loc}`            | `getProgrammaticPageBySlug(locale, slug)` | `getSeoPageAlternates()` → programmatic branch | Inline: `buildProgrammaticSlug(car, getLocationSeoSlug(loc))` |

---

## 2. Hreflang generation

### 2.1 Where hreflang is set

- **`app/[locale]/[seoSlug]/page.js`** `generateMetadata`:
  - Category: `buildHreflangAlternates(getSeoPageAlternates(locale, slug))`
  - Brand: same call
  - Programmatic: same call

So all three page types use **`getSeoPageAlternates(locale, slug)`** for the alternate map, then **`buildHreflangAlternates()`** to add absolute URLs and `x-default`.

### 2.2 `getSeoPageAlternates()` behavior

**`domain/seoPages/seoPageRegistry.ts`:**

1. **Category:** If `getSeoPageBySlug(locale, slug)` returns an entry → `getSeoPageAlternatesForCategoryLocation(entry.categoryId, entry.locationId)`. Builds `/{loc}/getCategoryLocationSeoSlug(cat, locId, loc)` for each locale. **Correct** – localized slug per locale.
2. **Programmatic:** If `getProgrammaticPageBySlug(locale, slug)` returns → for each locale builds `getSeoPagePath(loc, buildProgrammaticSlug(carSlug, getLocationSeoSlug(locationId, loc)))`. **Correct** – localized slug per locale.
3. **Brand:** Neither category nor programmatic matches → **fallback:** for each locale `fallback[l] = getSeoPagePath(l, seoSlug)` with the **same** `seoSlug` (current request slug).

So for **brand pages**, hreflang alternates reuse the **current locale’s slug** for every locale.

**Example:** On `/ru/toyota-car-rental-arenda-avto-halkidiki` (Russian brand page), `getSeoPageAlternates("ru", "toyota-car-rental-arenda-avto-halkidiki")` hits the fallback. So:

- `en` → `/en/toyota-car-rental-arenda-avto-halkidiki`
- `el` → `/el/toyota-car-rental-arenda-avto-halkidiki`
- etc.

But the real English URL for that page is `/en/toyota-car-rental-car-rental-halkidiki` (location part from `getLocationSeoSlug(halkidiki, "en")` = `"car-rental-halkidiki"`). So:

- The **en** and **el** (and other) hreflang URLs either 404 or point to a different page (if that slug exists in another context).
- **x-default** is set from the same wrong map (e.g. to the Russian slug for all), so it can point to a non-canonical or non-existing URL.

**Conclusion:** Hreflang is correct for **category** and **programmatic** pages. For **brand** pages it is **wrong**: alternates (and thus x-default) can point to non-existing or incorrect slugs because there is no brand-specific branch in `getSeoPageAlternates()`.

---

## 3. Potential hreflang mismatches

| Issue | Severity | Page type | Description |
|-------|----------|-----------|-------------|
| **Brand pages use fallback alternates** | High | Brand×location | `getSeoPageAlternates()` has no brand branch. Fallback uses the same slug for all locales, so hreflang for non-current locales often points to URLs that do not exist or are wrong (e.g. `/en/toyota-car-rental-arenda-avto-halkidiki` instead of `/en/toyota-car-rental-car-rental-halkidiki`). |
| **x-default for brand pages** | High | Brand×location | x-default is derived from the same fallback map; it can point to a non-canonical or invalid URL. |
| Category / programmatic | None found | Category, Programmatic | Alternates are built from the same logic as slug generation (getCategoryLocationSeoSlug, buildProgrammaticSlug + getLocationSeoSlug per locale). No mismatch. |

---

## 4. Canonical URLs

### 4.1 How canonical is set

In **`app/[locale]/[seoSlug]/page.js`** `generateMetadata`:

- Category: `canonical: toAbsoluteUrl(getSeoPagePath(locale, slug))`
- Brand: `canonical: toAbsoluteUrl(getSeoPagePath(locale, slug))`
- Programmatic: `canonical: toAbsoluteUrl(getSeoPagePath(locale, slug))`

So canonical is always **`getSeoPagePath(locale, slug)`** = **`/{locale}/{slug}`**, i.e. the current request URL.

### 4.2 Verification

- **getSeoPagePath(locale, seoSlug)** is `/${locale}/${seoSlug}` (no trailing slash, no query).
- The page is rendered at `/[locale]/[seoSlug]`, so the canonical URL matches the actual URL structure.

**Conclusion:** No canonical conflicts. Canonical always matches `getSeoPagePath()` and the route structure.

---

## 5. Sitemap entries

### 5.1 How sitemap URLs and alternates are built

- **Category×location:** For each locale, `getAllSeoPageSlugs(locale)`; for each entry, `url = getSeoPagePath(locale, seoPage.seoSlug)`, `alternates = getSeoPageAlternatesForCategoryLocation(categoryId, locationId)`. So sitemap uses the same localized slug and same alternate logic as the category branch of `getSeoPageAlternates()`.
- **Brand×location:** For each locale, `buildAllBrandPageSlugs(publicCars, locale)`; for each brand page, `url = getSeoPagePath(locale, brandPage.seoSlug)`, `alternates = getBrandPageAlternates(brandSlug, locationId)` (which builds `buildBrandPageSlug(brandSlug, getLocationSeoSlug(locationId, loc))` per locale). So sitemap has **correct** localized brand alternates.
- **Programmatic:** For each locale, `buildAllProgrammaticSlugs(carSlugs, locale)`; for each prog, `url = getSeoPagePath(locale, prog.seoSlug)`, `alternates` built inline with `buildProgrammaticSlug(prog.carSlug, getLocationSeoSlug(prog.locationId, loc))` per locale. So sitemap matches programmatic alternates logic.

### 5.2 Sitemap vs page hreflang

| Page type   | Sitemap alternates | Page (metadata) alternates | Match? |
|-------------|--------------------|----------------------------|--------|
| Category    | getSeoPageAlternatesForCategoryLocation | getSeoPageAlternates → category branch (same) | Yes |
| Programmatic| buildProgrammaticSlug + getLocationSeoSlug per locale | getSeoPageAlternates → programmatic branch (same) | Yes |
| Brand       | getBrandPageAlternates (localized slug per locale)   | getSeoPageAlternates → **fallback** (same slug all locales) | **No** |

So: **sitemap URLs and sitemap alternates** use the correct structure for all three types. **Page-level hreflang** is wrong only for **brand** pages (fallback reuses one slug for all locales). That creates an inconsistency: the same brand page is listed in the sitemap with correct per-locale URLs and alternates, but the HTML of that page has wrong hreflang links.

---

## 6. Sitemap inconsistencies

| Finding | Severity | Description |
|---------|----------|-------------|
| **Sitemap structure** | None | All sitemap entries use `getSeoPagePath(locale, slug)`. URL structure is consistent with canonicals and route. |
| **Category sitemap** | None | One entry per (locale, category, location); alternates from getSeoPageAlternatesForCategoryLocation. No inconsistency. |
| **Programmatic sitemap** | None | One entry per (locale, car, location); alternates built like getSeoPageAlternates programmatic branch. No inconsistency. |
| **Brand sitemap** | None | One entry per (locale, brand, location); alternates from getBrandPageAlternates. Sitemap itself is consistent. |
| **Drift (programmatic/brand)** | Low | Sitemap is built with `cars` passed in (e.g. at build or at sitemap request time). If the car list changes, some programmatic/brand URLs may exist at runtime but not in the sitemap, or vice versa. Not a hreflang/canonical bug but a data-freshness consideration. |

---

## 7. Programmatic page slug localization

### 7.1 Slug format and resolution

- **Slug:** `{carSlug}-rental-{locationSlug}` where `locationSlug = getLocationSeoSlug(locationId, locale)` (from SEO_LOCATIONS.seoSlugByLocale).
- **Generated:** `buildAllProgrammaticSlugs(carSlugs, locale)` → for each (car, location) uses `getLocationSeoSlug(locationId, locale)`.
- **Resolved:** `getProgrammaticPageBySlug(locale, slug)` → for each location, suffix `-rental-${getLocationSeoSlug(locationId, locale)}`; if slug ends with that suffix, extract car slug and return.

So the same logical page (e.g. Toyota Yaris × Halkidiki) has one slug per locale, e.g.:

- en: `toyota-yaris-rental-car-rental-halkidiki`
- ru: `toyota-yaris-rental-arenda-avto-halkidiki`
- el: `toyota-yaris-rental-enoikiasi-autokinitou-halkidiki`

Hreflang and sitemap both build these per-locale slugs via `getLocationSeoSlug(locationId, loc)`. So **programmatic slug localization is consistent** with hreflang and sitemap (and no hreflang points to a non-existing programmatic slug when using the programmatic branch).

### 7.2 Category page slug localization

- **Slug:** `{categoryId}-car-rental-{locationSlug}` with `getCategoryLocationSeoSlug(categoryId, locationId, locale)` = `getLocationSeoSlug(locationId, locale)` for the location part.
- Same `getLocationSeoSlug` as programmatic (SEO_LOCATIONS). So **category** and **programmatic** share the same location-slug localization and stay consistent.

Examples that were checked:

- `/{locale}/automatic-car-rental-halkidiki` (en) → `automatic-car-rental-car-rental-halkidiki` (category).
- `/{locale}/cheap-car-rental-halkidiki` (en) → `cheap-car-rental-car-rental-halkidiki` (category).
- Other locales get the same pattern with localized location slug (e.g. ru: `automatic-car-rental-arenda-avto-halkidiki`). No inconsistency found.

---

## 8. Duplicate URL risks

### 8.1 Same slug, different page type

- **Category slug:** `{categoryId}-car-rental-{loc}`. Category ids: automatic, cheap, cabrio, family, luxury.
- **Brand slug:** `{brandSlug}-car-rental-{loc}`. `extractUniqueBrands` skips brands whose `toBrandSlug(brand)` is in `CATEGORY_IDS_SET`. So no brand with slug `automatic`, `cheap`, etc. So **category and brand do not produce the same slug**.
- **Programmatic slug:** `{carSlug}-rental-{loc}` (no `-car-`). So programmatic and category/brand differ. No overlap.

So there is **no duplicate URL** between category, brand, and programmatic for the same (locale, slug).

### 8.2 Sitemap duplicate check

`validateSitemapEntries()` collects duplicate URLs and the sitemap builder throws if any are found. So if the same URL were ever emitted twice (e.g. from two sections), the build would fail. Currently, category/brand/programmatic emit disjoint slug shapes, so no duplicate from that. The only remaining risk would be duplicate (locale, slug) within one section (e.g. two brands with same brandSlug), which the current logic does not produce.

---

## 9. Summary table

| Check | Category | Brand | Programmatic |
|-------|----------|--------|--------------|
| Hreflang uses getSeoPageAlternates() | Yes | Yes (but wrong branch) | Yes |
| Hreflang alternates correct per locale | Yes | **No (fallback)** | Yes |
| Canonical = getSeoPagePath(locale, slug) | Yes | Yes | Yes |
| Canonical matches URL structure | Yes | Yes | Yes |
| Sitemap URL = getSeoPagePath(locale, slug) | Yes | Yes | Yes |
| Sitemap alternates correct | Yes | Yes | Yes |
| Page hreflang = sitemap alternates | Yes | **No** | Yes |
| Risk of hreflang → non-existing slug | No | **Yes** | No |
| Duplicate URL risk (between types) | No | No | No |

---

## 10. Recommendations (no code changes in this audit)

1. **Brand pages – hreflang:** Add a **brand** branch in `getSeoPageAlternates()` so that when the slug is a brand×location page, alternates are built the same way as in the sitemap (e.g. using `getBrandPageAlternates(brandSlug, locationId)`). That requires resolving the slug to (brandSlug, locationId) without fetching cars if possible, or exposing a small helper that builds alternates from (brandSlug, locationId) and calling it from the page when we already have `brandPage` (and optionally from `getSeoPageAlternates` if we can pass or resolve brand data).
2. **x-default for brand:** Fixing the brand alternates will fix x-default, since it is derived from the same map in `buildHreflangAlternates`.
3. **Optional:** Add a test that for each page type (category, brand, programmatic), the alternates returned by `getSeoPageAlternates(locale, slug)` match the alternates used in the sitemap for that (locale, slug), and that every alternate URL in the map resolves to a page (or at least to a slug that is generated for that locale in the sitemap).

---

**End of audit.**
