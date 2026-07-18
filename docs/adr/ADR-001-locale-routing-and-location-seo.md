# ADR-001: Locale routing and location SEO

## Status

Accepted.

## Context

The car rental site is multilingual and needs production-grade SEO with:

- Locale as part of the URL for clear language targeting and hreflang.
- Location-specific SEO pages (Thessaloniki, Thessaloniki Airport, Halkidiki, Sithonia, Kassandra, and extensible to more Halkidiki cities).
- A single domain model driving metadata, hreflang, sitemap, and JSON-LD.
- No hardcoded SEO text in components; all content from a centralized domain/content layer.
- Backwards compatibility: old URLs must not 404 (301 redirects to canonical locale-prefixed URLs).

## Current behaviour (as implemented)

### Locale determination

- **Cookie** `NEXT_LOCALE`: if present and supported, it wins.
- **Accept-Language**: parsed and matched against `SUPPORTED_LOCALES` (en, ru, uk, el, de, bg, ro, sr); first match used.
- **Fallback**: `en` (DEFAULT_LOCALE).

Implementation: `domain/locationSeo/locationSeoService.ts` → `detectBestLocale({ cookieLocale, acceptLanguageHeader })`.

### URL scheme

- **Canonical pattern**: `/{locale}/...` (e.g. `/en`, `/en/locations/car-rental-thessaloniki`, `/en/cars/toyota-yaris`).
- **Locale segment**: first path segment must be one of `SUPPORTED_LOCALES`; unsupported values (e.g. `/xx/...`) are 301-redirected to the same path with the detected locale.
- **Trailing slashes**: middleware normalises by stripping trailing slashes. Internal links and sitemap use no trailing slash (e.g. `/en/locations/slug`).
- **Root**: `/` is handled by root `app/page.js` (redirect to `/{defaultLocale}`) and by middleware (non-prefixed path → 301 to `/{detectedLocale}{pathname}`).

### Redirect strategy for old URLs

All redirects are **301 (Moved Permanently)**.

1. **Missing locale prefix**  
   Any path without a locale prefix (e.g. `/contacts`, `/cars/toyota-yaris`) → 301 to `/{detectedLocale}{pathname}`. Locale is set via cookie for subsequent requests.

2. **Legacy location URLs**  
   Paths whose single segment matches a **legacy canonical slug** (e.g. `/car-rental-thessaloniki`) → 301 to `/{locale}/locations/{slug}`.  
   - Without prefix: `/{legacySlug}` → `/{detectedLocale}/locations/{slug}`.  
   - With prefix: `/{locale}/car-rental-thessaloniki` → `/{locale}/locations/{slug}`.  
   Legacy slugs are the `canonicalSlug` values from `domain/locationSeo/locationSeoRepo` (e.g. `car-rental-thessaloniki`). Short slugs like `/thessaloniki` are not legacy-redirected unless added to the repo/canonical slug mapping.

3. **Legacy /terms**  
   `/terms` and `/{locale}/terms` → 301 to `/{locale}/rental-terms` (static page path).

4. **Unsupported locale prefix**  
   `/{unsupported}/...` (e.g. `/fr/...`) → 301 to `/{detectedLocale}/...`.

### Location SEO domain model

- **Source of truth**: `domain/locationSeo/locationSeoRepo.ts` — repo array with `id`, `canonicalSlug`, `locationType`, `contentKey`, `parentId`, `childIds`, `slugByLocale`. Per-locale content is keyed by `contentKey` in `locationContentByKey` and `localeSeoDictionary`; no raw SEO strings in page components.
- **Types**: `domain/locationSeo/types.ts` — `LocationSeoRepoItem`, `LocationSeoResolved`, etc.
- **Service**: `domain/locationSeo/locationSeoService.ts` — resolve by locale + slug, canonical path, alternates, hub/location/car links, static page paths.
- **Keys**: `domain/locationSeo/locationSeoKeys.ts` — `LOCATION_IDS`, `LOCATION_CONTENT_KEYS`, `SUPPORTED_LOCALES`, `LOCATION_ROUTE_SEGMENT` (`locations`), `CARS_ROUTE_SEGMENT` (`cars`).

### Route scheme for location pages

- **Chosen scheme**: `/[locale]/locations/[slug]` (e.g. `/en/locations/car-rental-thessaloniki`).  
- Location page: `app/[locale]/locations/[slug]/page.js` — metadata via `buildLocationMetadata(location)`, JSON-LD via `buildAutoRentalJsonLd`, H1/intro and internal links from domain (hub, parent, children, siblings, cars).

