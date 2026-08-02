/**
 * One-shot / forced pull of orders from old Natali Mongo into CarsNK Mongo
 * for cars that were copied from the old cluster (same car _ids).
 *
 * Usage:
 *   MONGODB_URI_OLD="mongodb+srv://...@car.8uqtk.mongodb.net/..." \
 *   npm run copy:orders-from-old
 *
 * Options:
 *   --dry-run   count only, no writes
 */

const { MongoClient, ObjectId } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI_OLD = process.env.MONGODB_URI_OLD;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const COMPANY_ID = "679903bd10e6c8a8c0f027bc";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");

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
    const oldDb = oldClient.db(MONGODB_DB_NAME);
    const newDb = newClient.db(MONGODB_DB_NAME);

    let carIds = (
      await newDb
        .collection("cars")
        .find(
          { copiedFromOldAt: { $exists: true, $ne: null } },
          { projection: { _id: 1 } }
        )
        .toArray()
    ).map((c) => c._id);

    if (!carIds.length) {
      carIds = (
        await newDb
          .collection("cars")
          .find(
            { ownerId: new ObjectId(COMPANY_ID) },
            { projection: { _id: 1 } }
          )
          .toArray()
      ).map((c) => c._id);
    }

    const source = await oldDb
      .collection("orders")
      .find({ car: { $in: carIds } })
      .toArray();

    console.log(`Synced cars: ${carIds.length}`);
    console.log(`Source orders (old): ${source.length}`);
    console.log(
      `Target orders (before): ${await newDb.collection("orders").countDocuments()}`
    );

    if (DRY_RUN) {
      console.log(
        "Dry run sample:",
        source.slice(0, 8).map((o) => ({
          orderNumber: o.orderNumber,
          car: String(o.car),
          customerName: o.customerName,
          start: o.rentalStartDate,
          end: o.rentalEndDate,
        }))
      );
      return;
    }

    const ownerId = new ObjectId(COMPANY_ID);
    let upserted = 0;
    for (const raw of source) {
      const doc = { ...raw };
      doc.ownerId = ownerId;
      doc.syncedFromOldAt = new Date();
      if (doc.my_order == null) doc.my_order = true;
      await newDb
        .collection("orders")
        .replaceOne({ _id: doc._id }, doc, { upsert: true });
      upserted += 1;
    }

    const oldIds = source.map((o) => o._id);
    const prune = await newDb.collection("orders").deleteMany({
      car: { $in: carIds },
      syncedFromOldAt: { $exists: true },
      _id: { $nin: oldIds },
    });

    console.log(
      JSON.stringify(
        {
          upserted,
          pruned: prune.deletedCount || 0,
          targetAfter: await newDb.collection("orders").countDocuments(),
        },
        null,
        2
      )
    );
  } finally {
    await oldClient.close();
    await newClient.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
