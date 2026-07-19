/**
 * Multi-tenant seed:
 * 1) Ensure CarsNK company exists
 * 2) Backfill car.ownerId / order.ownerId → COMPANY_ID where missing
 * 3) Upsert bootstrap ADMIN + SUPERADMIN users from AUTH_* env
 *
 * Usage:
 *   npm run seed:owners
 */

const { MongoClient, ObjectId } = require("mongodb");
const { hashSync } = require("bcrypt");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const COMPANY_ID = "679903bd10e6c8a8c0f027bc";

const ROLE = { ADMIN: 1, SUPERADMIN: 2 };

function trim(name) {
  return String(process.env[name] || "").trim();
}

async function seedOwners() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is required");

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    const ownerObjectId = new ObjectId(COMPANY_ID);

    const companies = db.collection("companies");
    const existingCompany = await companies.findOne({ _id: ownerObjectId });
    if (!existingCompany) {
      throw new Error(
        `Company ${COMPANY_ID} missing — run npm run seed:carsnk-company first`
      );
    }
    console.log(`Company OK: ${existingCompany.name}`);

    const cars = db.collection("cars");
    const carResult = await cars.updateMany(
      { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] },
      { $set: { ownerId: ownerObjectId } }
    );
    console.log(`Cars backfilled ownerId: ${carResult.modifiedCount}`);

    const orders = db.collection("orders");
    const orderResult = await orders.updateMany(
      { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] },
      { $set: { ownerId: ownerObjectId } }
    );
    console.log(`Orders backfilled ownerId: ${orderResult.modifiedCount}`);

    const users = db.collection("users");
    const pairs = [
      {
        email: trim("AUTH_SUPERADMIN_EMAIL") || "admin@bbqr.site",
        password: trim("AUTH_SUPERADMIN_PASSWORD") || "password",
        username: "superadmin",
        role: ROLE.SUPERADMIN,
        ownerId: null,
      },
      {
        email: trim("AUTH_ADMIN_EMAIL") || "cars@bbqr.site",
        password: trim("AUTH_ADMIN_PASSWORD") || "11111111",
        username: "admin",
        role: ROLE.ADMIN,
        ownerId: ownerObjectId,
      },
    ];

    for (const u of pairs) {
      if (!u.email || !u.password) continue;
      const hashed = hashSync(u.password, 10);
      const result = await users.updateOne(
        { email: u.email.toLowerCase() },
        {
          $set: {
            email: u.email.toLowerCase(),
            username: u.username,
            password: hashed,
            isAdmin: true,
            role: u.role,
            ownerId: u.ownerId,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      console.log(
        `User ${u.email} (${u.role === ROLE.SUPERADMIN ? "SUPERADMIN" : "ADMIN"}): upserted=${Boolean(result.upsertedId)} modified=${result.modifiedCount}`
      );
    }
  } finally {
    await client.close();
  }
}

seedOwners()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
