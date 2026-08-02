/**
 * Bidirectional order sync for cars copied from the old Natali Mongo.
 *
 * - Pull: upsert old → new (so calendars see occupancy), prune stale pulled rows.
 * - Push: mirror create/update/delete from CarsNK → old (so both apps stay aligned).
 */

import { ObjectId } from "mongodb";
import { connectToDB } from "@lib/database";
import { getOldDb, isOldMongoConfigured } from "@lib/oldMongo";
import { COMPANY_ID } from "@config/company";

const SYNC_MIN_INTERVAL_MS = Math.max(
  5_000,
  Number(process.env.OLD_ORDERS_SYNC_INTERVAL_MS || 30_000) || 30_000
);

let lastPullAt = 0;
let pullInFlight = null;
let skipMirrorDepth = 0;

export function withSkipOldMirror(fn) {
  skipMirrorDepth += 1;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      skipMirrorDepth -= 1;
    });
}

function shouldMirrorToOld() {
  return skipMirrorDepth === 0 && isOldMongoConfigured();
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (typeof value === "object" && value._id) return toObjectId(value._id);
  const s = String(value);
  if (!ObjectId.isValid(s)) return null;
  return new ObjectId(s);
}

function stripForMirror(doc) {
  const copy = { ...doc };
  delete copy.__v;
  // Keep _id / car stable across clusters (cars were copied with same ids).
  return copy;
}

function preparePulledOrder(doc, ownerId) {
  const copy = stripForMirror(doc);
  copy.ownerId = ownerId;
  copy.syncedFromOldAt = new Date();
  if (copy.my_order == null) copy.my_order = true;
  return copy;
}

/**
 * Car ids in the current DB that originate from the old cluster.
 * Falls back to all cars for COMPANY_ID if none are tagged yet.
 */
export async function getSyncedCarIds() {
  await connectToDB();
  const db = (await import("mongoose")).default.connection.db;
  const cars = db.collection("cars");
  const ownerId = toObjectId(COMPANY_ID);

  let rows = await cars
    .find(
      { copiedFromOldAt: { $exists: true, $ne: null } },
      { projection: { _id: 1 } }
    )
    .toArray();

  if (!rows.length && ownerId) {
    rows = await cars
      .find({ ownerId }, { projection: { _id: 1 } })
      .toArray();
  }

  return rows.map((r) => r._id);
}

/**
 * Pull orders for synced cars from old Mongo into current Mongo.
 * @param {{ force?: boolean }} [options]
 */
export async function pullOrdersFromOldDb(options = {}) {
  if (!isOldMongoConfigured()) {
    return { skipped: true, reason: "MONGODB_URI_OLD not set" };
  }

  const force = Boolean(options.force);
  const now = Date.now();
  if (!force && now - lastPullAt < SYNC_MIN_INTERVAL_MS) {
    return { skipped: true, reason: "throttled", lastPullAt };
  }
  if (pullInFlight) return pullInFlight;

  pullInFlight = (async () => {
    try {
      const oldDb = await getOldDb();
      if (!oldDb) return { skipped: true, reason: "no old db" };

      await connectToDB();
      const newDb = (await import("mongoose")).default.connection.db;
      const carIds = await getSyncedCarIds();
      if (!carIds.length) {
        return { skipped: true, reason: "no synced cars" };
      }

      const ownerId = toObjectId(COMPANY_ID);
      const oldOrders = await oldDb
        .collection("orders")
        .find({ car: { $in: carIds } })
        .toArray();

      const newOrders = newDb.collection("orders");
      let upserted = 0;
      let pruned = 0;

      await withSkipOldMirror(async () => {
        for (const raw of oldOrders) {
          const doc = preparePulledOrder(raw, ownerId);
          await newOrders.replaceOne({ _id: doc._id }, doc, { upsert: true });
          upserted += 1;
        }

        // Drop occupancy that was pulled earlier but removed on the old cluster.
        const oldIds = oldOrders.map((o) => o._id);
        const prune = await newOrders.deleteMany({
          car: { $in: carIds },
          syncedFromOldAt: { $exists: true },
          _id: { $nin: oldIds },
        });
        pruned = prune.deletedCount || 0;
      });

      lastPullAt = Date.now();
      return {
        upserted,
        pruned,
        carCount: carIds.length,
        oldCount: oldOrders.length,
        lastPullAt,
      };
    } catch (err) {
      console.error("[oldOrdersSync] pull failed:", err?.message || err);
      return { error: err?.message || String(err) };
    } finally {
      pullInFlight = null;
    }
  })();

  return pullInFlight;
}

/**
 * Ensure a recent pull before calendar / admin reads.
 */
export async function ensureOrdersPulledFromOldDb() {
  try {
    await pullOrdersFromOldDb({ force: false });
  } catch (err) {
    console.error("[oldOrdersSync] ensure pull:", err?.message || err);
  }
}

function isSyncedCarId(carId, syncedSet) {
  if (!carId) return false;
  return syncedSet.has(String(carId));
}

let syncedCarIdCache = { at: 0, set: null };

async function getSyncedCarIdSet() {
  const now = Date.now();
  if (syncedCarIdCache.set && now - syncedCarIdCache.at < 60_000) {
    return syncedCarIdCache.set;
  }
  const ids = await getSyncedCarIds();
  syncedCarIdCache = {
    at: now,
    set: new Set(ids.map((id) => String(id))),
  };
  return syncedCarIdCache.set;
}

/**
 * Mirror one order document to the old cluster (create/update).
 * @param {object} orderDoc
 */
export async function mirrorOrderToOldDb(orderDoc) {
  if (!shouldMirrorToOld() || !orderDoc?._id) return { skipped: true };

  try {
    const carId = toObjectId(orderDoc.car);
    const synced = await getSyncedCarIdSet();
    if (!isSyncedCarId(carId, synced)) return { skipped: true, reason: "car" };

    const oldDb = await getOldDb();
    if (!oldDb) return { skipped: true };

    const doc = stripForMirror(
      typeof orderDoc.toObject === "function"
        ? orderDoc.toObject({ depopulate: true })
        : { ...orderDoc }
    );
    // Old cluster historically has no ownerId; keep if present, don't require it.
    doc._id = toObjectId(doc._id);
    doc.car = carId;
    doc.mirroredFromCarsNkAt = new Date();

    await oldDb
      .collection("orders")
      .replaceOne({ _id: doc._id }, doc, { upsert: true });
    return { ok: true };
  } catch (err) {
    console.error("[oldOrdersSync] mirror upsert failed:", err?.message || err);
    return { error: err?.message || String(err) };
  }
}

/**
 * Delete an order on the old cluster (for synced cars).
 * @param {string|ObjectId} orderId
 * @param {string|ObjectId} [carId]
 */
export async function mirrorOrderDeleteToOldDb(orderId, carId) {
  if (!shouldMirrorToOld() || !orderId) return { skipped: true };

  try {
    if (carId) {
      const synced = await getSyncedCarIdSet();
      if (!isSyncedCarId(carId, synced)) return { skipped: true, reason: "car" };
    }

    const oldDb = await getOldDb();
    if (!oldDb) return { skipped: true };

    const _id = toObjectId(orderId);
    if (!_id) return { skipped: true };

    await oldDb.collection("orders").deleteOne({ _id });
    return { ok: true };
  } catch (err) {
    console.error("[oldOrdersSync] mirror delete failed:", err?.message || err);
    return { error: err?.message || String(err) };
  }
}
