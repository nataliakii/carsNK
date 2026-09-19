/**
 * Backfill DeliveryZone.ownerId → site COMPANY_ID for legacy rows.
 *
 * Usage: node scripts/backfillDeliveryZoneOwnerId.js
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const mongoose = require("mongoose");
const { COMPANY_ID } = require("../config/company");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const col = mongoose.connection.collection("deliveryzones");
  const result = await col.updateMany(
    {
      $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
    },
    { $set: { ownerId: new mongoose.Types.ObjectId(COMPANY_ID) } }
  );
  console.log(
    `Matched ${result.matchedCount}, modified ${result.modifiedCount} → ownerId=${COMPANY_ID}`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
