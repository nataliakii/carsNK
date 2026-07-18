# Order Guard Layer

Guard layer for `POST /api/order/add`: ban check, rate limiting, and suspicious behavior detection. It runs **before** the order controller; the controller logic is unchanged.

## Architecture

- **Middleware:** `middleware/orderGuard.js` — wraps the POST handler; runs ban → rate limit → abuse check, then calls the handler.
- **Services:** `services/banService.js`, `services/rateLimitService.js`, `services/orderAbuseService.js` — isolated logic, no order business code.
- **Config:** `config/orderGuard.js` — all limits and durations (no magic numbers).
- **Model:** `models/Ban.js` — MongoDB schema for bans.

## Order of checks

1. **Ban check** — IP and/or `x-client-id` fingerprint. If active ban → 403 `ORDER_BANNED`.
2. **Rate limit** — Per IP or fingerprint (e.g. 5 requests / 10 minutes). If exceeded → 429 `RATE_LIMIT`.
3. **Suspicious (pre)** — Same payload hash sent too many times in window → auto-ban + 403 `ORDER_BLOCKED`.
4. **Handler** — Order controller runs (unchanged).
5. **Record attempt** — Outcome (success/conflict/error) stored; if too many failures in window → auto-ban for next request.

## Request context

- **IP:** `x-forwarded-for` (first hop) or `x-real-ip`, fallback `"unknown"`.
- **Fingerprint:** `x-client-id` (optional).
- **Rate limit key:** `fp:${fingerprint}` if fingerprint present, else `ip:${ip}` if IP ≠ unknown, else `ua:${userAgent || "na"}` so unknown-IP clients don’t share one bucket.
- **Admin bypass:** if header `x-admin-request: 1` **AND** `getServerSession()` confirms `session.user.isAdmin`, guard is skipped. Header alone is not enough (spoofable); session proves authenticity. If header is set but no valid admin session — treated as regular client request, guard checks apply.

## Mongo schema: Ban

Collection: `bans`.

| Field        | Type     | Required | Description                                |
|-------------|----------|----------|--------------------------------------------|
| ip          | String   | no       | Banned IP (optional if fingerprint set)    |
| fingerprint | String   | no       | Banned client id (optional if ip set)     |
| reason      | String   | yes      | Ban reason                                 |
| type        | String   | yes      | `"manual"` \| `"auto"`                     |
| expiresAt   | Date     | no       | `null` = permanent until removed          |
| createdAt   | Date     | yes      | Set on create                              |

Indexes: `{ ip: 1, expiresAt: 1 }`, `{ fingerprint: 1, expiresAt: 1 }`, TTL `{ expiresAt: 1 }` with `expireAfterSeconds: 0` (Mongo auto-deletes docs when `expiresAt` is in the past).

## Rate limit store

Collection: `orderRateLimit` (from `rate-limiter-flexible`). Created automatically.

## Abuse attempts store

Collection: `orderAttempts`. Indexes created at first use so `countDocuments` by window doesn’t DOS the DB:

- `{ payloadHash: 1, createdAt: -1 }`
- `{ ip: 1, createdAt: -1 }`
- `{ fingerprint: 1, createdAt: -1 }`

| Field        | Type   | Description                    |
|-------------|--------|--------------------------------|
| ip          | String | null if only fingerprint used |
| fingerprint | String | null if only IP used          |
| payloadHash | String | Normalized hash (trim/lower, phone digits only) |
| outcome     | String | `"success"` \| `"conflict"` \| `"error"` |
| createdAt   | Date   |                                |

## Route wiring

In `app/api/order/add/route.js`:

- The previous `POST` handler body is moved into `postOrderAddHandler(request)`.
- Export: `export const POST = orderGuard(postOrderAddHandler);`
- Controller code is unchanged; guard runs first and passes a request with the same JSON body.

## Response codes (guard)

| Status | Code             | When                                  |
|--------|------------------|----------------------------------------|
| 403    | ORDER_BANNED     | Active ban for IP/fingerprint          |
| 403    | ORDER_BLOCKED    | Suspicious activity (e.g. same payload)|
| 429    | RATE_LIMIT       | Too many order attempts                |
| 400    | BAD_REQUEST      | Invalid or missing JSON body            |
| 503    | SERVICE_UNAVAILABLE | DB or rate-limit check failed       |

## Environment (optional)

All from `config/orderGuard.js`; override with env:

- `ORDER_GUARD_RATE_LIMIT_MAX` — max requests per window (default `5`)
- `ORDER_GUARD_RATE_LIMIT_WINDOW_SEC` — window in seconds (default `600`)
- `ORDER_GUARD_ABUSE_IDENTICAL_MAX` — same payload count → auto-ban (default `3`)
- `ORDER_GUARD_ABUSE_FAILED_MAX` — failed/conflict count in window → auto-ban (default `10`)
- `ORDER_GUARD_ABUSE_WINDOW_SEC` — abuse window in seconds (default `900`)
- `ORDER_GUARD_AUTO_BAN_DURATION_SEC` — auto-ban duration in seconds (default `3600`)

## Frontend

No changes required except handling the new responses:

- **403** with `code: "ORDER_BANNED"` — show `message` and optional `until`.
- **403** with `code: "ORDER_BLOCKED"` — show “blocked due to suspicious activity”.
- **429** with `code: "RATE_LIMIT"` — show “too many attempts”, suggest retry later.
