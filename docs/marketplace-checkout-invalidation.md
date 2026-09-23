# Marketplace checkout invalidation retry

Failed Stripe expirations store `complianceInvalidateRetry` on the unpaid
order payment (or alternative-offer row). This job retries those records.

The job is **POST-only**. Do not add a Vercel GET cron that mutates state.
Vercel Cron is GET-only, so this must be triggered by an external scheduler
that can POST.

## Authentication

- Header: `Authorization: Bearer $CRON_SECRET`
- There is **no default secret**. If `CRON_SECRET` is unset, cron auth fails
  and only an authenticated SUPERADMIN session may run the job.
- Do not put the secret in source control, emails, or this document.

SUPERADMIN can also POST the same route while signed in, or use **Retry
invalidation** on the marketplace payment-ops panel.

## Retry job

- Method: `POST`
- Endpoint: `/api/internal/marketplace-checkout-invalidation/retry`
- Recommended interval: every 5–15 minutes
- Request body (optional): `{ "limit": 50 }` (clamped 1–200)
- Success counts only:

```json
{
  "success": true,
  "processed": 0,
  "invalidated": 0,
  "skippedPaid": 0,
  "stillRetryable": 0,
  "failed": 0
}
```

- GET: `405` and never mutates
- Processes order Checkout Sessions and alternative-offer Sessions
- Only rows with `complianceInvalidateRetry: true` that are due (`retryAt`)
- Paid / complete Stripe sessions are skipped; the webhook finalises them
- One failing row does not stop the batch
- Must not call `syncIndexes()`
- Responses and logs must not include customer PII or Stripe secrets

Backoff: `2^min(attempts, 6)` minutes after each failure (2–64 minutes).
Maximum attempt counter is 8; retries continue at the max backoff until the
session is expired or a terminal no-op (already paid / already invalidated).

## Related jobs (separate endpoints)

- Holds: `POST /api/internal/booking-holds/cleanup`
- Alternative offer time expiry: `POST /api/internal/alternative-offers/expire`
- Same `Authorization: Bearer $CRON_SECRET`
