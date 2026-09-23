#!/usr/bin/env node
/**
 * Idempotent compatibility migration for company offices.
 *
 * Default: dry-run. Writes only with --apply.
 * Never rewrites historical order snapshots.
 * Never calls syncIndexes().
 *
 *   node scripts/migrateCompanyOffices.js
 *   node scripts/migrateCompanyOffices.js --apply
 */

const { MongoClient, ObjectId } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");

function getUri() {
  const uri = String(process.env.MONGODB_URI || "").trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  return uri;
}

function getDbName() {
  return String(process.env.MONGODB_DB_NAME || "Car").trim() || "Car";
}

function asOffice(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return {
      _id: new ObjectId(),
      name,
      publicName: name,
      address: "",
      city: "",
      country: "",
      placeId: "",
      lat: "",
      lon: "",
      locationType: "office",
      collectionInstructions: "",
      returnInstructions: "",
      openingHours: { start: "", end: "" },
      showPhone: false,
      status: "active",
      freePickup: true,
      freeReturn: true,
      carIds: [],
      archivedAt: null,
    };
  }
  if (typeof raw !== "object") return null;
  const name = String(raw.name || raw.publicName || "").trim();
  if (!name) return null;
  const existingId =
    raw._id && ObjectId.isValid(String(raw._id)) ? new ObjectId(String(raw._id)) : new ObjectId();
  return {
    ...raw,
    _id: existingId,
    name,
    publicName: String(raw.publicName || name).trim(),
    address: String(raw.address || "").trim(),
    city: String(raw.city || "").trim(),
    country: String(raw.country || "").trim().toUpperCase(),
    status: raw.status === "archived" || raw.status === "inactive" ? "archived" : "active",
    locationType: raw.locationType || "office",
    freePickup: raw.freePickup !== false,
    freeReturn: raw.freeReturn !== false,
  };
}

function officesNeedMigration(offices) {
  if (!Array.isArray(offices)) return false;
  return offices.some((row) => {
    if (typeof row === "string") return true;
    if (!row || typeof row !== "object") return true;
    if (!row._id) return true;
    if (!row.publicName && row.name) return true;
    if (!row.status) return true;
    return false;
  });
}

async function migrate({ apply }) {
  const client = new MongoClient(getUri());
  await client.connect();
  const db = client.db(getDbName());
  const companies = db.collection("companies");
  const cars = db.collection("cars");

  const companyDocs = await companies.find({}, { projection: { offices: 1, name: 1 } }).toArray();
  const plan = [];
  for (const company of companyDocs) {
    if (!officesNeedMigration(company.offices)) continue;
    const next = (company.offices || []).map(asOffice).filter(Boolean);
    plan.push({
      companyId: String(company._id),
      name: company.name,
      from: (company.offices || []).length,
      to: next.length,
      next,
    });
  }

  const carDocs = await cars
    .find(
      {
        $or: [
          { officeScope: { $exists: false } },
          { officeIds: { $exists: false } },
        ],
      },
      { projection: { offices: 1, ownerId: 1, officeIds: 1, officeScope: 1 } }
    )
    .toArray();

  const carPlan = carDocs.map((car) => ({
    carId: String(car._id),
    officeScope: car.officeScope || "all",
    officeIds: Array.isArray(car.officeIds) ? car.officeIds : [],
  }));

  console.log(
    JSON.stringify(
      {
        dryRun: !apply,
        companiesToPatch: plan.length,
        carsToPatch: carPlan.length,
        note: "Order documents are not rewritten.",
      },
      null,
      2
    )
  );

  if (!apply) {
    await client.close();
    return { companies: plan.length, cars: carPlan.length, applied: false };
  }

  for (const row of plan) {
    await companies.updateOne(
      { _id: new ObjectId(row.companyId) },
      { $set: { offices: row.next } }
    );
  }
  for (const row of carPlan) {
    await cars.updateOne(
      { _id: new ObjectId(row.carId) },
      {
        $set: {
          officeScope: row.officeScope,
          officeIds: row.officeIds,
        },
      }
    );
  }

  await client.close();
  return { companies: plan.length, cars: carPlan.length, applied: true };
}

async function migrateCompanyOffices(options = {}) {
  return migrate({ apply: Boolean(options.apply) });
}

if (require.main === module) {
  migrateCompanyOffices({ apply: APPLY })
    .then((result) => {
      console.log(result.applied ? "Applied." : "Dry-run only. Pass --apply to write.");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { migrateCompanyOffices, asOffice, officesNeedMigration };
