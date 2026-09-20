/**
 * Scheduled erasure of customer driving licence images.
 *
 * The privacy policy promises that identity documents disappear a configured
 * time after the rental ends. This module is what makes that true. It owns no
 * rule of its own: whether a document may go is decided by `isPastRetention`
 * in `drivingLicenceAccess`, and how long "a configured time" is comes from
 * PlatformSettings.legal.
 *
 * Three properties matter more than throughput here:
 *
 *   Never over-delete. A document is removed only when the retention clock
 *   has run out *and* the supplier's post-return access window has closed.
 *   Anything the policy cannot place — a booking with no end date, a URL that
 *   is not a resolvable Cloudinary asset — is reported, never guessed away.
 *
 *   Never lie about what is left. The file goes first, the database reference
 *   second, and only for assets storage actually confirmed. A crash in the
 *   middle leaves a row pointing at an already-deleted file, which the next
 *   run finishes cleanly, rather than a row that forgot about a live file.
 *
 *   Never stop at the first problem. One unreachable asset must not save the
 *   other thousand documents from deletion.
 */

import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { cloudinaryPublicIdFromSecureUrl } from "@/domain/orders/cloudinaryPublicIdFromSecureUrl";

import {
  isPastRetention,
  resolveRetentionAnchor,
  ACCESS_WINDOW_AFTER_RETURN_HOURS,
} from "./drivingLicenceAccess";
import { deleteDrivingLicenceAssets } from "./drivingLicenceStorage";
import { recordDrivingLicenceDeletion } from "./auditTrail";
import { loadLegalSettings } from "./legalSettingsService";

const DAY_MS = 24 * 3600 * 1000;

/** Hard ceiling on the configurable page size, whatever settings say. */
export const MAX_BATCH_SIZE = 500;

/** How many per-order entries a run reports back in detail. */
const MAX_REPORTED_ORDERS = 200;

/** Why an order was looked at but left alone. */
export const SKIP_REASON = Object.freeze({
  WITHIN_RETENTION: "within_retention",
  ACCESS_WINDOW_OPEN: "access_window_open",
  NO_RENTAL_END: "no_rental_end",
  NO_DOCUMENTS: "no_documents",
});

/** Why an order could not be purged. */
export const FAILURE_REASON = Object.freeze({
  UNRESOLVED_ASSET: "unresolved_asset",
  STORAGE_DELETE_FAILED: "storage_delete_failed",
  DB_UPDATE_FAILED: "db_update_failed",
});

const fields = [
  "orderNumber",
  "ownerId",
  "drivingLicenceUrls",
  "returnAtUtc",
  "timeOut",
  "rentalEndDate",
].join(" ");

/**
 * Candidates for one page, narrowed in the database so the job does not read
 * the whole order collection.
 *
 * The `$or` mirrors the end-date precedence of `resolveRetentionAnchor`: a
 * booking is only judged by a weaker timestamp when the stronger one is
 * absent. The result is a superset of what the predicate accepts — the
 * predicate still has the final word in `selectExpiredOrders`.
 *
 * @param {{ now: Date, retentionDays: number, afterId?: unknown }} params
 */
export function buildRetentionCandidateFilter({ now, retentionDays, afterId }) {
  const cutoff = new Date(now.getTime() - Number(retentionDays) * DAY_MS);
  const filter = {
    "drivingLicenceUrls.0": { $exists: true },
    $or: [
      { returnAtUtc: { $lte: cutoff } },
      { returnAtUtc: null, timeOut: { $lte: cutoff } },
      { returnAtUtc: null, timeOut: null, rentalEndDate: { $lte: cutoff } },
    ],
  };
  if (afterId) filter._id = { $gt: afterId };
  return filter;
}

/**
 * Split a page of candidates into what may be erased and what may not.
 *
 * Two clocks have to have run out. The configured retention period is the
 * promise made to the customer. The supplier's post-return access window is
 * the promise made to the fleet: while a handover can still be disputed the
 * document has to survive, even if someone configures a retention period
 * shorter than that window.
 *
 * @param {{ orders: object[], retentionDays: number, now: Date }} params
 */
