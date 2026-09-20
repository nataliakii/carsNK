# Driving licence retention job

Customer driving licence images are identity documents. The privacy policy
promises they are erased a configured time after the rental ends; this job is
what keeps that promise.

## Trigger

| | |
| --- | --- |
| Endpoint | `/api/admin/legal/driving-licence-retention` |
| Schedule | `vercel.json` → `crons`, daily at 03:17 UTC |
| Methods | `GET` (scheduler), `POST` (manual superadmin run) |

Vercel Cron can only issue `GET`, and sends `Authorization: Bearer $CRON_SECRET`
once `CRON_SECRET` is set on the project. `DOCUMENT_RETENTION_CRON_SECRET`
overrides it when this job needs its own rotatable key. A non-Vercel scheduler
may instead send `x-retention-cron-secret`, matching
`/api/admin/transfers/expire`.

Protection:

- secret compared with `crypto.timingSafeEqual`, never with `===`
- **no weak fallback**: with no secret configured, the scheduler path is simply
  unavailable and only a superadmin session can run the job
- rate limited (`retentionJobRateLimitOptions`) *before* authentication, so the
  endpoint cannot be used to guess the secret
- a superadmin `GET` is forced into dry-run: no URL anyone can open in a
  browser is allowed to erase documents. Real manual runs use `POST`.

`?dryRun=1` reports what would be deleted and changes nothing — no storage
call, no database write, no audit entry.

## What decides deletion

The job invents no rule. It calls `isPastRetention` from
`domain/legal/drivingLicenceAccess`, the same predicate the access policy is
built on, with `documentRetentionDays` from `PlatformSettings.legal`.

On top of that it applies one floor, also taken from the existing policy
constants rather than invented: nothing is deleted while the supplier's
post-return access window (`ACCESS_WINDOW_AFTER_RETURN_HOURS`) is still open,
so shortening the retention setting can never cut a live dispute short.

## Never deleted

- bookings still inside the retention period, including ongoing rentals
- bookings whose post-return access window is still open
- bookings with no resolvable end date — the retention clock has nothing to
  count from, so the documents are kept and reported as `no_rental_end`
- any URL that cannot be resolved to a Cloudinary asset: deleting the database
  reference would strand the file forever, so the order is left untouched and
  reported as `unresolved_asset` for manual review
- assets Cloudinary did not confirm as deleted

## Batching and idempotency

Orders are read in pages of `documentRetentionBatchSize`, at most
`documentRetentionMaxBatches` pages per invocation, paging forward by `_id` so
an order the job failed to purge cannot make the run loop on it. When the page
budget runs out the summary reports `truncated: true` and the next scheduled
run continues.

Within an order: files first, references second, and only for the assets
storage confirmed (`$pull`, not an overwrite, so a licence uploaded during the
run is not discarded). A crash between the two steps leaves a row pointing at
an already-deleted file, which the next run finishes — Cloudinary reporting
`not_found` counts as deleted. Once `drivingLicenceUrls` is empty the order no
longer matches the candidate filter, so repeated runs are no-ops.
`drivingLicencePurgedAt` records that the erasure happened, which is what lets
the UI distinguish "deleted under the retention policy" from "never uploaded".

One failing order never stops the run.

## Audit and observability

Every erasure writes `DRIVING_LICENCE_DELETED` and every failure writes
`DRIVING_LICENCE_DELETION_FAILED` through `domain/legal/auditTrail`, which
swallows its own errors — an audit outage cannot abort or reverse a deletion.

Each run logs and returns a summary: `scanned`, `deleted`, `failed`, `skipped`,
`assetsDeleted`, `batches`, `truncated`, plus `skippedByReason` /
`failedByReason` breakdowns and per-order detail (capped at 200 entries).

## Configuration

Retention length and batching live in `PlatformSettings.legal` and are edited
in the superadmin Legal Configuration panel, not in environment variables:

| Setting | Default | Meaning |
| --- | --- | --- |
| `documentRetentionDays` | 90 | Retention period after the rental ends |
| `documentRetentionBatchSize` | 100 | Orders per page (hard ceiling 500) |
| `documentRetentionMaxBatches` | 20 | Pages per invocation |

Environment: `CRON_SECRET` (or `DOCUMENT_RETENTION_CRON_SECRET`), plus the
existing Cloudinary credentials. Optional:
`RETENTION_JOB_RATE_LIMIT_MAX`, `RETENTION_JOB_RATE_LIMIT_WINDOW_SEC`.
