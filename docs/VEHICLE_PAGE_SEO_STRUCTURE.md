# Vehicle page SEO structure — Natali Cars

The vehicle page is implemented at **`app/[locale]/cars/[slug]/page.js`** (localized route, e.g. `/en/cars/toyota-yaris`, `/bg/cars/toyota-yaris`). Existing UI and behaviour are unchanged; only SEO-related content and structure are documented and aligned with the requested checklist.

---

## STEP 1 — Current vehicle page analysis

**Route:** `app/[locale]/cars/[slug]/page.js` (not `app/cars/[slug]` — the site uses locale-prefixed URLs).

**Data fetching (server-side):**
- `fetchAllCars()`, `reFetchActiveOrders()`, `fetchCompany(COMPANY_ID)` in parallel.
- Car resolved by `params.slug` (case-insensitive match, then redirect to canonical slug if different).
- MongoDB ObjectId in URL → redirect to `/{locale}/cars/{car.slug}`.

**Components used:**
- **SingleCarDisplay** — main hero: car card, gallery, booking calendar, price. Receives `carSlug={params.slug}`; Feed provides `cars`, `orders`, `company` from context.
- **SeoBreadcrumbNav** — breadcrumb above content.
- **SeoPillarLinksBlock** — links to location pages (Halkidiki, Airport, Nea Kallikratia).
- **SeoIntroBlock** — H1 + SEO intro text.
- **SeoQuickSpecsBlock** — at-a-glance specs (Transmission, Fuel, Seats, AC, Luggage).
- **SeoCarFeaturesBlock** — feature list (checkmarks).
- **SeoVehicleSpecsBlock** — full vehicle specifications table.
- **SeoLinksBlock** — pickup locations, related cars, category links, brand links.
- **SeoWhyRentBlock** — “Why rent this car” bullets (when present).
- **SeoFaqBlock** — FAQ.
- **SeoSingleLinkBlock** — “Back to hub” link.

No changes were made to SingleCarDisplay, Feed, or booking/gallery/price behaviour.

---

## STEP 2 — SEO metadata

**Implementation:** Next.js Metadata API via **`generateMetadata`** and **`buildCarMetadata`** in `services/seo/metadataBuilder.ts`.

- **Title:** e.g. “Rent Toyota Yaris Automatic in Halkidiki | Natali Cars” (from `buildCarSeoText` → `seoTitle`).
- **Description:** e.g. “Rent Toyota Yaris Automatic with pickup at Thessaloniki Airport (SKG) or Halkidiki. Automatic transmission, fuel efficient and comfortable.” (from `carSeo.seoDescription`).
- **Canonical:** Absolute URL: `https://natali-cars.com/{locale}/cars/{carSlug}` (from `toAbsoluteUrl(canonicalPath)`; `canonicalPath = \`/${locale}/cars/${encodeURIComponent(carSlug)}\``).
- **Hreflang:** Set in `buildBaseMetadata` via `getCarAlternates(slug)` and `buildHreflangAlternates` (all locales + x-default).

Canonical uses the **resolved** DB slug (not the requested slug) so that case variants redirect and share one canonical URL.

---

## STEP 3 — Breadcrumbs

**Structure:** Home → Cars → [Car model] (e.g. “Toyota Yaris Automatic”).

**Links:**
- Home → `/{locale}` (e.g. `/en`).
- Cars → `/{locale}/cars` (cars index).
- Current car → `/{locale}/cars/[slug]` (e.g. `/en/cars/toyota-yaris`).

**Component:** `SeoBreadcrumbNav` with `items={breadcrumbItems}`.

**BreadcrumbList JSON-LD:** Emitted via `buildBreadcrumbJsonLd(breadcrumbJsonLdItems)` with absolute URLs from `toAbsoluteUrl(item.href)`.

Labels use `carDict.breadcrumbHome`, `carDict.breadcrumbCars`, and the car model name.

---

## STEP 4 — Vehicle specifications block

**Component:** `SeoVehicleSpecsBlock` with `title={carDict.specsTitle}` and `specs={vehicleSpecs}`.

**Fields (from DB when available):**
- Transmission  
- Fuel type  
- Seats  
- Air conditioning  
- **Luggage capacity** (e.g. “2 suitcases”)  
- Doors  
- Engine power  
- Engine  
- Year  
- Class  
- Deposit  

All come from the car object; “Luggage capacity” is set to a default when the DB has no specific field.

---

## STEP 5 — Pickup locations section

**Component:** `SeoLinksBlock` with `title={carDict.pickupTitle}` and `links={locationLinks}`.

**Data:** `locationLinks = getAllLocationsForLocale(locale).map(...)` → each item has `href: getLocationPath(locale, location.slug)` and `label: location.shortName`.

So the block lists all pickup locations (e.g. Thessaloniki Airport (SKG), Nea Kallikratia, Halkidiki resorts) with links to the corresponding location SEO pages (`/{locale}/locations/[slug]`).

