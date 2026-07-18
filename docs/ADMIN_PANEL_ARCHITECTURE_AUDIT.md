# Admin Panel Architecture — Audit Report

## STEP 1 — Admin route tree

All admin UI lives under the App Router route group `(admin)`. Layout: `src/app/(admin)/layout.js` → AdminLayout (sidebar + header + main). No middleware found that protects admin routes; protection is only at API level via `getSession()`.

### Route tree

```
(admin)/
  layout.js                    → AdminLayout (client: sidebar, header, main)
  admin/
    page.js                    → redirect to /admin/dashboard
    login/page.js              → AdminLoginForm (client)
    dashboard/page.js          → AdminDashboard (client)
    businesses/
      page.js                  → AdminListPage entity="businesses" (client)
      create/page.js           → AdminFormPage entity="businesses"
      [id]/page.js             → AdminFormPage entity="businesses" id
    listings/
      page.js                  → AdminListPage entity="listings"
      create/page.js           → AdminFormPage entity="listings"
      [id]/page.js             → AdminFormPage entity="listings" id
      external-sources/
        page.js                → AdminExternalSourcesList (client)
        create/page.js         → AdminExternalSourceForm (client)
        [id]/page.js           → AdminExternalSourceForm id (server page, client form)
      external-databases/
        page.js                → AdminExternalDatabasesList (client)
        create/page.js         → AdminExternalDatabaseForm (client)
        [id]/page.js           → AdminExternalDatabaseForm id
    data-pipeline/
      page.js                  → DataPipelineDashboard (client)
      logs/page.js             → DataPipelineLogs (client)
    places/
      page.js                  → AdminListPage entity="places"
      create/page.js           → AdminFormPage entity="places"
      [id]/page.js             → AdminFormPage entity="places" id
    reviews/page.js            → AdminReviewsPlaceholder
    seo/page.js                → AdminSeoPlaceholder
    settings/page.js           → AdminSettingsPlaceholder
```

### Per-route summary

| Route | File | Component | Client/Server | API(s) called |
|-------|------|-----------|--------------|----------------|
| /admin | (admin)/admin/page.js | (redirect) | Server | — |
| /admin/dashboard | admin/dashboard/page.js | AdminDashboard | Page: server, child: client | getAdminStats (optional) |
| /admin/login | admin/login/page.js | AdminLoginForm | Client | login, /api/admin/me |
| /admin/businesses | admin/businesses/page.js | AdminListPage | Client | getAdminList('businesses'), getAdminMe |
| /admin/listings | admin/listings/page.js | AdminListPage | Client | getAdminList('listings'), getAdminMe |
| /admin/listings/external-sources | admin/listings/external-sources/page.js | AdminExternalSourcesList | Client | getExternalSources (GET /api/admin/external-sources) |
| /admin/listings/external-databases | admin/listings/external-databases/page.js | AdminExternalDatabasesList | Client | getAdminExternalDatabases |
| /admin/data-pipeline | admin/data-pipeline/page.js | DataPipelineDashboard | Client | getDataPipelineDashboard, getDataPipelineHealth, syncExternalSource (on action) |
| /admin/data-pipeline/logs | admin/data-pipeline/logs/page.js | DataPipelineLogs | Client | getDataPipelineLogs |
| /admin/places | admin/places/page.js | AdminListPage | Client | getAdminList('places'), getAdminMe |
| /admin/reviews | admin/reviews/page.js | AdminReviewsPlaceholder | Client | — |
| /admin/seo | admin/seo/page.js | AdminSeoPlaceholder | Client | — |
| /admin/settings | admin/settings/page.js | AdminSettingsPlaceholder | Client | — |

---

## STEP 2 & 3 & 4 & 5 — /admin/listings/external-sources and API flow

**Page:** `src/app/(admin)/admin/listings/external-sources/page.js` → renders only `<AdminExternalSourcesList />`.

**Component:** AdminExternalSourcesList (`src/components/admin/external-sources/AdminExternalSourcesList.js`):

