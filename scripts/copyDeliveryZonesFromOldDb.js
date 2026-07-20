/**
 * Copy DeliveryZone docs from old Natali Mongo into current CarsNK Mongo.
 *
 * Usage:
 *   MONGODB_URI_OLD="mongodb+srv://...@car.8uqtk.mongodb.net/..." \
 *   npm run copy:delivery-zones-from-old
 *
 * Options:
 *   --dry-run   list only, no writes
 *   --replace   delete all deliveryzones in target before insert
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI_OLD = process.env.MONGODB_URI_OLD;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const COLLECTION = "deliveryzones";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const REPLACE = args.has("--replace");

function toZoneDoc(doc) {
  const copy = { ...doc };
  copy.copiedFromOldAt = new Date();
  if (copy.fixedPrice === undefined) copy.fixedPrice = null;
  if (copy.isFreeDelivery == null) copy.isFreeDelivery = false;
  if (copy.isActive == null) copy.isActive = true;
  if (!copy.coordinates) copy.coordinates = { lat: null, lng: null };
  return copy;
}

async function main() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is required (target)");
  if (!MONGODB_URI_OLD) {
    throw new Error(
      "MONGODB_URI_OLD is required (source, e.g. car.8uqtk.mongodb.net)"
    );
  }

  const oldClient = new MongoClient(MONGODB_URI_OLD);
  const newClient = new MongoClient(MONGODB_URI);

  try {
    await oldClient.connect();
    await newClient.connect();
    const oldColl = oldClient.db(MONGODB_DB_NAME).collection(COLLECTION);
    const newColl = newClient.db(MONGODB_DB_NAME).collection(COLLECTION);

    const source = await oldColl.find({}).toArray();
    console.log(`Source ${COLLECTION}: ${source.length}`);
    console.log(`Target ${COLLECTION} (before): ${await newColl.countDocuments()}`);

    if (DRY_RUN) {
      console.log(
        "Dry run sample:",
        source.slice(0, 10).map((z) => ({
          name: z.name,
          distanceKm: z.distanceKm,
          fixedPrice: z.fixedPrice ?? null,
        }))
      );
      return;
    }

    if (REPLACE) {
      const del = await newColl.deleteMany({});
      console.log(`Deleted target zones: ${del.deletedCount}`);
    }

    const existingSlugs = new Set(
      (await newColl.find({}, { projection: { slug: 1 } }).toArray()).map((z) =>
        String(z.slug)
      )
    );

    let inserted = 0;
    let skipped = 0;
    for (const doc of source) {
      const slug = String(doc.slug || "").trim();
      if (!slug) {
        skipped += 1;
        continue;
      }
      if (!REPLACE && existingSlugs.has(slug)) {
        skipped += 1;
        continue;
      }
      await newColl.insertOne(toZoneDoc(doc));
      inserted += 1;
    }

    console.log(`Inserted: ${inserted}, skipped: ${skipped}`);
    console.log(`Target ${COLLECTION} (after): ${await newColl.countDocuments()}`);
  } finally {
    await oldClient.close().catch(() => {});
    await newClient.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
