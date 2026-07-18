# Data Fetching Architecture

## Overview

Server components and API routes use a **service layer** for direct database access. Client components continue to use **HTTP fetch** to internal API routes. This removes unnecessary HTTP hops when server code needs data.

## Architecture

```
MongoDB
   ↑
domain/services (carService, companyService, orderService)
   ↑
   ├── API routes (for external / client callers)
   └── Server components (RSC)
```

- **Server components** → call `getCars()`, `getCompany()`, `getActiveOrders()`, etc. from `@/domain/services`. No internal `fetch()` to `/api/*`.
- **API routes** → use the same service functions, then return JSON. External clients and browser `fetch()` still hit these routes.
- **Client components** → keep using `fetchAllCars()`, `fetchCompany()`, `reFetchActiveOrders()` from `@utils/action`, which perform HTTP requests to the API routes.

## Service layer (`domain/services/`)

| Service         | Functions           | Used by |
|----------------|---------------------|--------|
| `carService.js`   | `getCars({ session })`, `getCarById(id, { session })`, `getCarBySlug(slug, { session })` | RSC, `/api/car/all`, `/api/car/[...id]`, `/api/car/slug/[slug]` |
| `companyService.js` | `getCompany(companyId)` | RSC, `/api/company/[...id]` |
| `orderService.js`  | `getActiveOrders({ session })`, `getAllOrders({ session })` | RSC, `/api/order/refetch-active`, `/api/order/refetch` |

- **Session**: Pass `{ session }` (from `getServerSession(authOptions)`) when the result depends on auth (e.g. cars filter for `testingCar`, order visibility for PII). Optional for public data (e.g. sitemap uses `getCars()` without session).
- **Visibility**: Order services apply `applyVisibilityToOrders()` using `session?.user`; car services apply visibility to `car.orders` when session is provided.

## What was changed

1. **Added** `domain/services/carService.js`, `companyService.js`, `orderService.js`, and `domain/services/index.js`.
2. **API routes** now call services instead of duplicating DB logic; response shapes and URLs are unchanged.
3. **Server components** that previously called `fetchAllCars()`, `fetchCompany()`, `reFetchActiveOrders()`, `fetchCar()`, `fetchCarBySlug()` now call the corresponding service functions and pass `session` where needed.
4. **`utils/action.js`** helpers (`fetchAllCars`, `fetchCompany`, `reFetchActiveOrders`, `fetchCar`, `fetchCarBySlug`) are **unchanged** and still used by client components (Context, modals, etc.) to call the API via HTTP.

## Files updated (summary)

- **Server components**: `app/[locale]/page.js`, `app/[locale]/cars/page.js`, `app/[locale]/cars/[slug]/page.js`, `app/[locale]/[seoSlug]/page.js`, `app/[locale]/locations/[[...path]]/page.js`, `app/admin/features/shared/DataLoader.js`, `app/sitemap.xml/route.ts`, `app/cars/[slug]/page.js`, `app/car/[...id]/page.js`, `app/[locale]/car/[...id]/page.js`.
- **API routes**: `app/api/car/all/route.js`, `app/api/car/[...id]/route.js`, `app/api/car/slug/[slug]/route.js`, `app/api/company/[...id]/route.js`, `app/api/order/refetch-active/route.js`, `app/api/order/refetch/route.js`.

Routing and public API endpoints are unchanged; only internal server-side data access was refactored to use the service layer.
