/**
 * @jest-environment node
 *
 * Storage is mocked throughout: the retention job must never touch a live
 * Cloudinary account from a test run.
 */

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));

jest.mock("@models/order", () => ({
  Order: { find: jest.fn(), updateOne: jest.fn() },
}));

jest.mock("@/domain/legal/drivingLicenceStorage", () => ({
  deleteDrivingLicenceAssets: jest.fn(),
}));

jest.mock("@/domain/legal/auditTrail", () => ({
  recordDrivingLicenceDeletion: jest.fn(),
}));

jest.mock("@/domain/legal/legalSettingsService", () => ({
  loadLegalSettings: jest.fn(),
}));

import { Order } from "@models/order";
import { deleteDrivingLicenceAssets } from "@/domain/legal/drivingLicenceStorage";
import { recordDrivingLicenceDeletion } from "@/domain/legal/auditTrail";
import { loadLegalSettings } from "@/domain/legal/legalSettingsService";
import { ACCESS_WINDOW_AFTER_RETURN_HOURS } from "@/domain/legal/drivingLicenceAccess";
import {
  runDrivingLicenceRetention,
  selectExpiredOrders,
  buildRetentionCandidateFilter,
  SKIP_REASON,
  FAILURE_REASON,
  MAX_BATCH_SIZE,
} from "@/domain/legal/drivingLicenceRetention";

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const NOW = new Date("2026-09-20T12:00:00Z");
const RETENTION_DAYS = 90;

const URL_A =
  "https://res.cloudinary.com/demo/image/upload/v1/carsnk/orders/ann-2026-01-01/driving-licence/front.jpg";
const ID_A = "carsnk/orders/ann-2026-01-01/driving-licence/front";
const URL_B =
  "https://res.cloudinary.com/demo/image/upload/v1/carsnk/orders/ann-2026-01-01/driving-licence/back.jpg";
const ID_B = "carsnk/orders/ann-2026-01-01/driving-licence/back";

let nextId = 1;

function order(overrides = {}) {
  return {
    _id: `order-${nextId++}`,
    orderNumber: "NK-1",
    drivingLicenceUrls: [URL_A],
    returnAtUtc: new Date(NOW.getTime() - 200 * DAY),
    ...overrides,
  };
}

