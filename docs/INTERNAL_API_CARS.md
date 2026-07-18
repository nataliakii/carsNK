# Internal API: Cars

**Endpoint:** `GET /api/internal/cars`  
**Purpose:** Return only real cars (testingCar = false) for external consumers (e.g. https://bbqr.site).

## Environment

Add to `.env` or `.env.local`:

```bash
INTERNAL_API_TOKEN=your-secret-token-here
```

If `INTERNAL_API_TOKEN` is missing or empty, all requests return **401 Unauthorized**.

## Authentication

- **Header:** `Authorization: Bearer <INTERNAL_API_TOKEN>`
- Missing or invalid token → **401 Unauthorized**.

## CORS

- **Allowed origin:** `https://bbqr.site` only.
- **Methods:** `GET`, `OPTIONS`.
- **Headers:** `Authorization`, `Content-Type`.

## Example request (from bbqr.site)

```bash
curl -X GET "https://your-next-app-domain.com/api/internal/cars" \
  -H "Authorization: Bearer YOUR_INTERNAL_API_TOKEN"
```

From browser/fetch (same origin as bbqr.site or from bbqr.site backend):

```javascript
const res = await fetch("https://your-next-app-domain.com/api/internal/cars", {
  method: "GET",
  headers: {
    Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}`,
  },
});
const cars = await res.json();
```

## Response format

**200 OK** — JSON array of cars (extended format for external listings, e.g. BBQR, Nea Kallikratia Guide):

```json
[
  {
    "externalId": "670bb226223dd911f059528a",
    "title": "Ford Fiesta",
    "slug": "ford-fiesta-automatic",
    "priceFrom": 35,
    "image": "Ford_Fiesta_2017_moqke9",
    "bookingUrl": "https://natali-cars.com/cars/ford-fiesta-automatic",
    "transmission": "automatic",
    "fueltype": "petrol",
    "seats": 5,
    "model": "Ford Fiesta",
    "class": "compact",
    "registration": 2019,
    "color": "white",
    "numberOfDoors": 5,
    "airConditioning": true,
    "enginePower": 120,
    "engine": "1.5"
  }
]
```

**Required / always present:**
- **externalId** — MongoDB `_id` (for mapping in external system).
- **title** — Display name: model + transmission (e.g. "Ford Fiesta Automatic").
- **slug** — URL segment for the car (e.g. `ford-fiesta-automatic`).
- **transmission** — `"automatic"` or `"manual"` (lowercase).
- **fueltype** — `"petrol"`, `"diesel"`, `"electric"`, etc., or `null` if not set.
- **seats** — Number of seats (default 5 if missing in DB).

**Optional / when available:**
- **priceFrom** — Representative minimum price from pricing tiers.
- **image** — Car photo URL or identifier (or `null`).
- **bookingUrl** — Full URL to Natali Cars booking for this car.
- **model** — Model name (if different from title).
- **class** — Car class, e.g. `"compact"`, `"suv"` (lowercase).
- **registration** — Year of manufacture.
- **color** — Exterior color.
- **numberOfDoors** — Door count.
- **airConditioning** — Boolean.
- **enginePower** — Engine power (e.g. hp).
- **engine** — Engine designation (e.g. `"1.5"`).

**Base URL** for `bookingUrl` is taken from `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_SITE_URL` (or Vercel), fallback `https://natali-cars.com`.

**BBQR mapping example:**

```json
{
  "externalId": "externalId",
  "title": "title",
  "priceFrom": "priceFrom",
  "coverImage": "image",
  "bookingUrl": "bookingUrl"
}
```

**401 Unauthorized** — Missing or invalid token:

```json
{ "error": "Unauthorized" }
```

**500 Server Error** — DB or server error:

```json
{ "error": "Server error" }
```

## Mongo query

Only real cars are returned (testing cars excluded):

```js
// Equivalent filter used in code:
{ $or: [ { testingCar: false }, { testingCar: { $exists: false } } ] }
```

This returns cars where `testingCar` is explicitly `false` or the field is missing (e.g. before seed). Cars with `testingCar: true` are never returned.