---

## STEP 6 — Related cars

**Logic:**
- Exclude current car; take only public cars.
- Prefer **same class**; then fill with others.
- Take up to **4** cars.

**Display:** `SeoLinksBlock` with `title={dictionary.links.otherCarsTitle}` (“Other cars you may like”) and `links={relatedCarLinks}` (each link: `getCarPath(locale, c.slug)`, label: `c.model || c.slug`).

Same data could be passed into a card-based component later; current design reuses the existing list block and does not change layout.

---

## STEP 7 — FAQ section

**Component:** `SeoFaqBlock` with `title={carDict.faqTitle}` and `faq={faqItems}`.

**Data:** `faqItems = carDict.faq || []` (from locale dictionary; can contain questions such as “Can I pick up this car at Thessaloniki Airport?”, “Is insurance included?”, “Do I need a credit card?”).

**FAQPage JSON-LD:** Emitted via `buildFaqJsonLd(faqItems)`.

---

## STEP 8 — Structured data (JSON-LD)

**Scripts injected:**
1. **AutoRental** — `buildAutoRentalJsonLd(...)` (location, offer, areaServed, pickupLocation, etc.).
2. **Product** — `buildCarProductJsonLd(...)` with:
   - `name`, `description`, `image`, `url`
   - `brand` (Organization)
   - `vehicleTransmission`, `fuelType`, `seatingCapacity`, `numberOfDoors`, `vehicleModelDate`
   - `offers`: `Offer` with `priceCurrency`, `price` (from lowest daily price), `availability`, `url`, `seller`
   - `aggregateRating`
3. **FAQPage** — `buildFaqJsonLd(faqItems)`.
4. **BreadcrumbList** — `buildBreadcrumbJsonLd(breadcrumbJsonLdItems)`.

All use absolute URLs via `toAbsoluteUrl`. Product schema matches the requested pattern (name, brand, vehicleTransmission, fuelType, seatingCapacity, offers.price, offers.currency, availability).

---

## STEP 9 — Internal linking

The car page links to:

- **Cars index:** `/{locale}/cars` — via breadcrumb (“Cars”) and can be reinforced in a “Back” or “Explore” block if desired.
- **Car rental Halkidiki:** `/{locale}/locations/[slug]` for Halkidiki (locale-specific slug) — via **SeoPillarLinksBlock** (e.g. “Car rental in Halkidiki”).
- **Car rental Thessaloniki Airport:** same — pillar link (e.g. “Car rental at Thessaloniki Airport”).

Additional internal links:
- Category pages (e.g. automatic-car-rental-halkidiki) — SeoLinksBlock “Browse by category”.
- Brand pages (e.g. Toyota) — SeoLinksBlock “More [Brand] rentals”.
- Back to hub — SeoSingleLinkBlock to `/{locale}`.

All links use `getCarPath`, `getLocationPath`, `getSeoPagePath` with the current `locale`, so they are locale-correct.

---

## STEP 10 — Performance

- **Metadata:** Generated server-side in `generateMetadata` (no client-only metadata).
- **Rendering:** Server Component (async); data fetched on the server; **generateStaticParams** pre-renders known locale+slug pairs at build time.
- **Images:** Handled inside **SingleCarDisplay** (and any child components); Next.js Image can be used there without changing this page’s structure.

---

## STEP 11 — Summary of deliverables

| Item | Status |
|------|--------|
| Updated page structure | Implemented in `app/[locale]/cars/[slug]/page.js` (order: breadcrumb → pillar → intro → quick specs → SingleCarDisplay → features → full specs → pickup → why rent → related → category → brand → FAQ → back to hub). |
| Metadata (title, description, canonical, hreflang) | Via `buildCarMetadata` and `buildBaseMetadata`; canonical absolute and locale-specific. |
| Breadcrumb (Home → Cars → Model) | `SeoBreadcrumbNav` with link to `/{locale}/cars`; BreadcrumbList JSON-LD. |
| Vehicle specifications block | `SeoVehicleSpecsBlock` including Luggage capacity. |
| Pickup locations | `SeoLinksBlock` with links to all location pages. |
| Related cars (3–4, same class preferred) | `SeoLinksBlock` “Other cars you may like”. |
| FAQ block + FAQPage schema | `SeoFaqBlock` + `buildFaqJsonLd`. |
| JSON-LD (Product, AutoRental, FAQ, Breadcrumb) | All four scripts injected. |
| Internal links to /cars, car-rental-halkidiki, airport | Breadcrumb + pillar links; locale-prefixed. |

**Changes made in this pass:**  
1. Breadcrumb set to **Home → Cars → [Model]** with link to `/{locale}/cars`.  
2. **Luggage capacity** added to the vehicle specifications list.

No visual or behavioural changes to the existing car card, gallery, calendar, or booking flow.