/** Feed `Order.find` one page per call, mirroring the mongoose chain. */
function mockPages(...pages) {
  let call = 0;
  Order.find.mockImplementation(() => {
    const page = pages[call] || [];
    call += 1;
    return {
      sort: () => ({
        limit: () => ({
          select: () => ({ lean: async () => page }),
        }),
      }),
    };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  loadLegalSettings.mockResolvedValue({
    documentRetentionDays: RETENTION_DAYS,
    documentRetentionBatchSize: 100,
    documentRetentionMaxBatches: 20,
  });
  deleteDrivingLicenceAssets.mockImplementation(async (ids) => ({
    configured: true,
    gone: [...ids],
    failed: [],
    errorMessage: "",
  }));
  recordDrivingLicenceDeletion.mockResolvedValue(true);
  Order.updateOne.mockResolvedValue({ acknowledged: true });
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("selecting what may be erased", () => {
  const select = (orders) =>
    selectExpiredOrders({ orders, retentionDays: RETENTION_DAYS, now: NOW });

  it("selects a booking whose retention period has run out", () => {
    const { expired, skipped } = select([
      order({ returnAtUtc: new Date(NOW.getTime() - 91 * DAY) }),
    ]);
    expect(expired).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it("preserves a booking still inside the retention period", () => {
    const { expired, skipped } = select([
      order({ returnAtUtc: new Date(NOW.getTime() - 89 * DAY) }),
    ]);
    expect(expired).toHaveLength(0);
    expect(skipped[0].reason).toBe(SKIP_REASON.WITHIN_RETENTION);
  });

  it("preserves an ongoing rental", () => {
    const { expired, skipped } = select([
      order({ returnAtUtc: new Date(NOW.getTime() + 3 * DAY) }),
    ]);
    expect(expired).toHaveLength(0);
    expect(skipped[0].reason).toBe(SKIP_REASON.WITHIN_RETENTION);
  });

  it("preserves a just-returned rental even when retention is configured to zero", () => {
    const { expired, skipped } = selectExpiredOrders({
      orders: [
        order({
          returnAtUtc: new Date(
            NOW.getTime() - (ACCESS_WINDOW_AFTER_RETURN_HOURS - 1) * HOUR
          ),
        }),
      ],
      retentionDays: 0,
      now: NOW,
    });
    expect(expired).toHaveLength(0);
    expect(skipped[0].reason).toBe(SKIP_REASON.ACCESS_WINDOW_OPEN);
  });

  it("preserves a booking with no end date rather than guessing", () => {
    const { expired, skipped } = select([
      order({ returnAtUtc: null, timeOut: null, rentalEndDate: null }),
    ]);
    expect(expired).toHaveLength(0);
    expect(skipped[0].reason).toBe(SKIP_REASON.NO_RENTAL_END);
  });

  it("prefers returnAtUtc over the weaker end timestamps", () => {
    const { expired, skipped } = select([
      order({
        returnAtUtc: new Date(NOW.getTime() - 2 * DAY),
        timeOut: new Date(NOW.getTime() - 400 * DAY),
        rentalEndDate: new Date(NOW.getTime() - 400 * DAY),
      }),
    ]);
    expect(expired).toHaveLength(0);
    expect(skipped[0].reason).toBe(SKIP_REASON.WITHIN_RETENTION);
  });
});

describe("candidate filter", () => {
  it("asks the database only for orders that still hold documents", () => {
    const filter = buildRetentionCandidateFilter({
      now: NOW,
      retentionDays: RETENTION_DAYS,
    });
    expect(filter["drivingLicenceUrls.0"]).toEqual({ $exists: true });
    expect(filter._id).toBeUndefined();
    expect(filter.$or[0].returnAtUtc.$lte).toEqual(
      new Date(NOW.getTime() - RETENTION_DAYS * DAY)
    );
  });

  it("pages forward by _id", () => {
    const filter = buildRetentionCandidateFilter({
      now: NOW,
      retentionDays: RETENTION_DAYS,
      afterId: "order-7",
    });
    expect(filter._id).toEqual({ $gt: "order-7" });
  });
});

describe("running the job", () => {
  it("deletes the files first, then the references, and audits the erasure", async () => {
    const doomed = order({ drivingLicenceUrls: [URL_A, URL_B] });
    mockPages([doomed]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(deleteDrivingLicenceAssets).toHaveBeenCalledWith([ID_A, ID_B]);
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: doomed._id },
      expect.objectContaining({
        $pull: { drivingLicenceUrls: { $in: [URL_A, URL_B] } },
        $set: { drivingLicencePurgedAt: NOW },
      })
    );
    expect(recordDrivingLicenceDeletion).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: doomed._id,
        result: "success",
        retentionDays: RETENTION_DAYS,
        assetRefs: [ID_A, ID_B],
      })
    );
    expect(summary).toMatchObject({
      scanned: 1,
      deleted: 1,
      failed: 0,
      skipped: 0,
      assetsDeleted: 2,
      dryRun: false,
    });
  });

  it("leaves an in-window booking untouched", async () => {
    mockPages([order({ returnAtUtc: new Date(NOW.getTime() - 10 * DAY) })]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(deleteDrivingLicenceAssets).not.toHaveBeenCalled();
    expect(Order.updateOne).not.toHaveBeenCalled();
    expect(summary.deleted).toBe(0);
    expect(summary.skippedByReason[SKIP_REASON.WITHIN_RETENTION]).toBe(1);
  });

  it("is a no-op on a second run, once nothing matches any more", async () => {
    mockPages([order()], []);

    const first = await runDrivingLicenceRetention({ now: NOW });
    const second = await runDrivingLicenceRetention({ now: NOW });

    expect(first.deleted).toBe(1);
    expect(second).toMatchObject({ scanned: 0, deleted: 0, failed: 0 });
    expect(deleteDrivingLicenceAssets).toHaveBeenCalledTimes(1);
    expect(Order.updateOne).toHaveBeenCalledTimes(1);
  });

  it("finishes the job when a previous run deleted the file but not the row", async () => {
    // Cloudinary reports not_found, which the storage layer treats as gone.
    const stranded = order();
    mockPages([stranded]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(Order.updateOne).toHaveBeenCalledTimes(1);
    expect(summary.deleted).toBe(1);
  });

  it("keeps going when one order fails in storage", async () => {
    const bad = order({ orderNumber: "NK-BAD" });
    const good = order({ orderNumber: "NK-GOOD" });
    deleteDrivingLicenceAssets.mockImplementation(async (ids) =>
      ids.includes(ID_A) && deleteDrivingLicenceAssets.mock.calls.length === 1
        ? {
            configured: true,
            gone: [],
            failed: [...ids],
            errorMessage: "Cloudinary timeout",
          }
        : { configured: true, gone: [...ids], failed: [], errorMessage: "" }
    );
    mockPages([bad, good]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(summary).toMatchObject({ scanned: 2, deleted: 1, failed: 1 });
    expect(summary.failedByReason[FAILURE_REASON.STORAGE_DELETE_FAILED]).toBe(1);
    // The failed order keeps its references: no row points at a live file
    // that the database has forgotten.
    expect(Order.updateOne).toHaveBeenCalledTimes(1);
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: good._id },
      expect.anything()
    );
    expect(recordDrivingLicenceDeletion).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: bad._id,
        result: "failure",
        reason: FAILURE_REASON.STORAGE_DELETE_FAILED,
        errorMessage: "Cloudinary timeout",
      })
    );
  });

  it("clears only the references storage confirmed", async () => {
    const partial = order({ drivingLicenceUrls: [URL_A, URL_B] });
    deleteDrivingLicenceAssets.mockResolvedValue({
      configured: true,
      gone: [ID_A],
      failed: [ID_B],
      errorMessage: "one asset refused",
    });
    mockPages([partial]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: partial._id },
      expect.objectContaining({
        $pull: { drivingLicenceUrls: { $in: [URL_A] } },
      })
    );
    expect(summary.failed).toBe(1);
    expect(summary.assetsDeleted).toBe(1);
    // Both halves of a partial erasure are on the record.
    expect(recordDrivingLicenceDeletion).toHaveBeenCalledWith(
      expect.objectContaining({ result: "success", assetRefs: [ID_A] })
    );
    expect(recordDrivingLicenceDeletion).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "failure",
        reason: FAILURE_REASON.STORAGE_DELETE_FAILED,
        assetRefs: [ID_B],
      })
    );
  });

  it("never drops a reference it cannot turn into a stored asset", async () => {
    mockPages([order({ drivingLicenceUrls: ["https://example.com/scan.jpg"] })]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(deleteDrivingLicenceAssets).not.toHaveBeenCalled();
    expect(Order.updateOne).not.toHaveBeenCalled();
    expect(summary.failedByReason[FAILURE_REASON.UNRESOLVED_ASSET]).toBe(1);
  });

  it("reports a failed database update instead of pretending to succeed", async () => {
    Order.updateOne.mockRejectedValue(new Error("write concern failed"));
    mockPages([order()]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(summary.failedByReason[FAILURE_REASON.DB_UPDATE_FAILED]).toBe(1);
    expect(recordDrivingLicenceDeletion).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "failure",
        reason: FAILURE_REASON.DB_UPDATE_FAILED,
      })
    );
  });

  it("completes the deletion even when the audit write blows up", async () => {
    recordDrivingLicenceDeletion.mockRejectedValue(new Error("audit down"));
    mockPages([order()]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(Order.updateOne).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ deleted: 1, failed: 0 });
  });
});

