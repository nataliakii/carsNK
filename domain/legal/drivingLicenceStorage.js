/**
 * Storage side of the driving-licence retention job.
 *
 * `domain/orders/deleteOrderCloudinaryAssets` deletes assets when a whole
 * order is removed and reports a count. The retention job needs to know
 * *which* individual assets Cloudinary confirmed, because it only clears a
 * database reference once the file behind it is really gone — so this module
 * inspects the per-id result map instead of assuming the batch succeeded.
 */

import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";

/** Cloudinary rejects delete_resources calls larger than this. */
const DELETE_BATCH_LIMIT = 100;

/** Outcomes that mean "this asset is not in storage any more". */
const GONE = new Set(["deleted", "not_found"]);

/**
 * Delete driving licence images and report each asset individually.
 *
 * An id Cloudinary reports as `not_found` counts as deleted: a previous run
 * removed the file but did not manage to clear the database reference, and
 * retrying has to be able to finish that job rather than fail forever.
 *
 * @param {string[]} publicIds
 * @returns {Promise<{
 *   configured: boolean,
 *   gone: string[],
 *   failed: string[],
 *   errorMessage: string,
 * }>}
 */
export async function deleteDrivingLicenceAssets(publicIds) {
  const unique = [...new Set((publicIds || []).filter(Boolean))];
  if (unique.length === 0) {
    return { configured: true, gone: [], failed: [], errorMessage: "" };
  }

  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    return {
      configured: false,
      gone: [],
      failed: unique,
      errorMessage: cfg.message || "Cloudinary is not configured",
    };
  }

  const gone = [];
  const failed = [];
  let errorMessage = "";

  for (let i = 0; i < unique.length; i += DELETE_BATCH_LIMIT) {
    const batch = unique.slice(i, i + DELETE_BATCH_LIMIT);
    let response;
    try {
      response = await cloudinary.api.delete_resources(batch, {
        resource_type: "image",
        invalidate: true,
      });
    } catch (err) {
      failed.push(...batch);
      errorMessage = errorMessage || String(err?.message || err);
      continue;
    }

    const results = response?.deleted && typeof response.deleted === "object"
      ? response.deleted
      : {};
    for (const id of batch) {
      if (GONE.has(String(results[id] || ""))) gone.push(id);
      else failed.push(id);
    }
  }

  if (failed.length > 0 && !errorMessage) {
    errorMessage = "Cloudinary did not confirm deletion of every asset";
  }

  return { configured: true, gone, failed, errorMessage };
}
