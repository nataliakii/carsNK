# Booking hold indexes

`booking_holds` and `booking_car_locks` indexes are **not** created, dropped,
or synchronised by the application or by the expired-hold cleanup cron.

`POST /api/internal/booking-holds/cleanup` only sweeps expired rows. It must
not call `syncIndexes()`.

## Production command

Inspect first (no writes):

```bash
MONGODB_URI="mongodb://..." MONGODB_DB_NAME="Car" \
  node scripts/migrateBookingHoldIndexes.js
```

Apply once (idempotent `createIndex`; will not drop extra indexes):

```bash
MONGODB_URI="mongodb://..." MONGODB_DB_NAME="Car" \
  node scripts/migrateBookingHoldIndexes.js --apply
```

or:

```bash
npm run migrate:booking-hold-indexes -- --apply
```

`--apply` is required. The script is not imported by the Next.js app and is
not referenced from `vercel.json` crons.

The script prints existing indexes, the planned spec, and (after `--apply`)
the resulting indexes.

## Planned indexes

`booking_holds`:

- `carId_1`
- `orderId_1` (unique)
- `companyId_1`
- `holdExpiresAt_1`
- `status_1`
- `carId_1_status_1_holdExpiresAt_1`
- `carId_1_pickupAtUtc_1_returnAtUtc_1`

`booking_car_locks`:

- `carId_1` (unique)
- `lockedUntil_1`

Keep this list aligned with `models/BookingHold.js`.

## Rollback

This migration only creates missing indexes. It does not drop anything.

To undo a created index, drop it by name in the target database, for example:

```js
db.booking_holds.dropIndex("carId_1_status_1_holdExpiresAt_1")
db.booking_car_locks.dropIndex("carId_1")
```

Do **not** run `mongoose.Model.syncIndexes()` against production to “clean
up”: `syncIndexes()` drops indexes that are not in the current schema.

Do **not** drop `_id_` unless you are discarding the collection.