describe("dry run", () => {
  it("reports what would go without deleting anything", async () => {
    const doomed = order({ drivingLicenceUrls: [URL_A, URL_B] });
    mockPages([doomed]);

    const summary = await runDrivingLicenceRetention({ now: NOW, dryRun: true });

    expect(deleteDrivingLicenceAssets).not.toHaveBeenCalled();
    expect(Order.updateOne).not.toHaveBeenCalled();
    expect(recordDrivingLicenceDeletion).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      dryRun: true,
      scanned: 1,
      deleted: 1,
      assetsDeleted: 2,
    });
    expect(summary.orders[0]).toMatchObject({
      orderId: doomed._id,
      outcome: "would_delete",
      assetCount: 2,
    });
  });
});

describe("batching", () => {
  it("pages forward by _id and stops at the configured page budget", async () => {
    const pageOne = [order(), order()];
    const pageTwo = [order(), order()];
    mockPages(pageOne, pageTwo);

    const summary = await runDrivingLicenceRetention({
      now: NOW,
      batchSize: 2,
      maxBatches: 2,
    });

    expect(summary.batches).toBe(2);
    expect(summary.scanned).toBe(4);
    expect(summary.truncated).toBe(true);
    expect(Order.find.mock.calls[1][0]._id).toEqual({
      $gt: pageOne[1]._id,
    });
  });

  it("takes the page size from the legal settings", async () => {
    loadLegalSettings.mockResolvedValue({
      documentRetentionDays: 30,
      documentRetentionBatchSize: 5,
      documentRetentionMaxBatches: 3,
    });
    mockPages([]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(summary).toMatchObject({ retentionDays: 30, batchSize: 5 });
  });

  it("refuses an absurd page size", async () => {
    loadLegalSettings.mockResolvedValue({
      documentRetentionDays: 30,
      documentRetentionBatchSize: 10_000,
      documentRetentionMaxBatches: 3,
    });
    mockPages([]);

    const summary = await runDrivingLicenceRetention({ now: NOW });

    expect(summary.batchSize).toBe(MAX_BATCH_SIZE);
  });
});