- `'use client'`, so client component.
- On mount calls `getExternalSources()` from `@/lib/api/externalSources`.
- Sets state: `setItems(Array.isArray(data) ? data : (data?.items || []))`.

**API client:** `src/lib/api/externalSources.js`:

- `getExternalSources()`: `get('/api/admin/external-sources', {}, adminOptions)` then `return data?.items ?? []`.
- So the component always receives an array (possibly empty).

**Backend:** `src/app/api/admin/external-sources/route.js`:

- GET: `getSession()` → 401 if no session. Then `ExternalListingSource.find(filter).populate('businessId', ...).lean()` and `countDocuments`. Returns `jsonOk({ items: items || [], total })`.
- Response shape matches what the client expects: `{ items, total }`; client uses `data?.items ?? []`.

### Conclusion on "displays nothing"

Data flow is consistent: list route returns `{ items, total }`, client normalizes to array, component can show loading, error, or table (with empty state). No response-shape mismatch.

**Possible causes for "nothing":**

1. **401 Unauthorized** (not logged in): request throws, component sets error and items = [] → user should see the red Alert and the "No external sources" row. If the user ignores the alert, they might describe it as "nothing".
2. **Empty DB:** no ExternalListingSource documents → table with one row: "No external sources. Create one to import listings from an API." Again could be described as "nothing" if they expected data.
3. **Client error:** an uncaught exception before or during render could leave the main area blank; none found in the code path above.

**Recommendation:** In browser DevTools check Network for `GET /api/admin/external-sources`: status (401 vs 200) and response body (`items: []` vs `items: [...]`). Check Console for errors. That will distinguish 401, empty data, or a front-end crash.

### Security note

`/api/admin/external-sources/[id]/route.js` (GET/PUT/DELETE) **does not call getSession()**. The list route and sync route are protected; the single-source CRUD route is not. This is an inconsistency and a **security gap**.

---

## STEP 6 — Sidebar: flat list, no hierarchy

**File:** `src/components/admin/AdminSidebar.js`.

**Current structure:** One flat array `navItems`:

- Dashboard
- Businesses
- Listings
- External APIs → /admin/listings/external-sources
- External Databases → /admin/listings/external-databases
- Data Pipeline → /admin/data-pipeline
- Sync Logs → /admin/data-pipeline/logs
- Places
- Reviews
- SEO Metadata
- Settings

All items are rendered in a single List with `navItems.map(...)`. There are no nested groups, no collapse/expand, no visual parent-child. So "Listings" and "Data Pipeline" do not appear as section headers with children; everything is one level.

**Intended logical grouping (for later refactor):**

- **Listings:** All Listings, External APIs, External Databases
- **Data Pipeline:** Overview, Sync Logs

Currently this hierarchy exists only in URL paths, not in the sidebar.

---

## STEP 7 — Data Pipeline pages

**`/admin/data-pipeline`**

- Component: DataPipelineDashboard.
- APIs: `getDataPipelineDashboard()` → GET /api/admin/data-pipeline/dashboard, `getDataPipelineHealth()` → GET /api/admin/data-pipeline/health.
- Dashboard builds a combined list of "sources" from ExternalDatabase and ExternalListingSource, adds last sync and listing counts, and shows a table with Sync/Edit. Sync for externalApi calls `syncExternalSource(id)` (same as External APIs list). So it duplicates the "list external sources + sync" idea but in an aggregated view.

**`/admin/data-pipeline/logs`**

- Component: DataPipelineLogs.
- API: `getDataPipelineLogs({ page, limit })` → GET /api/admin/data-pipeline/logs.
- Shows SyncLog documents (all sync runs). No duplication of listings sync logic; it's complementary.

**Overlap:** Data Pipeline dashboard vs Listings → External APIs / External Databases: same sources (External APIs + External DBs), different UIs (aggregated pipeline view vs per-entity list/edit). Sync behavior for external APIs is shared (same `syncExternalSource`).

---

## STEP 8 — Duplicated / similar components

**List + table + sync for "sources"**