export function selectExpiredOrders({ orders, retentionDays, now }) {
  const expired = [];
  const skipped = [];

  for (const order of orders) {
    const urls = Array.isArray(order?.drivingLicenceUrls)
      ? order.drivingLicenceUrls.filter((u) => typeof u === "string" && u)
      : [];

    if (urls.length === 0) {
      skipped.push({ order, reason: SKIP_REASON.NO_DOCUMENTS });
      continue;
    }
    if (!resolveRetentionAnchor(order)) {
      skipped.push({ order, reason: SKIP_REASON.NO_RENTAL_END });
      continue;
    }
    if (!isPastRetention({ order, retentionDays, now })) {
      skipped.push({ order, reason: SKIP_REASON.WITHIN_RETENTION });
      continue;
    }
    if (
      !isPastRetention({
        order,
        retentionDays: ACCESS_WINDOW_AFTER_RETURN_HOURS / 24,
        now,
      })
    ) {
      skipped.push({ order, reason: SKIP_REASON.ACCESS_WINDOW_OPEN });
      continue;
    }

    expired.push({ order, urls });
  }

  return { expired, skipped };
}

function clampBatchSize(value, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, MAX_BATCH_SIZE);
}

/**
 * The audit trail describes the erasure; it must never be able to prevent or
 * undo it. `recordDrivingLicenceDeletion` already swallows its own errors —
 * this keeps that guarantee even if that ever changes.
 */
async function safeAudit(entry) {
  try {
    await recordDrivingLicenceDeletion(entry);
  } catch (err) {
    console.error(
      "[driving-licence-retention] audit write failed",
      entry?.orderId,
      err?.message || err
    );
  }
}

/**
 * Erase one order's documents: storage first, database second, audit always.
 *
 * @returns {Promise<{ ok: boolean, reason?: string, assetsDeleted: number }>}
 */
async function purgeOrder({ order, urls, retentionDays, now }) {
  const orderId = String(order._id);
  const anchor = resolveRetentionAnchor(order);

  /** @type {Map<string, string[]>} public id → the URLs that resolve to it */
  const urlsByPublicId = new Map();
  const unresolved = [];
  for (const url of urls) {
    const publicId = cloudinaryPublicIdFromSecureUrl(url);
    if (!publicId) {
      unresolved.push(url);
      continue;
    }
    const known = urlsByPublicId.get(publicId) || [];
    known.push(url);
    urlsByPublicId.set(publicId, known);
  }

  // A URL nobody can turn into a storage id cannot be deleted from storage,
  // and dropping the reference alone would strand the file forever. Report it
  // and leave the order exactly as it is.
  if (unresolved.length > 0) {
    await safeAudit({
      orderId,
      assetRefs: unresolved,
      retentionDays,
      rentalEndedAt: anchor,
      result: "failure",
      reason: FAILURE_REASON.UNRESOLVED_ASSET,
      errorMessage:
        "Driving licence URL does not resolve to a Cloudinary asset; needs manual review",
    });
    return { ok: false, reason: FAILURE_REASON.UNRESOLVED_ASSET, assetsDeleted: 0 };
  }

  const publicIds = [...urlsByPublicId.keys()];
  const storage = await deleteDrivingLicenceAssets(publicIds);

  const deletedUrls = storage.gone.flatMap((id) => urlsByPublicId.get(id) || []);

  if (deletedUrls.length > 0) {
    try {
      await Order.updateOne(
        { _id: order._id },
        {
          // $pull rather than an overwrite: a licence uploaded between the
          // read and this write must not be silently discarded.
          $pull: { drivingLicenceUrls: { $in: deletedUrls } },
          $set: { drivingLicencePurgedAt: now },
        }
      );
    } catch (err) {
      await safeAudit({
        orderId,
        assetRefs: storage.gone,
        retentionDays,
        rentalEndedAt: anchor,
        result: "failure",
        reason: FAILURE_REASON.DB_UPDATE_FAILED,
        errorMessage: String(err?.message || err),
      });
      return {
        ok: false,
        reason: FAILURE_REASON.DB_UPDATE_FAILED,
        assetsDeleted: storage.gone.length,
      };
    }

    // Recorded as soon as it is true, so a partial run still leaves an
    // accurate trail of what was actually erased.
    await safeAudit({
      orderId,
      assetRefs: storage.gone,
      retentionDays,
      rentalEndedAt: anchor,
      result: "success",
      reason: `Retention period of ${retentionDays} days elapsed`,
    });
  }

  if (storage.failed.length > 0) {
    await safeAudit({
      orderId,
      assetRefs: storage.failed,
      retentionDays,
      rentalEndedAt: anchor,
      result: "failure",
      reason: FAILURE_REASON.STORAGE_DELETE_FAILED,
      errorMessage: storage.errorMessage,
    });
    return {
      ok: false,
      reason: FAILURE_REASON.STORAGE_DELETE_FAILED,
      assetsDeleted: storage.gone.length,
    };
  }

  return { ok: true, assetsDeleted: storage.gone.length };
}

