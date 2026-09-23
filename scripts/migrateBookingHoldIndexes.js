#!/usr/bin/env node
/**
 * One-time, explicit index migration for marketplace booking holds.
 *
 * Collections:
 *   - booking_holds
 *   - booking_car_locks
 *
 * This script NEVER runs on application startup or cron. It is not imported
 * by the Next.js app. Indexes are created only when you pass --apply.
 *
 * Default (no flag): print existing indexes + the planned spec, then exit
 * without writing.
 *
 * Production:
 *   MONGODB_URI="mongodb://..." MONGODB_DB_NAME="Car" \
 *     node scripts/migrateBookingHoldIndexes.js --apply
 *
 *   or: npm run migrate:booking-hold-indexes -- --apply
 *
 * Rollback: this script does not drop indexes. To undo a created index,
 * drop it by name in mongo (see docs/booking-hold-indexes.md). Do not run
 * mongoose syncIndexes() in production — it drops indexes that are not in
 * the current schema.
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");

const HOLD_COLLECTION = "booking_holds";
const LOCK_COLLECTION = "booking_car_locks";

/** Must stay aligned with models/BookingHold.js (create only; never drop). */
const HOLD_INDEXES = [
  { key: { carId: 1 }, name: "carId_1" },
  { key: { orderId: 1 }, name: "orderId_1", unique: true },
  { key: { companyId: 1 }, name: "companyId_1" },
  { key: { holdExpiresAt: 1 }, name: "holdExpiresAt_1" },
  { key: { status: 1 }, name: "status_1" },
  {
    key: { carId: 1, status: 1, holdExpiresAt: 1 },
    name: "carId_1_status_1_holdExpiresAt_1",
  },
  {
    key: { carId: 1, pickupAtUtc: 1, returnAtUtc: 1 },
    name: "carId_1_pickupAtUtc_1_returnAtUtc_1",
  },
];

const LOCK_INDEXES = [
  { key: { carId: 1 }, name: "carId_1", unique: true },
  { key: { lockedUntil: 1 }, name: "lockedUntil_1" },
];

function getUri() {
  const uri = String(process.env.MONGODB_URI || "").trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }
  return uri;
}

function getDbName() {
  return String(process.env.MONGODB_DB_NAME || "Car").trim() || "Car";
}

function summarizeIndexes(indexes) {
  return (indexes || []).map((idx) => ({
    name: idx.name,
    key: idx.key,
    unique: Boolean(idx.unique),
  }));
}

function printIndexes(label, indexes) {
  console.log(`\n${label}`);
  console.log(JSON.stringify(summarizeIndexes(indexes), null, 2));
}

async function listIndexes(collection) {
  try {
    return await collection.indexes();
  } catch (err) {
    if (err?.codeName === "NamespaceNotFound" || err?.code === 26) {
      return [];
    }
    throw err;
  }
}

async function applyIndexes(collection, specs) {
  const results = [];
  for (const spec of specs) {
    const options = { name: spec.name };
    if (spec.unique) options.unique = true;
    const name = await collection.createIndex(spec.key, options);
    results.push({ name, key: spec.key, unique: Boolean(spec.unique) });
  }
  return results;
}

async function main() {
  const uri = getUri();
  const dbName = getDbName();
  const client = new MongoClient(uri);

  console.log(
    APPLY
      ? "[migrateBookingHoldIndexes] APPLY — will create missing indexes"
      : "[migrateBookingHoldIndexes] DRY RUN — pass --apply to create indexes"
  );
  console.log(`Database: ${dbName}`);

  await client.connect();
  const db = client.db(dbName);
  const holds = db.collection(HOLD_COLLECTION);
  const locks = db.collection(LOCK_COLLECTION);

  const existingHolds = await listIndexes(holds);
  const existingLocks = await listIndexes(locks);
  printIndexes(`Existing ${HOLD_COLLECTION} indexes`, existingHolds);
  printIndexes(`Existing ${LOCK_COLLECTION} indexes`, existingLocks);
  printIndexes(`Planned ${HOLD_COLLECTION} indexes`, HOLD_INDEXES);
  printIndexes(`Planned ${LOCK_COLLECTION} indexes`, LOCK_INDEXES);

  if (!APPLY) {
    console.log(
      "\nNo indexes were created. Re-run with an explicit command:\n" +
        "  node scripts/migrateBookingHoldIndexes.js --apply\n" +
        "  npm run migrate:booking-hold-indexes -- --apply"
    );
    await client.close();
    return;
  }

  await applyIndexes(holds, HOLD_INDEXES);
  await applyIndexes(locks, LOCK_INDEXES);

  const resultingHolds = await listIndexes(holds);
  const resultingLocks = await listIndexes(locks);
  printIndexes(`Resulting ${HOLD_COLLECTION} indexes`, resultingHolds);
  printIndexes(`Resulting ${LOCK_COLLECTION} indexes`, resultingLocks);

  console.log("\n[migrateBookingHoldIndexes] done (idempotent createIndex).");
  await client.close();
}

main().catch((err) => {
  console.error("[migrateBookingHoldIndexes] failed:", err?.message || err);
  process.exit(1);
});
