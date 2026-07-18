/**
 * Migration: add/normalize secondDriver field in existing orders.
 *
 * Sets secondDriver=false for documents where field is missing or null.
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

// Load .env/.env.local the same way Next.js does
loadEnvConfig(process.cwd());

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/natalicar";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";

async function migrateSecondDriverField() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB_NAME);
    const ordersCollection = db.collection("orders");

    const missingCount = await ordersCollection.countDocuments({
      secondDriver: { $exists: false },
    });
    const nullCount = await ordersCollection.countDocuments({
      secondDriver: null,
    });

    console.log(`Orders missing secondDriver: ${missingCount}`);
    console.log(`Orders with secondDriver=null: ${nullCount}`);

    if (missingCount === 0 && nullCount === 0) {
      console.log("Nothing to migrate.");
      return;
    }

    const result = await ordersCollection.updateMany(
      {
        $or: [{ secondDriver: { $exists: false } }, { secondDriver: null }],
      },
      { $set: { secondDriver: false } }
    );

    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);

    const trueCount = await ordersCollection.countDocuments({
      secondDriver: true,
    });
    const falseCount = await ordersCollection.countDocuments({
      secondDriver: false,
    });
    const stillMissingCount = await ordersCollection.countDocuments({
      secondDriver: { $exists: false },
    });

    console.log("Post-migration stats:");
    console.log(`  secondDriver=true: ${trueCount}`);
    console.log(`  secondDriver=false: ${falseCount}`);
    console.log(`  secondDriver missing: ${stillMissingCount}`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await client.close();
    console.log("MongoDB connection closed");
  }
}

if (require.main === module) {
  migrateSecondDriverField()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { migrateSecondDriverField };
