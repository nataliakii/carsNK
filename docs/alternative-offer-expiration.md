# Alternative offer expiration scheduler

Expiration is **POST-only**. Do not add a Vercel GET cron that mutates state.
Vercel Cron is GET-only, so this job must be triggered by an external
scheduler that can POST.

Hold cleanup stays on a **separate** endpoint. The two jobs share the same
`CRON_SECRET` pattern, but they must not be coupled: a hold-cleanup failure
must not skip offer expiration, and the reverse.

## Authentication

- Header: `Authorization: Bearer $CRON_SECRET`
- There is **no default secret**. If `CRON_SECRET` is unset, cron auth fails
  and only an authenticated SUPERADMIN session may run the job.
- Do not put the secret in source control, emails, or this document.

SUPERADMIN can also POST the same route while signed in (fallback for a
manual sweep). Prefer the bearer secret in production.

## Alternative offers

- Method: `POST`
- Endpoint: `/api/internal/alternative-offers/expire`
- Recommended interval: every 5–15 minutes
- Timeout: 30s is enough for a 50-row batch; retry on 5xx with jitter
- Request body (optional): `{ "limit": 50 }`
- Success: `{ "success": true, "scanned": n, "expired": n, "emailed": n, "failed": n }`
- GET: `405` and never mutates
- Idempotent: only `OFFERED` rows with `expiresAt <= now` flip to `EXPIRED`
- Accepted / declined / withdrawn rows are not touched
- One expiration MailLog / AuditLog per offer (MailLog dedup + CAS)
- After expire, the order is reopened so another offer can be created
- Must not call `syncIndexes()`

## Booking holds (separate job)

- Method: `POST`
- Endpoint: `/api/internal/booking-holds/cleanup`
- Same `Authorization: Bearer $CRON_SECRET`
- Recommended interval: every 5–15 minutes, independently of offer expiry

## Monitoring

Log `expired` / `emailed` / `failed` (and hold `released` / `failed`) without
capability URLs or customer PII. Alert on HTTP 5xx or rising `failed`.
