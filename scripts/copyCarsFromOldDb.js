/**
 * Copy cars from old Natali Mongo (car.8uqtk) into current CarsNK Mongo.
 *
 * Usage:
 *   MONGODB_URI_OLD="mongodb+srv://...@car.8uqtk.mongodb.net/..." \
 *   npm run copy:cars-from-old
 *
 * Options:
 *   --dry-run     only count / list, no writes
 *   --replace     delete all cars in target before insert
 *   --skip-existing  skip rows whose carNumber already exists (default)
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
const REPLACE = args.has("--replace");

function stripVolatile(doc) {
  const copy = { ...doc };
  // Keep _id so booking URLs / aggregators stay stable if you care about ids.
  // Drop order refs — those orders live only on the old cluster.
  copy.orders = [];
  copy.ownerId = new ObjectId(COMPANY_ID);
  if (copy.testingCar == null) copy.testingCar = false;
  copy.copiedFromOldAt = new Date();
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
    const oldCars = oldClient.db(MONGODB_DB_NAME).collection("cars");
    const newCars = newClient.db(MONGODB_DB_NAME).collection("cars");

    const source = await oldCars.find({}).toArray();
    console.log(`Source cars: ${source.length}`);
    console.log(`Target cars (before): ${await newCars.countDocuments()}`);

    if (DRY_RUN) {
      console.log(
        "Dry run sample:",
        source.slice(0, 8).map((c) => ({
          carNumber: c.carNumber,
          model: c.model,
          photoUrl: c.photoUrl,
        }))
      );
      return;
    }

    if (REPLACE) {
      const del = await newCars.deleteMany({});
      console.log(`Deleted target cars: ${del.deletedCount}`);
    }

    const existingNumbers = new Set(
      (
        await newCars
          .find({}, { projection: { carNumber: 1 } })
          .toArray()
      ).map((c) => String(c.carNumber))
    );

    let inserted = 0;
    let skipped = 0;
    let updated = 0;

    for (const raw of source) {
      const doc = stripVolatile(raw);
      const num = String(doc.carNumber || "");
      if (!REPLACE && existingNumbers.has(num)) {
        skipped += 1;
        continue;
      }

      try {
        await newCars.replaceOne({ _id: doc._id }, doc, { upsert: true });
        if (existingNumbers.has(num) || REPLACE) updated += 1;
        else inserted += 1;
        existingNumbers.add(num);
      } catch (err) {
        // Fallback: insert without colliding _id
        if (err?.code === 11000) {
          const { _id, ...rest } = doc;
          await newCars.insertOne(rest);
          inserted += 1;
        } else {
          console.error(`Failed carNumber=${num}:`, err.message);
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          inserted,
          updated,
          skipped,
          targetAfter: await newCars.countDocuments(),
        },
        null,
        2
      )
    );
    console.log(
      "Note: photoUrl public_ids are from the old Cloudinary account — if CldImage uses the new cloud name, re-upload photos or point CLOUDINARY cloud temporarily."
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
