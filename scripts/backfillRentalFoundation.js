#!/usr/bin/env node
/**
 * Dry-run-first backfill for rental foundation snapshots.
 *
 * Default: report only. Pass --write to persist (do not use in this phase
 * against production).
 *
 * Usage:
 *   node scripts/backfillRentalFoundation.js
 *   node scripts/backfillRentalFoundation.js --write
 */

const DRY_RUN = !process.argv.includes("--write");

async function main() {
  const { connectToDB } = await import("../lib/database.js");
  const { Order } = await import("../models/order.js");
  const Company = (await import("../models/company.js")).default;
  const { resolveRentalBookingContext } = await import(
    "../domain/booking/resolveRentalContext.js"
  );
  const { localSnapshotFromUtc } = await import(
    "../domain/time/businessInstant.js"
  );

  await connectToDB();

  const missing = await Order.find({
    $or: [
      { timezone: { $in: [null, ""] } },
      { timezone: { $exists: false } },
    ],
  })
    .select("_id orderNumber ownerId timeIn timeOut timezone bookingMode")
    .lean()
    .limit(5000);

  console.log(
    `[backfillRentalFoundation] ${DRY_RUN ? "DRY RUN" : "WRITE"} — ${missing.length} orders without timezone (cap 5000)`
  );

  let updated = 0;
  for (const row of missing) {
    const company = row.ownerId ? await Company.findById(row.ownerId).lean() : null;
    const ctx = resolveRentalBookingContext({
      order: row,
      company,
      forNewOrder: false,
    });
    const patch = {
      timezone: ctx.timezone,
      currency: ctx.currency || "EUR",
      countryCode: ctx.countryCode || "",
    };
    if (row.timeIn && row.timeOut) {
      patch.pickupAtUtc = row.timeIn;
      patch.returnAtUtc = row.timeOut;
      patch.localPickup = localSnapshotFromUtc(row.timeIn, ctx.timezone);
      patch.localReturn = localSnapshotFromUtc(row.timeOut, ctx.timezone);
    }
    if (DRY_RUN) {
      if (updated < 5) {
        console.log(" sample", String(row._id), patch.timezone);
      }
    } else {
      await Order.updateOne({ _id: row._id }, { $set: patch });
    }
    updated += 1;
  }

  console.log(
    `[backfillRentalFoundation] ${DRY_RUN ? "would update" : "updated"} ${updated} orders`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
