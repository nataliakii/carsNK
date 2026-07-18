# How to Edit Location Page Content

All location page content is defined in the **domain layer** and rendered by the location page component. Do not hardcode content in React components.

## Where to Edit

**Page body content** (intro, mainInfo, distance, pickup, tips, faq, nearbyPlaces):

- Served by `getLocationPageContent(locationId, locale)` from `domain/locationSeo/locationSeoService.ts`
- Source: `domain/locationSeo/locationContentRepo.ts` (builds from `locationContentByKeyRaw`)
- Actual content: `domain/locationSeo/locationSeoRepo.ts` → `locationContentByKeyRaw` (keyed by `LOCATION_CONTENT_KEYS`)

**SEO metadata** (seoTitle, seoDescription) stays in `locationSeoRepo.ts`.

**Shared labels** (section titles): `localeSeoDictionaryRaw` → `links` for each locale

## Content Fields

Each location has per-locale content with these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `shortName` | Yes | Short display name (e.g. "Nea Kallikratia") |
| `h1` | Yes | Page heading (e.g. "Car Rental in Nea Kallikratia") |
| `seoTitle` | Yes | Meta title |
| `seoDescription` | Yes | Meta description |
| `introText` | Yes | Main intro — first paragraph is hero; remaining paragraphs render as main info if `mainInfoText` is empty |
| `areaServed` | Yes | Array of area names |
| `pickupLocation` | Yes | Pickup point label |
| `offerName` | Yes | Offer name |
| `offerDescription` | Yes | Offer description |
| `mainInfoText` | No | Extra main location information block |
| `distanceToThessalonikiText` | No | Paragraph for "Distance to Thessaloniki" section |
| `pickupGuidance` | No | Pickup instructions paragraph |
| `nearbyPlaces` | No | Array of nearby places (e.g. `["Nikiti", "Porto Carras", "Sarti"]`) |
| `usefulTips` | No | Array of travel/rental tips |
| `faq` | No | Array of `{ question: string, answer: string }` |

## Block Order on the Page

1. Intro  
2. Main location information (`mainInfoText` or remaining `introText` paragraphs)  
3. Distance to Thessaloniki  
4. Pickup guidance  
5. Nearby places  
6. Useful tips  
7. FAQ  
8. (Airport-specific: benefits, distance table, map)  
9. Available cars  
10. Browse by category / Popular cars  
11. Explore more  

## How to Add Content

### FAQ

Add a `faq` array to the location content:

```ts
faq: [
  { question: "Can I get delivery to my hotel?", answer: "Yes. We coordinate pickup at your accommodation." },
  { question: "What documents do I need?", answer: "Valid license and ID or passport." },
],
```

If a location has no `faq`, the block is hidden.

### Useful Tips

Add a `usefulTips` array:

```ts
usefulTips: [
  "Book in advance during peak season for best availability.",
  "We offer free delivery to hotels in the area.",
],
```

### Distance to Thessaloniki

Add `distanceToThessalonikiText`:

```ts
distanceToThessalonikiText:
  "Nea Kallikratia is about 35 km from Thessaloniki and 25 km from Thessaloniki Airport (SKG).",
```

Alternatively, distance can still come from `domain/locationSeo/locationHeroImages.ts` → `LOCATION_DISTANCE_TEXT` as fallback for locations not yet migrated.

### Pickup Guidance

Add `pickupGuidance`:

```ts
pickupGuidance:
  "Pickup is arranged near your accommodation. Confirm the exact spot when booking.",
```

### Nearby Places

Add `nearbyPlaces`:

```ts
nearbyPlaces: ["Nikiti", "Porto Carras", "Sarti"],
```

## Adding a Location Hero Image

**File:** `domain/locationSeo/locationHeroImages.ts`

Add an entry to `LOCATION_HERO_IMAGES`:

```ts
"your-location-id": {
  defaultSrc: "/your-location-image.png",
  portraitPhoneSrc: "/your-location-portrait.png",
},
```

Use the same id as in `LOCATION_IDS` (e.g. `nikiti`, `sithonia`).

## Shared Labels (Titles)

Section titles (e.g. "Useful tips", "Pickup guidance") are in `localeSeoDictionaryRaw` → `links`:

- `pickupGuidanceTitle`
- `nearbyPlacesTitle`
- `usefulTipsTitle`
- `distanceToThessalonikiTitle`
- `localFaqTitle`

Edit these to change titles across all location pages for a given locale.
