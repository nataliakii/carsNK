/**
 * Seed: set testingCar field on all cars that don't have it.
 * - Cars without testingCar get testingCar: false (so they stay visible to everyone).
 * - Idempotent: only updates documents where testingCar is missing.
 * - Safe to run multiple times.
 *
 * Usage:
 *   npm run seed:testing-car
 *   MONGODB_URI="mongodb://..." npm run seed:testing-car
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/natalicar";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";

async function seedTestingCarField() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB_NAME);
    const carsCollection = db.collection("cars");
    console.log(`Using database: "${MONGODB_DB_NAME}", collection: cars`);

    const result = await carsCollection.updateMany(
      { testingCar: { $exists: false } },
      { $set: { testingCar: false } }
    );

    console.log(`Matched ${result.matchedCount} cars without testingCar.`);
    console.log(`Updated ${result.modifiedCount} cars with testingCar: false.`);

    const total = await carsCollection.countDocuments({});
    const withField = await carsCollection.countDocuments({ testingCar: { $exists: true } });
    console.log(`Total cars: ${total}. Cars with testingCar set: ${withField}.`);
  } catch (error) {
    console.error("Seed error:", error);
    throw error;
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

if (require.main === module) {
  seedTestingCarField()
    .then(() => {
      console.log("Seed completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}

module.exports = { seedTestingCarField };
