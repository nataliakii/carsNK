#!/usr/bin/env node
/**
 * Dry-run: marketplace booking-fee hierarchy migration report.
 *
 * Does NOT mutate production. Prefer nullable company override semantics:
 *   company.marketplaceBookingFeeBps = null → inherit platform default (10%).
 *
 * Usage:
 *   node --env-file=.env scripts/dryRunMarketplaceBookingFee.mjs
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

const DEFAULT_BPS = 1000;

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: "Car" });
  const db = mongoose.connection.db;

  const platform = await db.collection("platform_settings").findOne({ key: "platform" });
  const platformBps =
    platform?.marketplaceBookingFeeBps == null
      ? DEFAULT_BPS
      : platform.marketplaceBookingFeeBps;

  const companies = await db
    .collection("companies")
    .find({})
    .project({
      name: 1,
      country: 1,
      marketplaceBookingFeeBps: 1,
      prepaymentPercent: 1,
      rentalPayments: 1,
    })
    .toArray();

  const spain = companies.filter(
    (c) => String(c.country || "").toUpperCase() === "ES"
  );
  const greece = companies.filter(
    (c) => String(c.country || "").toUpperCase() === "GR"
  );
  const withOverride = spain.filter(
    (c) => c.marketplaceBookingFeeBps != null
  );
  const withoutOverride = spain.filter(
    (c) => c.marketplaceBookingFeeBps == null
  );

  const orderCollectionNames = ["orders", "Orders"];
  let ordersWithSnapshot = 0;
  let ordersAt10 = 0;
  let ordersOtherFee = 0;
  for (const colName of orderCollectionNames) {
    try {
      const exists = await db.listCollections({ name: colName }).hasNext();
      if (!exists) continue;
      ordersWithSnapshot += await db.collection(colName).countDocuments({
        "authoritativePrice.marketplaceBookingFeeBps": { $exists: true, $ne: null },
      });
      ordersAt10 += await db.collection(colName).countDocuments({
        "authoritativePrice.marketplaceBookingFeeBps": 1000,
      });
      ordersOtherFee += await db.collection(colName).countDocuments({
        "authoritativePrice.marketplaceBookingFeeBps": {
          $exists: true,
          $nin: [null, 1000],
        },
      });
    } catch {
      /* ignore missing */
    }
  }
  console.log("=== Marketplace booking-fee dry-run (no writes) ===");
  console.log(`Platform default bps: ${platformBps} (${platformBps / 100}%)`);
  console.log(`Spain partners: ${spain.length}`);
  console.log(`  — using platform default (null override): ${withoutOverride.length}`);
  console.log(`  — custom override set: ${withOverride.length}`);
  if (withOverride.length) {
    for (const c of withOverride.slice(0, 20)) {
      console.log(
        `     ${c.name || c._id}: ${c.marketplaceBookingFeeBps} bps (${c.marketplaceBookingFeeBps / 100}%)`
      );
    }
  }
  console.log(`Greece partners (must keep rentalPayments / prepayment): ${greece.length}`);
  console.log(`Orders with snapshotted fee bps: ${ordersWithSnapshot}`);
  console.log(`  — at 10% (1000 bps): ${ordersAt10}`);
  console.log(`  — other snapshotted %: ${ordersOtherFee}`);
  console.log("");
  console.log("Recommended action: NONE — leave company.marketplaceBookingFeeBps null.");
  console.log("Existing order snapshots stay unchanged.");
  console.log("Do not write 10% onto every company.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
