# How to add a new location (SEO)

This guide describes how to add a new location to the location SEO system so that it gets its own page, sitemap entries, hreflang alternates, and JSON-LD. No changes are required in React components, middleware, or sitemap builder logic—only in the domain layer.

## Prerequisites

- The location is part of the existing hierarchy: it should have a **parent** (e.g. a Halkidiki city under `HALKIDIKI` or `SITHONIA`/`KASSANDRA`) or be a new top-level hub.
- You have (or will add) at least **English** content; other locales fall back to English if omitted.

## Steps

### 1. Add constants in `domain/locationSeo/locationSeoKeys.ts`

- Add a new entry to **`LOCATION_IDS`** (e.g. `NEA_KALLIKRATIA: "nea-kallikratia"`).
- Add a corresponding entry to **`LOCATION_CONTENT_KEYS`** (e.g. `NEA_KALLIKRATIA: "location.neaKallikratia"`).

Use kebab-case for the string value in `LOCATION_IDS`; use a unique, descriptive key for `LOCATION_CONTENT_KEYS`. The TypeScript types `LocationId` and `LocationContentKey` will include the new values automatically.

### 2. Add per-locale content in `domain/locationSeo/locationSeoRepo.ts`

- In **`locationContentByKeyRaw`**, add a new key using your `LOCATION_CONTENT_KEYS.*` constant.
- For each locale you support, provide an object with:
  - `shortName`, `h1`, `seoTitle`, `seoDescription`, `introText`
  - `areaServed` (array of strings), `pickupLocation`, `offerName`, `offerDescription`
- You **must** provide at least **`en`**. Other locales can be omitted; they will fall back to English via `expandLocaleRecord`.

Example shape (English only; others fallback):

```ts
[LOCATION_CONTENT_KEYS.NEA_KALLIKRATIA]: {
  en: {
    shortName: "Nea Kallikratia",
    h1: "Car Rental in Nea Kallikratia",
    seoTitle: "Car Rental in Nea Kallikratia | Natali Cars",
    seoDescription: "Rent a car in Nea Kallikratia with...",
    introText: "...",
    areaServed: ["Nea Kallikratia", "..."],
    pickupLocation: "Nea Kallikratia Pickup Point",
    offerName: "Nea Kallikratia Car Hire Offer",
    offerDescription: "...",
  },
},
```

### 3. Add the location to the repo array in `domain/locationSeo/locationSeoRepo.ts`

Append a new item to **`locationSeoRepo`** with:

- **`id`**: your `LOCATION_IDS.*` constant.
- **`canonicalSlug`**: URL slug used for **legacy redirects** (e.g. old `/car-rental-nea-kallikratia` → `/{locale}/locations/car-rental-nea-kallikratia`). Usually the English slug.
- **`locationType`**: one of `"city"` | `"airport"` | `"region"` | `"subRegion"`.
- **`contentKey`**: your `LOCATION_CONTENT_KEYS.*` constant.
- **`parentId`**: parent’s `LOCATION_IDS.*` or `null` if top-level.
- **`childIds`**: array of `LOCATION_IDS.*` for sub-locations, or `[]`.
- **`slugByLocale`**: object with a slug per `SUPPORTED_LOCALES` (en, ru, uk, el, de, bg, ro, sr). These are the segments used in `/[locale]/locations/[slug]`. Must be unique per locale across all locations.

Then update the **parent** location’s **`childIds`** to include the new location’s `id`.

Example:

```ts
{
  id: LOCATION_IDS.NEA_KALLIKRATIA,
  canonicalSlug: "car-rental-nea-kallikratia",
  locationType: "city",
  contentKey: LOCATION_CONTENT_KEYS.NEA_KALLIKRATIA,
  parentId: LOCATION_IDS.HALKIDIKI,
  childIds: [],
  slugByLocale: {
    en: "car-rental-nea-kallikratia",
    ru: "arenda-avto-nea-kallikratia",
    uk: "orenda-avto-nea-kallikratia",
    el: "enoikiasi-autokinitou-nea-kallikratia",
    de: "mietwagen-nea-kallikratia",
    bg: "koli-pod-naem-nea-kallikratia",
    ro: "inchirieri-auto-nea-kallikratia",
    sr: "rent-a-car-nea-kallikratia",
  },
},
```

And in the parent (e.g. Halkidiki):

```ts
childIds: [LOCATION_IDS.SITHONIA, LOCATION_IDS.KASSANDRA, LOCATION_IDS.NEA_KALLIKRATIA],
```

### 4. No further code changes required

- **Middleware**: Legacy redirect for `canonicalSlug` is built from `locationSeoRepo`; new locations are picked up automatically.
- **Sitemap**: `buildLocalizedSitemap` uses `getAllLocationsForLocale` and `getLocationAlternatesById`; new locations appear in the sitemap for all locales with correct hreflang.
- **Page**: `app/[locale]/locations/[slug]/page.js` resolves the location by locale + slug and renders H1, intro, and links (hub, parent, children, siblings, cars) from the domain; metadata and JSON-LD use the same domain model.
- **Static params**: `getLocationRouteParams()` is derived from the repo, so new locale+slug combinations are generated at build time.

### 5. Optional: add more locales to content

Edit `locationContentByKeyRaw` for the new content key and add `ru`, `uk`, `el`, etc. with the same fields as `en`. Omitted locales keep using the default locale (English) content.

### 6. Validation

- Run the app and open `/{locale}/locations/{slug}` for the new location (each locale slug from `slugByLocale`).
- Run sitemap tests: `npm test -- lib/sitemap` (or your test command) to ensure no duplicate URLs and that all entries have `x-default`.
- Run build: `npm run build` to ensure `generateStaticParams` and metadata resolve without errors.

## Summary checklist

- [ ] `locationSeoKeys.ts`: add `LOCATION_IDS.*` and `LOCATION_CONTENT_KEYS.*`
- [ ] `locationSeoRepo.ts`: add content in `locationContentByKeyRaw` (at least `en`)
- [ ] `locationSeoRepo.ts`: add item to `locationSeoRepo` and update parent’s `childIds`
- [ ] Run tests and build

Adding a new **locale** (language) is a separate change: extend `SUPPORTED_LOCALES` in `locationSeoKeys.ts` and add the locale to all `slugByLocale` and to the content records that should have translations.

---

## City pages that redirect CTA to main search

Location pages with **`locationType: "city"`** (e.g. Halkidiki city landings) are SEO-only: they do **not** introduce a separate booking flow. The primary call-to-action is a button that sends users to the **main search (homepage)** with the location preselected via a query parameter.

- **CTA URL** is built in the domain layer: use **`getHomepageSearchUrl(locale, locationCanonicalSlug)`** from `locationSeoService`. It returns `/{locale}?pickup={canonicalSlug}`. Do not build this URL by string concatenation in components.
- **CTA label** comes from the locale dictionary template **`links.locationSearchCtaLabel`** (e.g. “Search cars in {locationName}”), filled with the location’s **`shortName`** via **`getLocationSearchCtaLabel(locale, locationShortName)`**.
- **Query param** name is **`HOMEPAGE_PICKUP_PARAM`** (`"pickup"`); the value is the location’s **canonical slug** so the app can resolve it regardless of locale.

City pages can include optional content blocks **`pickupGuidance`**, **`nearbyPlaces`** (array), and **`faq`** (array of `{ question, answer }`) in `locationContentByKeyRaw` for richer, unique body content. The hub (e.g. Halkidiki) page lists all child locations (including cities) as internal links; each city page shows the CTA and these blocks when present.
