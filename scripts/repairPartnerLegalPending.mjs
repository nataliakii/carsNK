/**
 * Dry-run / apply one-record repair: Spain partner with uploaded docs stuck in DRAFT.
 *
 * Usage:
 *   node --experimental-vm-modules scripts/repairPartnerLegalPending.mjs
 *   node --experimental-vm-modules scripts/repairPartnerLegalPending.mjs --apply
 *
 * Does NOT run automatically. Default is dry-run.
 */

import { readFileSync } from "fs";
import { createRequire } from "node:module";
import mongoose from "mongoose";

const require = createRequire(import.meta.url);
const { planOneRecordPendingRepair, REPAIR_TARGET_COMPANY_ID } = require(
  "../domain/legal/repairPartnerLegalPending.js"
);

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  let val = m[2].trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = val;
}

const APPLY = process.argv.includes("--apply");
/** Known Spain partner that uploaded KYB evidence but never reached PENDING. */
const TARGET_COMPANY_ID = REPAIR_TARGET_COMPANY_ID;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "Car",
    serverSelectionTimeoutMS: 20000,
  });
  const db = mongoose.connection.db;

  const company = await db.collection("companies").findOne({
    _id: new mongoose.Types.ObjectId(TARGET_COMPANY_ID),
  });
  const profile = await db.collection("partner_legal_profiles").findOne({
    companyId: new mongoose.Types.ObjectId(TARGET_COMPANY_ID),
  });

  if (!company || !profile) {
    console.log("ABORT: company or profile not found");
    process.exit(1);
  }

  const decision = planOneRecordPendingRepair({ company, profile });
  const docs = decision.documents;
  const plan = {
    companyId: TARGET_COMPANY_ID,
    companyName: company.name,
    country: company.country,
    listedOnMarketplace: company.listedOnMarketplace,
    bookingMode: company.bookingMode,
    profileId: String(profile._id),
    currentStatus: profile.verificationStatus,
    docCount: docs.length,
    docKinds: docs.map((d) => d.kind),
    wouldChange: decision.apply
      ? {
          verificationStatus: "DRAFT → PENDING_VERIFICATION",
          verificationStatusAt: decision.set.verificationStatusAt.toISOString(),
          submittedAt: new Date(decision.set.submittedAt).toISOString(),
          legalName: profile.legalName
            ? "(unchanged)"
            : "(empty → company name placeholder)",
          statusHistoryAppend: {
            from: decision.pushHistory.from,
            to: decision.pushHistory.to,
            reason: "Repair: evidence uploaded; submit gate previously blocked",
          },
        }
      : `none (${decision.code})`,
  };

  console.log(JSON.stringify(plan, null, 2));

  if (!decision.apply) {
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log("DRY_RUN only. Pass --apply to mutate this single record.");
    await mongoose.disconnect();
    return;
  }

  await db.collection("partner_legal_profiles").updateOne(
    { _id: profile._id, verificationStatus: "DRAFT" },
    {
      $set: decision.set,
      $push: { statusHistory: decision.pushHistory },
    }
  );

  console.log("APPLIED one-record repair.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
