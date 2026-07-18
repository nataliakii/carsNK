/**
 * Seed DeliveryZone documents from data/delivery-locations.json.
 * - Upserts by slug (same rule as admin API: lowercase, spaces → hyphens).
 * - Idempotent: safe to run multiple times; updates distanceKm / name when JSON changes.
 * - Does not delete zones missing from JSON (only syncs listed locations).
 *
 * Usage:
 *   npm run seed:delivery-zones
 *   npm run seed:delivery-zones -- --dry-run
 */

const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/natalicar";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const COLLECTION = "deliveryzones";

const DATA_PATH = path.join(__dirname, "..", "data", "delivery-locations.json");

function slugify(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function parseArgs() {
  return process.argv.includes("--dry-run");
}

async function seedDeliveryZones() {
  const dryRun = parseArgs();
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const locations = JSON.parse(raw);

  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error(`Invalid or empty JSON: ${DATA_PATH}`);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB_NAME);
    const coll = db.collection(COLLECTION);
    console.log(`Database: "${MONGODB_DB_NAME}", collection: ${COLLECTION}`);
    if (dryRun) {
      console.log("DRY RUN — no writes.");
    }

    let upserted = 0;
    let modified = 0;
    let matched = 0;

    for (const row of locations) {
      const name = String(row.name || "").trim();
      const distanceKm = Number(row.distanceKm);
      if (!name || Number.isNaN(distanceKm) || distanceKm < 0) {
        console.warn("Skip invalid row:", row);
        continue;
      }

      const slug = slugify(name);
      const filter = { slug };
      const now = new Date();
      const setOnInsert = {
        fixedPrice: null,
        isFreeDelivery: false,
        coordinates: { lat: null, lng: null },
        isActive: true,
        createdAt: now,
      };
      const update = {
        $set: {
          name,
          slug,
          distanceKm,
          updatedAt: now,
        },
        $setOnInsert: setOnInsert,
      };

      if (dryRun) {
        const existing = await coll.findOne(filter);
        console.log(
          existing
            ? `[dry-run] would update: ${name} (${slug}) → ${distanceKm} km`
            : `[dry-run] would insert: ${name} (${slug}) ${distanceKm} km`
        );
        continue;
      }

      const result = await coll.updateOne(filter, update, { upsert: true });
      if (result.upsertedCount) upserted += 1;
      else if (result.modifiedCount) modified += 1;
      else matched += 1;
    }

    if (!dryRun) {
      console.log(
        `Done. Upserted: ${upserted}, modified: ${modified}, unchanged: ${matched}`
      );
      const total = await coll.countDocuments({});
      console.log(`Total documents in ${COLLECTION}: ${total}`);
    }
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

if (require.main === module) {
  seedDeliveryZones()
    .then(() => {
      console.log("Seed completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}

module.exports = { seedDeliveryZones, slugify };
