#!/usr/bin/env node
/**
 * Explicit index migration for alternative_vehicle_offers.
 *
 * Enforces at most one active (`OFFERED`) alternative per order.
 * This script NEVER runs on application startup or cron. It is not imported
 * by the Next.js app. Indexes are created only when you pass --apply.
 *
 * Default (no flag): print existing indexes + the planned spec, then exit
 * without writing.
 *
 * Production:
 *   MONGODB_URI="mongodb://..." MONGODB_DB_NAME="Car" \
 *     node scripts/migrateAlternativeOfferIndexes.js --apply
 *
 * Rollback: drop the named index in mongo. Do not run mongoose syncIndexes()
 * in production — it drops indexes that are not in the current schema.
 *
 * Production autoIndex: do not rely on mongoose autoIndex to create the
 * partial unique index. Apply this script.
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");
const COLLECTION = "alternative_vehicle_offers";

/** Create-only. Never dropped by this script. */
const INDEXES = [
  { key: { offerId: 1 }, name: "offerId_1", unique: true },
  { key: { orderId: 1 }, name: "orderId_1" },
  { key: { companyId: 1 }, name: "companyId_1" },
  { key: { expiresAt: 1 }, name: "expiresAt_1" },
  { key: { status: 1 }, name: "status_1" },
  {
    key: { orderId: 1 },
    name: "orderId_1_status_offered_unique",
    unique: true,
    partialFilterExpression: { status: "OFFERED" },
  },
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
    partialFilterExpression: idx.partialFilterExpression || undefined,
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
    if (spec.partialFilterExpression) {
      options.partialFilterExpression = spec.partialFilterExpression;
    }
    const name = await collection.createIndex(spec.key, options);
    results.push({
      name,
      key: spec.key,
      unique: Boolean(spec.unique),
      partialFilterExpression: spec.partialFilterExpression,
    });
  }
  return results;
}

async function main() {
  const uri = getUri();
  const dbName = getDbName();
  const client = new MongoClient(uri);

  console.log(
    APPLY
      ? "[migrateAlternativeOfferIndexes] APPLY — will create missing indexes"
      : "[migrateAlternativeOfferIndexes] DRY RUN — pass --apply to create indexes"
  );
  console.log(`Database: ${dbName}`);

  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection(COLLECTION);

  const existing = await listIndexes(collection);
  printIndexes(`Existing ${COLLECTION} indexes`, existing);
  printIndexes(`Planned ${COLLECTION} indexes`, INDEXES);

  if (!APPLY) {
    console.log(
      "\nNo indexes were created. Re-run with an explicit command:\n" +
        "  node scripts/migrateAlternativeOfferIndexes.js --apply\n" +
        "  npm run migrate:alternative-offer-indexes -- --apply"
    );
    await client.close();
    return;
  }

  await applyIndexes(collection, INDEXES);
  const resulting = await listIndexes(collection);
  printIndexes(`Resulting ${COLLECTION} indexes`, resulting);
  console.log("\n[migrateAlternativeOfferIndexes] done (idempotent createIndex).");
  await client.close();
}

module.exports = { INDEXES, COLLECTION, APPLY, applyIndexes, listIndexes, summarizeIndexes };

if (require.main === module) {
  main().catch((err) => {
    console.error("[migrateAlternativeOfferIndexes] failed:", err?.message || err);
    process.exit(1);
  });
}