### Sitemap and hreflang strategy

- **Sitemap**: `app/sitemap.ts` uses `lib/sitemap/sitemapBuilder.ts` → `buildLocalizedSitemap(cars)`.
- **Entries**: locale roots (`/{locale}`), static pages per locale, location pages `/{locale}/locations/{slug}` (all locales × all locations), car pages `/{locale}/cars/{slug}`. Each entry has `lastModified` and `alternates.languages` (hreflang URLs including `x-default`).
- **Validation**: `validateSitemapEntries(entries)` checks for duplicate URLs and missing `x-default`; used in tests and can be used in build/script.
- **robots.txt**: `app/robots.ts` returns `sitemap: ${baseUrl}/sitemap.xml` (production base URL from env or default).
- **Page-level hreflang**: Metadata builders (`services/seo/metadataBuilder.ts`) set `alternates.canonical` and `alternates.languages` (Next.js maps these to `<link rel="alternate" hreflang="...">`). Same alternate map is used for sitemap and for metadata.

### Metadata and JSON-LD

- **Metadata**: `services/seo/metadataBuilder.ts` — `buildHubMetadata`, `buildLocationMetadata`, `buildCarMetadata`, `buildStaticPageMetadata`. All use domain (locationSeo) or config (site name, base URL) for titles/descriptions; canonical and hreflang from `hreflangBuilder` and `urlBuilder`.
- **JSON-LD**: `services/seo/jsonLdBuilder.ts` — `buildAutoRentalJsonLd` (location/car pages), `buildHubJsonLd` (hub). Schema: AutoRental + LocalBusiness, areaServed, pickupLocation, Offer; contact and aggregate rating from config.

## Decisions

1. **Locale in URL** — All canonical URLs are locale-prefixed. No separate “locale-less” routing layer; one system (middleware + `[locale]` segment) handles detection, redirect, and cookie.
2. **301 for old URLs** — Non-prefixed and legacy paths receive 301 to the canonical locale-prefixed URL to preserve SEO and avoid duplicate content.
3. **Single location SEO model** — One repo and service drive metadata, hreflang, sitemap, and JSON-LD; content is key-based (contentKey / localeSeoDictionary), not inline in components.
4. **Location route** — Use `/[locale]/locations/[slug]`; legacy `car-rental-*` and `/terms` redirected as above.
5. **Trailing slash** — Normalised to no trailing slash in middleware; links and sitemap generated without trailing slash.

## SSG and next-auth SessionProvider

During static generation of `/[locale]/locations/[slug]`, the root layout’s provider tree runs on the server. next-auth’s `SessionProvider` (or its bundle) runs in that context; somewhere in the next-auth/client chain a value is undefined and code destructures property `auth` from it, causing:

`TypeError: Cannot destructure property 'auth' of 'e' as it is undefined.`

**Fixes applied:**

1. **SessionProviderGate** (`app/components/SessionProviderGate.js`) — Renders next-auth’s `SessionProvider` only after client mount (and only on the client). On the server / during SSG it returns `children` and does not load `next-auth/react`, avoiding the crash in that code path. SessionProvider is loaded via `require("next-auth/react")` only when `mounted && !isServer`.

2. **Navbar guard** — `useSession()` can be undefined when no provider is present. In `app/components/Navbar.js`, callers use `const sessionValue = useSession(); const session = sessionValue?.data ?? null` so destructuring never runs on undefined.

3. **Location pages: `force-dynamic`** — Because the app’s client bundle can still include next-auth (e.g. for other routes), SSG of location pages may load that bundle and hit the same error. Therefore `app/[locale]/locations/[slug]/page.js` uses `export const dynamic = "force-dynamic"` so these pages are not pre-rendered at build time; they are server-rendered on demand. This is a workaround until next-auth is fixed or the app is split so location pages never load the auth bundle. Location pages remain cacheable (e.g. with `revalidate` in fetch or route segment config) and do not depend on auth to render.

## Consequences

- Crawlers and users see a single canonical URL per page per locale; hreflang and sitemap are consistent.
- Adding a new location or locale requires updates in the domain (repo + content keys) and optionally middleware if new legacy slugs are introduced; see `docs/HOW_TO_ADD_LOCATION.md`.
- Root `/` and non-prefixed paths always redirect; no 404 for legacy or missing-locale URLs under the defined rules.
