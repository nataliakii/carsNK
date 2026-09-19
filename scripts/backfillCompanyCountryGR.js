/**
 * Backfill company.country = "GR" for all existing companies.
 *
 * Usage:
 *   node scripts/backfillCompanyCountryGR.js
 *   node scripts/backfillCompanyCountryGR.js --dry-run
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);
  const companies = db.collection("companies");

  const before = await companies
    .find({})
    .project({ name: 1, country: 1, slug: 1 })
    .toArray();

  console.log(`Found ${before.length} companies:`);
  for (const c of before) {
    console.log(
      `  - ${c.name || c._id} | country=${c.country ?? "(missing)"} | slug=${c.slug || "—"}`
    );
  }

  if (dryRun) {
    console.log("Dry run — no writes.");
    await client.close();
    return;
  }

  const result = await companies.updateMany(
    {},
    { $set: { country: "GR" } }
  );

  console.log(
    `Updated: matched=${result.matchedCount}, modified=${result.modifiedCount}`
  );

  const after = await companies
    .find({})
    .project({ name: 1, country: 1 })
    .toArray();
  const notGr = after.filter((c) => c.country !== "GR");
  if (notGr.length) {
    console.warn("Still not GR:", notGr.map((c) => c.name));
  } else {
    console.log("All companies now have country=GR.");
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
