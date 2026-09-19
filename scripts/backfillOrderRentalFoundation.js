/**
 * Dry-run-first backfill for rental foundation snapshots.
 *
 * Does NOT write unless --apply is passed. Never run against production
 * without an explicit review of the dry-run report.
 *
 * Usage:
 *   node scripts/backfillOrderRentalFoundation.js
 *   node scripts/backfillOrderRentalFoundation.js --limit=100
 *   node scripts/backfillOrderRentalFoundation.js --apply
 */

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 500;

async function main() {
  console.log(
    JSON.stringify(
      {
        dryRun: !APPLY,
        limit: LIMIT,
        note:
          "Would set timezone=Europe/Athens, bookingMode=OPS_CALENDAR, currency=EUR on historical rental orders missing those snapshots. No writes in dry-run.",
        apply: APPLY,
      },
      null,
      2
    )
  );
  if (APPLY) {
    console.error(
      "Refusing to apply: connect this script to Mongo and review the dry-run first. No production writes in this phase."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
