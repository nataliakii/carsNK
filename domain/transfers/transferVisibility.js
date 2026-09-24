/**
 * Shared company transfer visibility for list, badge, and notification bell.
 *
 * Exact city/admin matching cannot live safely in Mongo alone, so callers use
 * a country + claim isolation DB filter, then this module filters batches until
 * the requested page (or total) is filled. Sort stays stable: createdAt desc, _id desc.
 */

import mongoose from "mongoose";
import {
  TRANSFER_OPEN_STATUSES,
  TRANSFER_STATUS,
} from "@/domain/transfers/transferStatus";
import {
  filterTransfersForCompanyViewer,
  isTransferVisibleToCompany,
} from "@/domain/transfers/eligibility";

export {
  filterTransfersForCompanyViewer,
  isTransferVisibleToCompany,
};

export const TRANSFER_LIST_SORT = Object.freeze({ createdAt: -1, _id: -1 });
export const TRANSFER_VISIBILITY_BATCH_SIZE = 100;
export const TRANSFER_VISIBILITY_MAX_SCAN = 8000;

function oid(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return null;
}

/**
 * Mongo prefilter: own claimed jobs + open unclaimed in the company country.
 * Coverage filtering happens after fetch.
 *
 * @param {string} ownerId
 * @param {string} companyCountry
 * @param {string} [status]
 */
export function buildCompanyTransferBaseFilter(ownerId, companyCountry, status = "") {
  const owner = oid(ownerId);
  const country = String(companyCountry || "").toUpperCase();
  const ownClaimed = owner
    ? [{ assignedSupplierId: owner }, { claimedByCompanyId: owner }]
    : [];

  if (status === "claimed" || status === TRANSFER_STATUS.CLAIMED) {
    return {
      $or: ownClaimed,
      status: { $in: [TRANSFER_STATUS.CLAIMED, "claimed"] },
    };
  }

  if (status === "open") {
    return {
      status: { $in: TRANSFER_OPEN_STATUSES },
      country,
      $or: [
        { assignedSupplierId: null },
        { assignedSupplierId: { $exists: false } },
      ],
    };
  }

  if (status) {
    return {
      $or: ownClaimed,
      status,
    };
  }

  return {
    $or: [
      {
        status: { $in: TRANSFER_OPEN_STATUSES },
        country,
        $or: [
          { assignedSupplierId: null },
          { assignedSupplierId: { $exists: false } },
        ],
      },
      ...ownClaimed,
    ],
  };
}

/**
 * Open / attention transfers for the company inbox bell.
 * Same claim isolation as the list; coverage applied in countVisible*.
 */
export function buildCompanyPendingTransfersBaseFilter(ownerId, companyCountry) {
  const owner = oid(ownerId);
  const country = String(companyCountry || "").toUpperCase();
  const ownClaimed = owner
    ? [{ assignedSupplierId: owner }, { claimedByCompanyId: owner }]
    : [];

  return {
    $or: [
      {
        status: { $in: TRANSFER_OPEN_STATUSES },
        country,
        $or: [
          { assignedSupplierId: null },
          { assignedSupplierId: { $exists: false } },
        ],
      },
      ...ownClaimed.map((clause) => ({
        ...clause,
        status: {
          $in: [
            TRANSFER_STATUS.CLAIMED,
            TRANSFER_STATUS.MANUAL_QUOTE_REQUIRED,
            TRANSFER_STATUS.AWAITING_ADMIN_QUOTE,
            "claimed",
          ],
        },
      })),
    ],
  };
}

async function scanVisibleBatches({
  TransferModel,
  baseFilter,
  company,
  cars,
  ownerId,
  batchSize = TRANSFER_VISIBILITY_BATCH_SIZE,
  maxScan = TRANSFER_VISIBILITY_MAX_SCAN,
  onBatch,
}) {
  let dbSkip = 0;
  let scanned = 0;
  let exhausted = false;

  while (!exhausted && scanned < maxScan) {
    const batch = await TransferModel.find(baseFilter)
      .sort(TRANSFER_LIST_SORT)
      .skip(dbSkip)
      .limit(batchSize)
      .lean();

    if (!batch.length) {
      exhausted = true;
      break;
    }

    dbSkip += batch.length;
    scanned += batch.length;
    const visible = filterTransfersForCompanyViewer(
      batch,
      company,
      cars,
      ownerId
    );
    const stop = onBatch?.(visible, { batch, scanned, exhausted: false });
    if (stop === false) break;
    if (batch.length < batchSize) {
      exhausted = true;
    }
  }

  return { scanned, exhausted };
}

/**
 * Page visible transfers after coverage filtering (stable sort).
 *
 * @returns {Promise<{ items: object[], total: number, scanned: number, exhausted: boolean }>}
 */
export async function listVisibleTransfersForCompany({
  TransferModel,
  baseFilter,
  company,
  cars = [],
  ownerId,
  limit = 100,
  skip = 0,
  batchSize = TRANSFER_VISIBILITY_BATCH_SIZE,
  maxScan = TRANSFER_VISIBILITY_MAX_SCAN,
}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const safeSkip = Math.max(0, Number(skip) || 0);
  const need = safeSkip + safeLimit;
  const collected = [];

  const { scanned, exhausted } = await scanVisibleBatches({
    TransferModel,
    baseFilter,
    company,
    cars,
    ownerId,
    batchSize,
    maxScan,
    onBatch: (visible) => {
      collected.push(...visible);
      return collected.length < need;
    },
  });

  let total = collected.length;
  if (!exhausted && collected.length >= need) {
    total = await countVisibleTransfersForCompany({
      TransferModel,
      baseFilter,
      company,
      cars,
      ownerId,
      batchSize,
      maxScan,
    });
  }

  return {
    items: collected.slice(safeSkip, safeSkip + safeLimit),
    total,
    scanned,
    exhausted,
  };
}

/**
 * Accurate visible total for badge / bell / list footer.
 */
export async function countVisibleTransfersForCompany({
  TransferModel,
  baseFilter,
  company,
  cars = [],
  ownerId,
  batchSize = TRANSFER_VISIBILITY_BATCH_SIZE,
  maxScan = TRANSFER_VISIBILITY_MAX_SCAN,
}) {
  let total = 0;
  await scanVisibleBatches({
    TransferModel,
    baseFilter,
    company,
    cars,
    ownerId,
    batchSize,
    maxScan,
    onBatch: (visible) => {
      total += visible.length;
    },
  });
  return total;
}

/**
 * Open in-area requests for this company (bell / transfer badge).
 * Excludes another company's claimed jobs via base filter + viewer filter.
 */
export async function countVisibleOpenTransfersForCompany({
  TransferModel,
  company,
  cars = [],
  ownerId,
  companyCountry,
}) {
  const country =
    companyCountry || String(company?.country || "").toUpperCase();
  const baseFilter = buildCompanyTransferBaseFilter(ownerId, country, "open");
  return countVisibleTransfersForCompany({
    TransferModel,
    baseFilter,
    company,
    cars,
    ownerId,
  });
}
