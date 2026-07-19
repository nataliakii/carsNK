# Aggregator API — Cars fleet feed

Public read-only API for partner aggregators to sync CarsNK vehicles.

**Base URL (production):** `https://carsnk.gr`  
**Also works on:** `https://cars.bbqr.site`

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/aggregator/cars` | List real cars (testing cars excluded) |
| `GET` | `/api/v1/aggregator/cars/{idOrSlug}` | One car by Mongo `_id` or `slug` |
| `OPTIONS` | same paths | CORS preflight |

---

## Authentication (API key)

Set in Vercel / `.env` (server-only, never expose to the browser):

```bash
AGGREGATOR_API_KEY=generate-a-long-random-secret
```

If `AGGREGATOR_API_KEY` is empty, the API falls back to `INTERNAL_API_TOKEN` (legacy BBQR internal feed).  
If **both** are empty → every request returns **401**.

Send the key with either header:

```http
X-API-Key: YOUR_AGGREGATOR_API_KEY
```

or

```http
Authorization: Bearer YOUR_AGGREGATOR_API_KEY
```

---

## Quick start

```bash
# List cars
curl -sS "https://carsnk.gr/api/v1/aggregator/cars" \
  -H "X-API-Key: YOUR_AGGREGATOR_API_KEY"

# With full seasonal pricing
curl -sS "https://carsnk.gr/api/v1/aggregator/cars?include=pricing&limit=50" \
  -H "X-API-Key: YOUR_AGGREGATOR_API_KEY"

# Filter by class
curl -sS "https://carsnk.gr/api/v1/aggregator/cars?class=economy" \
  -H "X-API-Key: YOUR_AGGREGATOR_API_KEY"

# One car by slug
curl -sS "https://carsnk.gr/api/v1/aggregator/cars/toyota-yaris-automatic" \
  -H "X-API-Key: YOUR_AGGREGATOR_API_KEY"
```

Node.js example:

```js
const res = await fetch("https://carsnk.gr/api/v1/aggregator/cars?include=pricing", {
  headers: { "X-API-Key": process.env.AGGREGATOR_API_KEY },
});
const body = await res.json();
if (!body.success) throw new Error(body.message || body.error);
console.log(body.meta.count, body.data);
```

---

## Query parameters (list)

| Param | Default | Description |
|-------|---------|-------------|
| `include` | — | Comma list. Use `pricing` to attach full `pricingTiers` |
| `class` | — | Filter: `economy`, `compact`, `crossover`, … |
| `limit` | `100` | Max items, clamped to **1–200** |

---

## Response shape

### List — `200 OK`

```json
{
  "success": true,
  "meta": {
    "count": 12,
    "limit": 100,
    "currency": "EUR",
    "generatedAt": "2026-07-19T09:00:00.000Z"
  },
  "data": [
    {
      "id": "670bb226223dd911f059528a",
      "carNumber": "12",
      "title": "Toyota Yaris Automatic",
      "model": "Toyota Yaris",
      "slug": "toyota-yaris-automatic",
      "class": "economy",
      "transmission": "automatic",
      "fueltype": "petrol",
      "seats": 5,
      "numberOfDoors": 5,
      "registration": 2021,
      "color": "white",
      "airConditioning": true,
      "engine": "1.5",
      "enginePower": 110,
      "deposit": 300,
      "franchise": 500,
      "priceFrom": 35,
      "currency": "EUR",
      "image": "https://res.cloudinary.com/.../image/upload/...",
      "imageId": "carsnk/cars/...",
      "bookingUrl": "https://carsnk.gr/en/cars/toyota-yaris-automatic",
      "updatedAt": "2026-07-18T12:00:00.000Z"
    }
  ]
}
```

With `?include=pricing`, each item also has:

```json
"pricingTiers": {
  "NoSeason": { "4": 45, "7": 40, "14": 35 },
  "HighSeason": { "4": 65, "7": 60, "14": 55 }
}
```

Keys under each season are **day-tier thresholds** used by CarsNK pricing (typically `4`, `7`, `14`).

### Single car — `200 OK`

```json
{ "success": true, "data": { "...same fields..." } }
```

### Errors

| Status | Body |
|--------|------|
| `401` | `{ "success": false, "error": "Unauthorized", "message": "..." }` |
| `404` | `{ "success": false, "error": "Not found", "message": "Car not found" }` |
| `500` | `{ "success": false, "error": "Server error", "message": "..." }` |

---

## What is included / excluded

- Only **real** fleet cars (`testingCar` is false or missing).
- **No** customer PII, orders, or admin fields.
- `regNumber` (plate) is **not** exposed.
- `priceFrom` = minimum EUR/day found across all seasonal tiers.
- `bookingUrl` points to the English locale path; partners can swap `/en/` for another locale if needed.

---

## CORS

By default `Access-Control-Allow-Origin: *` (fine for server-side partners).

To restrict browser origins, set:

```bash
AGGREGATOR_CORS_ORIGINS=https://partner.example,https://another.partner
```

Server-to-server calls do not need CORS.

---

## Rate / usage notes

- Prefer caching on the partner side (e.g. 5–15 minutes).
- Poll list endpoint; use `updatedAt` / `id` for diffing.
- Do not ship `AGGREGATOR_API_KEY` to mobile/web clients — call from your backend only.

---

## Related

- Legacy BBQR-only feed (CORS locked to `bbqr.site`): `GET /api/internal/cars` — see [INTERNAL_API_CARS.md](./INTERNAL_API_CARS.md).
