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
import mongoose from "mongoose";

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
const TARGET_COMPANY_ID = "6aaedf3e4cad862dc29d7b1a";

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

  const docs = (profile.documents || []).filter((d) => d?.storageRef);
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
    wouldChange: null,
  };

  if (profile.verificationStatus !== "DRAFT") {
    plan.wouldChange = "none (not DRAFT)";
    console.log(JSON.stringify(plan, null, 2));
    await mongoose.disconnect();
    return;
  }
  if (docs.length === 0) {
    plan.wouldChange = "none (no uploaded documents)";
    console.log(JSON.stringify(plan, null, 2));
    await mongoose.disconnect();
    return;
  }

  const now = new Date();
  const nextLegalName =
    String(profile.legalName || "").trim() || String(company.name || "").trim();

  plan.wouldChange = {
    verificationStatus: "DRAFT → PENDING_VERIFICATION",
    verificationStatusAt: now.toISOString(),
    submittedAt: (profile.submittedAt || now).toISOString?.() || now.toISOString(),
    legalName: profile.legalName
      ? "(unchanged)"
      : `(empty → company name placeholder)`,
    statusHistoryAppend: {
      from: "DRAFT",
      to: "PENDING_VERIFICATION",
      reason: "Repair: evidence uploaded; submit gate previously blocked",
    },
  };

  console.log(JSON.stringify(plan, null, 2));

  if (!APPLY) {
    console.log("DRY_RUN only. Pass --apply to mutate this single record.");
    await mongoose.disconnect();
    return;
  }

  await db.collection("partner_legal_profiles").updateOne(
    { _id: profile._id, verificationStatus: "DRAFT" },
    {
      $set: {
        verificationStatus: "PENDING_VERIFICATION",
        verificationStatusAt: now,
        submittedAt: profile.submittedAt || now,
        legalName: nextLegalName,
      },
      $push: {
        statusHistory: {
          from: "DRAFT",
          to: "PENDING_VERIFICATION",
          at: now,
          byEmail: "repair-script",
          reason:
            "Repair: evidence uploaded; submit gate previously blocked without legalName",
        },
      },
    }
  );

  console.log("APPLIED one-record repair.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
