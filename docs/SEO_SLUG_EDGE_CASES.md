# SEO slug migration — edge cases handled

## Slug field & generation

- **Schema:** `slug: { type: String, unique: true, sparse: true, trim: true }`. No `lowercase: true` — normalisation is done in the utility so inserts are safe when many docs have no slug yet (sparse avoids indexing null/undefined as one value).
- **Uniqueness:** If base slug exists, append `-2`, `-3`, … (via `ensureUniqueSlug` / migration).
- **Format:** Lowercase, latin-only (NFD + strip diacritics), spaces/special → `-`, trimmed; no leading/trailing hyphens (in `utils/slugCar.js`).
- **Stability:** Slug is set once (migration or on create); edits do not auto-regenerate unless explicitly implemented.
- **Empty base:** If make/model/year yield empty slug, fallback base is `"car"` (then uniqueness suffix if needed).

## Migration script

- **Idempotent:** Only sets `slug` when missing; never overwrites existing slug. Safe to run multiple times.
- **Collisions:** Checked by exact slug match; when base exists, append `-2`, `-3`, … and log. Update uses `{ _id: car._id }` so the same document is not counted as a collision on re-run.
- **Missing cars:** Script only updates cars; it does not create or delete cars.

## Routing

- **`/cars/[slug]`:** Fetch by slug; `notFound()` if no car. Canonical = same URL (absolute: `baseUrl/cars/{slug}`). This is the only car URL we want indexed.
- **`/car/[id]` (legacy):**
  - Car exists and has `slug` → **permanentRedirect** to `/cars/{slug}`. In Next.js this is **308** (permanent); fine for SEO (Google treats as permanent).
  - Car exists but no slug → render with `robots: { index: false, follow: true }`.
  - Car does not exist → `notFound()` (**404**). No redirect to homepage.
- **410 Gone:** `notFound()` returns 404. To return 410 you would need a route handler that returns `new Response(..., { status: 410 })`; not implemented here.

## noindex on legacy `/car/[id]`

- **generateMetadata:** If car not found → `robots: { index: false, follow: false }`. If car has slug → `robots: { index: false, follow: false }` (page will redirect). If car has no slug → `robots: { index: false, follow: true }`. If redirect runs before render, metadata may not apply, but the redirect itself prevents indexing of the legacy URL.

## Sitemap

- **Included:** Static pages (home, contacts, policies) + car pages as `/cars/{slug}` only.
- **Filter:** Only cars with non-empty `slug`; and (if present) `isActive !== false`, `isHidden !== true`, `deletedAt` absent. So when you add `isActive` / `isHidden` / `deletedAt`, they are respected without code change.
- **lastModified:** Uses `dateLastModified` or `dateAddCar` when available; otherwise current date.
- **Excluded:** Any car without slug or “non-public”; no `/car/{id}` URLs.
- **URLs:** Sitemap entries use `encodeURIComponent(car.slug)` so URLs return 200 when the car exists.

## SEO checks

- **Canonical:** Set on `/cars/[slug]` to the same URL (absolute: `baseUrl/cars/{slug}`).
- **Stable URLs:** Slug does not change on normal edits; only migration or explicit “regenerate slug” would change it.
