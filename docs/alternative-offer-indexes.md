# Alternative vehicle offer indexes

`alternative_vehicle_offers` indexes are **not** created, dropped, or
synchronised by the application or by expiration cleanup.

`POST /api/internal/alternative-offers/expire` only expires due `OFFERED`
rows. It must not call `syncIndexes()`.

## One active offer per order

Partial unique index:

- name: `orderId_1_status_offered_unique`
- key: `{ orderId: 1 }`
- unique: true
- `partialFilterExpression: { status: "OFFERED" }`

Expired, declined and withdrawn offers do not participate, so a later offer
can be created.

Expiration scheduling: see `docs/alternative-offer-expiration.md`.
POST `/api/internal/alternative-offers/expire` with
`Authorization: Bearer $CRON_SECRET`. Do not add a mutating GET cron.

## Production command

Inspect first (no writes):

```bash
MONGODB_URI="mongodb://..." MONGODB_DB_NAME="Car" \
  node scripts/migrateAlternativeOfferIndexes.js
```

Apply once (idempotent `createIndex`; will not drop extra indexes):

```bash
MONGODB_URI="mongodb://..." MONGODB_DB_NAME="Car" \
  node scripts/migrateAlternativeOfferIndexes.js --apply
```

or:

```bash
npm run migrate:alternative-offer-indexes -- --apply
```

`--apply` is required. The script is not imported by the Next.js app and is
not referenced from `vercel.json` crons.

Do **not** rely on mongoose `autoIndex` in production for the partial unique
index.

## Rollback

This migration only creates missing indexes. It does not drop anything.

```js
db.alternative_vehicle_offers.dropIndex("orderId_1_status_offered_unique")
```

Do **not** run `mongoose.Model.syncIndexes()` against production.

## Consistency strategy (acceptance)

Mongo transactions are used only when the deployment supports them. Local
standalone Mongo / `mongodb-memory-server` tests do **not** use transactions.

Acceptance compensation:

1. Recheck availability. Failure → offer stays `OFFERED`, no hold.
2. Acquire BookingHold for car B (per-car lock + overlapping hold check).
   Failure → offer stays `OFFERED`.
3. CAS `OFFERED → ACCEPTED` on the high-entropy `offerId`.
   Failure → release the hold we just acquired unless the same offer is
   already `ACCEPTED` (replay: keep hold).
4. CAS the unpaid order onto car B + original snapshot + accepted price.
   Failure → revert the offer to `OFFERED` and release the hold.
5. Stripe Checkout for accepted `prepaymentMinor` (`forceNew`).
   Failure → keep accepted order and hold (`RETRY`), set
   `paymentLinkGenerationFailed`, notify SUPERADMIN. Retry through existing
   payment-ops; do not mark paid.
6. Customer payment-link email failure → booking/payment state stays;
   MailLog records the failure. No rollback.

Creating an offer never acquires a hold or Stripe session. If this unpaid
order already had a car-A hold or unpaid Checkout session, that hold is
released (same order only) and the session is archived as replaced.

Webhook confirms only the current `providerPaymentId`. Older car-A sessions
are stale: HTTP 2xx, no paid transition, AuditLog.