/**
 * Run one pass of the retention job.
 *
 * Safe to call repeatedly and safe to call concurrently with itself: an order
 * whose documents are already gone no longer matches the candidate filter, so
 * a second run finds nothing left to do.
 *
 * @param {{
 *   now?: Date,
 *   dryRun?: boolean,
 *   batchSize?: number,
 *   maxBatches?: number,
 *   trigger?: string,
 * }} [options]
 */
export async function runDrivingLicenceRetention(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const dryRun = Boolean(options.dryRun);
  const trigger = options.trigger || "manual";

  await connectToDB();
  const settings = await loadLegalSettings();

  const retentionDays = Number(settings.documentRetentionDays);
  const batchSize = clampBatchSize(
    options.batchSize ?? settings.documentRetentionBatchSize,
    clampBatchSize(settings.documentRetentionBatchSize, 100)
  );
  const maxBatches = clampBatchSize(
    options.maxBatches ?? settings.documentRetentionMaxBatches,
    20
  );

  const summary = {
    trigger,
    dryRun,
    retentionDays,
    batchSize,
    startedAt: now.toISOString(),
    scanned: 0,
    deleted: 0,
    failed: 0,
    skipped: 0,
    assetsDeleted: 0,
    batches: 0,
    /** True when the page budget ran out before the backlog did. */
    truncated: false,
    skippedByReason: {},
    failedByReason: {},
    orders: [],
    detailsTruncated: false,
  };

  const note = (entry) => {
    if (summary.orders.length < MAX_REPORTED_ORDERS) summary.orders.push(entry);
    else summary.detailsTruncated = true;
  };

  let afterId = null;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const page = await Order.find(
      buildRetentionCandidateFilter({ now, retentionDays, afterId })
    )
      .sort({ _id: 1 })
      .limit(batchSize)
      .select(fields)
      .lean();

    if (page.length === 0) break;

    summary.batches += 1;
    summary.scanned += page.length;
    // Advance the cursor by _id, not by re-querying from the start: an order
    // the job failed to purge stays in the candidate set, and a run that kept
    // re-reading page one would loop on it forever.
    afterId = page[page.length - 1]._id;

    const { expired, skipped } = selectExpiredOrders({
      orders: page,
      retentionDays,
      now,
    });

    for (const { order, reason } of skipped) {
      summary.skipped += 1;
      summary.skippedByReason[reason] =
        (summary.skippedByReason[reason] || 0) + 1;
      note({
        orderId: String(order._id),
        orderNumber: order.orderNumber || "",
        outcome: "skipped",
        reason,
      });
    }

    for (const { order, urls } of expired) {
      if (dryRun) {
        summary.deleted += 1;
        summary.assetsDeleted += urls.length;
        note({
          orderId: String(order._id),
          orderNumber: order.orderNumber || "",
          outcome: "would_delete",
          assetCount: urls.length,
          rentalEndedAt: new Date(resolveRetentionAnchor(order)).toISOString(),
        });
        continue;
      }

      let result;
      try {
        result = await purgeOrder({ order, urls, retentionDays, now });
      } catch (err) {
        // A single unexpected failure must not end the run.
        console.error(
          "[driving-licence-retention] order failed",
          String(order._id),
          err?.message || err
        );
        result = { ok: false, reason: "unexpected_error", assetsDeleted: 0 };
      }

      summary.assetsDeleted += result.assetsDeleted;
      if (result.ok) {
        summary.deleted += 1;
        note({
          orderId: String(order._id),
          orderNumber: order.orderNumber || "",
          outcome: "deleted",
          assetCount: result.assetsDeleted,
        });
      } else {
        summary.failed += 1;
        summary.failedByReason[result.reason] =
          (summary.failedByReason[result.reason] || 0) + 1;
        note({
          orderId: String(order._id),
          orderNumber: order.orderNumber || "",
          outcome: "failed",
          reason: result.reason,
        });
      }
    }

    if (page.length < batchSize) break;
    if (batch === maxBatches - 1) summary.truncated = true;
  }

  summary.finishedAt = new Date().toISOString();

  console.log(
    `[driving-licence-retention] ${dryRun ? "dry-run" : "run"} trigger=${trigger} ` +
      `retentionDays=${retentionDays} scanned=${summary.scanned} ` +
      `deleted=${summary.deleted} failed=${summary.failed} ` +
      `skipped=${summary.skipped} assets=${summary.assetsDeleted} ` +
      `batches=${summary.batches}${summary.truncated ? " (more remaining)" : ""}`
  );

  return summary;
}
