/**
 * Seed: ensure Company documents contain notSendIP1..4 fields.
 * - Adds missing/null fields as empty strings.
 * - Keeps existing values intact.
 * - Safe to run multiple times.
 *
 * Usage:
 *   npm run seed:company-not-send-ips
 *   MONGODB_URI="mongodb://..." npm run seed:company-not-send-ips
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/natalicar";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";

async function seedCompanyNotSendIps() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB_NAME);
    const companiesCollection = db.collection("companies");
    console.log(`Using database: "${MONGODB_DB_NAME}", collection: companies`);

    const filter = {
      $or: [
        { notSendIP1: { $exists: false } },
        { notSendIP2: { $exists: false } },
        { notSendIP3: { $exists: false } },
        { notSendIP4: { $exists: false } },
        { notSendIP1: null },
        { notSendIP2: null },
        { notSendIP3: null },
        { notSendIP4: null },
      ],
    };

    const matchedBefore = await companiesCollection.countDocuments(filter);
    console.log(
      `Found ${matchedBefore} company document(s) with missing/null notSendIP fields.`
    );

    if (matchedBefore === 0) {
      console.log("All company documents already have notSendIP1..4.");
      return;
    }

    const result = await companiesCollection.updateMany(filter, [
      {
        $set: {
          notSendIP1: { $ifNull: ["$notSendIP1", ""] },
          notSendIP2: { $ifNull: ["$notSendIP2", ""] },
          notSendIP3: { $ifNull: ["$notSendIP3", ""] },
          notSendIP4: { $ifNull: ["$notSendIP4", ""] },
        },
      },
    ]);

    console.log(`Matched ${result.matchedCount} company document(s).`);
    console.log(`Modified ${result.modifiedCount} company document(s).`);

    const totalCompanies = await companiesCollection.countDocuments({});
    const withAllFields = await companiesCollection.countDocuments({
      notSendIP1: { $exists: true },
      notSendIP2: { $exists: true },
      notSendIP3: { $exists: true },
      notSendIP4: { $exists: true },
    });

    console.log(`Total companies: ${totalCompanies}.`);
    console.log(`Companies with all notSendIP fields present: ${withAllFields}.`);
  } catch (error) {
    console.error("Seed error:", error);
    throw error;
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

if (require.main === module) {
  seedCompanyNotSendIps()
    .then(() => {
      console.log("Seed completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}

module.exports = { seedCompanyNotSendIps };
