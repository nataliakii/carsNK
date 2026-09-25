#!/usr/bin/env node
/**
 * Dry-run classifier for order.source.
 *
 * Does not write unless both --apply and ALLOW_BOOKING_SOURCE_BACKFILL=1
 * are set. This task must stay a dry-run.
 *
 * Rules match classifyBookingSourceRecord in
 * domain/admin/rovaroContractorAdmin.js:
 *   my_order true  → PLATFORM (public site)
 *   my_order false → INTERNAL (company calendar)
 *   missing / conflicting signals → ambiguous, not backfilled
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");
if (APPLY) {
  console.error("This script is dry-run only. It does not update orders.");
  process.exit(1);
}

function classify(order) {
  const raw = String(order?.source || "").trim();
  const explicit = raw === "PLATFORM" || raw === "INTERNAL" ? raw : null;
  const my = order?.my_order;
  const myKnown = my === true || my === false;
  const reasons = [];
  const paid = String(order?.payment?.status || "").toLowerCase() === "paid";
  const marketplacePaid =
    paid ||
    (order?.bookingStatus === "BOOKING_CONFIRMED" &&
      order?.bookingMode === "MARKETPLACE_REQUEST");

  if (order?.source != null && String(order.source).trim() !== "" && !explicit) {
    reasons.push("invalid_source");
  }
  if (explicit === "PLATFORM" && my === false) reasons.push("source_conflicts_my_order");
  if (explicit === "INTERNAL" && my === true) reasons.push("source_conflicts_my_order");
  if (!explicit && !myKnown) reasons.push("missing_my_order");
  if (my === true && order?.offline === true && explicit !== "INTERNAL") {
    reasons.push("platform_flag_with_offline");
  }
  if (
    (my === false || explicit === "INTERNAL") &&
    explicit !== "PLATFORM" &&
    marketplacePaid
  ) {
    reasons.push("internal_flag_with_marketplace_payment");
  }

  if (reasons.length) return { source: null, ambiguous: true, reasons };
  if (explicit) return { source: explicit, ambiguous: false, reasons: [] };
  if (my === true) return { source: "PLATFORM", ambiguous: false, reasons: [] };
  return { source: "INTERNAL", ambiguous: false, reasons: [] };
}

async function main() {
  if (APPLY && process.env.ALLOW_BOOKING_SOURCE_BACKFILL !== "1") {
    console.error(
      "Refusing to write. Omit --apply. Writes also need ALLOW_BOOKING_SOURCE_BACKFILL=1."
    );
    process.exit(1);
  }

  const uri = String(process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          wrote: false,
          error: "MONGODB_URI is not set. No database was contacted.",
          platform: null,
          internal: null,
          ambiguous: null,
        },
        null,
        2
      )
    );
    return;
  }

  const dbName = String(process.env.MONGODB_DB_NAME || "Car").trim() || "Car";
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const orders = await client
      .db(dbName)
      .collection("orders")
      .find(
        {},
        {
          projection: {
            my_order: 1,
            source: 1,
            offline: 1,
            bookingMode: 1,
            bookingStatus: 1,
            "payment.status": 1,
          },
        }
      )
      .toArray();

    const counts = {
      total: orders.length,
      platform: 0,
      internal: 0,
      ambiguous: 0,
      alreadyExplicit: 0,
    };
    const ambiguousByReason = {};
    const ambiguousIds = [];

    for (const order of orders) {
      if (order.source === "PLATFORM" || order.source === "INTERNAL") {
        counts.alreadyExplicit += 1;
      }
      const result = classify(order);
      if (result.ambiguous) {
        counts.ambiguous += 1;
        for (const reason of result.reasons) {
          ambiguousByReason[reason] = (ambiguousByReason[reason] || 0) + 1;
        }
        if (ambiguousIds.length < 30) {
          ambiguousIds.push({ id: String(order._id), reasons: result.reasons });
        }
        continue;
      }
      if (result.source === "PLATFORM") counts.platform += 1;
      else counts.internal += 1;
    }

    console.log(
      JSON.stringify(
        {
          dryRun: true,
          wrote: false,
          database: dbName,
          counts,
          ambiguousByReason,
          ambiguousSampleIds: ambiguousIds,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
