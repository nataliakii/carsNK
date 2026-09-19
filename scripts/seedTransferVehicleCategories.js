/**
 * Seed default transfer vehicle categories.
 * Usage: node scripts/seedTransferVehicleCategories.js
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const DEFAULTS = [
  {
    code: "STANDARD",
    title: "Standard",
    description: "Sedan for up to 3 passengers with standard luggage",
    maxPassengers: 3,
    standardLuggageCapacity: 2,
    cabinLuggageCapacity: 2,
    pricingMultiplier: 1,
    sort: 10,
    isActive: true,
  },
  {
    code: "COMFORT",
    title: "Comfort",
    description: "Higher-spec sedan or crossover",
    maxPassengers: 3,
    standardLuggageCapacity: 2,
    cabinLuggageCapacity: 2,
    pricingMultiplier: 1.2,
    sort: 20,
    isActive: true,
  },
  {
    code: "BUSINESS",
    title: "Business",
    description: "Premium business vehicle",
    maxPassengers: 3,
    standardLuggageCapacity: 2,
    cabinLuggageCapacity: 2,
    pricingMultiplier: 1.45,
    sort: 30,
    isActive: true,
  },
  {
    code: "MINIVAN",
    title: "Minivan",
    description: "Up to 6–7 passengers",
    maxPassengers: 7,
    standardLuggageCapacity: 6,
    cabinLuggageCapacity: 4,
    pricingMultiplier: 1.35,
    sort: 40,
    isActive: true,
  },
  {
    code: "MINIBUS",
    title: "Minibus",
    description: "Group transfers",
    maxPassengers: 16,
    standardLuggageCapacity: 16,
    cabinLuggageCapacity: 8,
    pricingMultiplier: 1.8,
    sort: 50,
    isActive: true,
  },
  {
    code: "ACCESSIBLE_VEHICLE",
    title: "Accessible vehicle",
    description: "Wheelchair-accessible transfer",
    maxPassengers: 3,
    standardLuggageCapacity: 2,
    cabinLuggageCapacity: 2,
    requiredSupplierCapabilities: ["wheelchair"],
    pricingMultiplier: 1.25,
    sort: 60,
    isActive: true,
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI required");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "Car");
  const col = db.collection("transfer_vehicle_categories");
  for (const row of DEFAULTS) {
    await col.updateOne(
      { code: row.code },
      { $set: { ...row, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`Seeded ${DEFAULTS.length} transfer vehicle categories`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