- AdminExternalSourcesList and AdminExternalDatabasesList: same pattern (load list, table, Sync button, Edit link, snackbar). Different API modules and columns, but structure duplicated.
- DataPipelineDashboard again shows the same sources in a different table (with health, listing counts) and also has Sync/Edit. So three places show or act on "external sources" (two list pages + pipeline dashboard).

**Generic list vs custom list**

- Businesses, Places, Listings use AdminListPage + AdminTable + adminCrud + adminEntities.
- External Sources and External Databases use custom list components and dedicated API modules (not adminCrud), so they don't share the same list/table pattern.

**Forms**

- Places/Businesses/Listings: AdminFormPage + AdminForm + entities config.
- External Source: AdminExternalSourceForm (custom).
- External Database: AdminExternalDatabaseForm (custom).
- Form patterns are similar (load one, create/update, validation) but not shared.

**No duplicate files:** No second copy of the same component file; duplication is pattern duplication (custom lists/tables/forms for external sources/databases vs generic AdminListPage/AdminFormPage).

---

## STEP 9 — API client duplication and naming

Admin API modules under `src/lib/api/`:

| Module | Base path | Naming | Used by |
|--------|-----------|--------|---------|
| adminAuth | /api/admin/auth, /api/admin/me | admin* | AdminLoginForm, AdminListPage |
| adminBusinesses | /api/admin/businesses | admin* | AdminListPage, AdminFormPage, AdminExternalSourceForm |
| adminPlaces | /api/admin/places | admin* | adminCrud → AdminListPage, AdminFormPage |
| adminListings | /api/admin/listings | admin* | adminCrud → AdminListPage, AdminFormPage |
| adminCrud | — | — | Dispatches to adminPlaces, adminBusinesses, adminListings |
| adminStats | /api/admin/stats | admin* | AdminDashboard |
| adminExternalDatabases | /api/admin/external-databases | admin* | AdminExternalDatabasesList, AdminExternalDatabaseForm |
| adminDataPipeline | /api/admin/data-pipeline/* | admin* | DataPipelineDashboard, DataPipelineLogs |
| externalSources | /api/admin/external-sources | **no "admin" prefix** | AdminExternalSourcesList, AdminExternalSourceForm, DataPipelineDashboard (sync) |

**Inconsistency:** `externalSources.js` is the only admin-facing API module that does not use the `admin*` naming (e.g. `adminExternalSources.js`). Behavior is the same (same client, adminOptions); only the name differs.

**Pattern consistency:** All use get/post/put/patch/del and adminOptions from `./client`. List endpoints return `{ items, total }` (or similar); only `externalSources.getExternalSources()` immediately returns `data?.items ?? []` instead of the full body. Others (e.g. getAdminExternalDatabases) return the full response; list components then do `data.items || []` themselves.

---

## STEP 10 — Unused or empty-feeling pages

- **Reviews, SEO, Settings:** Implemented as placeholders only (AdminReviewsPlaceholder, AdminSeoPlaceholder, AdminSettingsPlaceholder). They render UI but no real data/API; they are "empty" in terms of functionality but not missing.
- **Dashboard:** Uses AdminDashboard; may call getAdminStats (optional). Exists and has a role.
- All routes listed in the sidebar have a corresponding page; no route points to a non-existent or removed page.

**So:** no "dead" routes; the only "empty" ones are the three placeholder pages by design.

---

## STEP 11 — Data models used by admin

| Admin area | Mongo model(s) | API route(s) |
|------------|----------------|--------------|
| Listings (main) | Listing | GET/POST /api/admin/listings, [id] |
| External APIs (list/edit/sync) | ExternalListingSource | GET/POST /api/admin/external-sources, [id], [id]/sync |
| External Databases (list/edit/sync) | ExternalDatabase | GET/POST /api/admin/external-databases, [id], [id]/sync |
| Data Pipeline dashboard | ExternalDatabase, ExternalListingSource, SyncLog, Listing | GET /api/admin/data-pipeline/dashboard (and health) |
| Data Pipeline logs | SyncLog | GET /api/admin/data-pipeline/logs |
| Businesses | Business | /api/admin/businesses |
| Places | Place | /api/admin/places |
| Reviews | (placeholder only) | — |
| SEO / Settings | (placeholder only) | — |

So: External Sources ↔ ExternalListingSource, External Databases ↔ ExternalDatabase, Sync Logs ↔ SyncLog. Each admin "feature" that uses data has a clear model and API.

---

## STEP 12 — Architecture summary

- **Route tree:** As in Step 1; all under `(admin)/admin/` with one layout and no route-level auth.
- **Components per route:** As in the table in Step 1; Listings/Data Pipeline use both generic (AdminListPage, AdminFormPage) and custom (External Sources/Databases, DataPipeline*).
- **API calls per page:** Documented in Step 1 table; external-sources page only calls `getExternalSources()`.
- **Mongo models:** As in Step 11.

**Broken/empty:**

- **External-sources "displays nothing":** No backend/response-shape bug found; likely 401, empty DB, or client error — verify with Network/Console.
- **Auth gap:** `/api/admin/external-sources/[id]` (GET/PUT/DELETE) has no session check.
- **Duplication:** Two custom list components (External Sources, External Databases) with the same pattern; Data Pipeline dashboard re-exposes the same sources and sync; forms for external source/database are custom and not shared with the generic AdminFormPage.
- **Sidebar:** Single flat list; no hierarchy for Listings (All / External APIs / External DBs) or Data Pipeline (Overview / Sync Logs).

---

## STEP 13 — Cleanup and refactor plan (do not implement yet)

### 1. Fix security

Add `getSession()` to `/api/admin/external-sources/[id]/route.js` for GET, PUT, DELETE; return 401 when there is no session.

### 2. Align API client naming

Rename `lib/api/externalSources.js` → `lib/api/adminExternalSources.js` and export names like `getAdminExternalSources`, `getAdminExternalSource`, etc., and update all imports (AdminExternalSourcesList, AdminExternalSourceForm, DataPipelineDashboard). Optionally make `getAdminExternalSources()` return the full `{ items, total }` and let callers use `data.items` for consistency with other admin modules.

### 3. Sidebar hierarchy

Change `navItems` (or equivalent) to a structure that supports groups, e.g.:

- **Listings (group):** All Listings, External APIs, External Databases.
- **Data Pipeline (group):** Overview, Sync Logs.
- Rest (Dashboard, Businesses, Places, Reviews, SEO, Settings) stay top-level.

Render groups with a section label and nested links (or collapsible sections). Keep existing hrefs so routing stays the same.

### 4. Reduce duplication (optional, larger refactor)

- **Option A:** Introduce a single "AdminSourcesList" (or similar) component that takes config (title, type: externalApi | externalDatabase, columns, API getter, sync handler, edit base path). Use it for both External APIs and External Databases to replace the two custom list components.
- **Option B:** Keep two list components but extract shared pieces (table shell, loading/error/snackbar, sync button logic) into small shared components or hooks.
- **Data Pipeline dashboard:** Keep as the "overview" of all sources and sync status; avoid adding full CRUD there. Keep "Edit" as links to existing Listings → External APIs / External Databases pages so there is one place to edit each source type.

### 5. Placeholder pages

Leave as-is until features are implemented. If desired, add a single "AdminPlaceholder" component used by Reviews, SEO, and Settings to unify the empty state.

### 6. Verification after refactor

- Confirm `/admin/listings/external-sources` shows list or explicit error/empty state (and fix 401/empty if needed).
- Confirm sidebar shows Listings and Data Pipeline as groups with correct links.
- Confirm no duplicate or broken API calls; all admin API routes that should be protected use `getSession()`.

---

## Summary

The admin architecture is consistent except for one naming inconsistency (externalSources vs admin*), one auth gap on external-sources [id], and a flat sidebar. "Displays nothing" on external-sources is not explained by a wrong API shape; the next step is to confirm in the browser whether the cause is 401, empty data, or a front-end error, then apply the security and sidebar cleanup above without changing behavior elsewhere.
