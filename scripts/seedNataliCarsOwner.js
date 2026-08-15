/**
 * Create partner company "Natali Cars", ADMIN login, and assign ALL cars + orders to it.
 *
 * Usage:
 *   npm run seed:natali-cars
 *
 * Optional env:
 *   NATALI_CARS_ADMIN_EMAIL     (default: natali2015makarova@gmail.com)
 *   NATALI_CARS_ADMIN_PASSWORD  (default: natali-cars-2026)
 *   NATALI_CARS_ADMIN_USERNAME  (default: natali-cars)
 */

const { MongoClient, ObjectId } = require("mongodb");
const { hashSync } = require("bcrypt");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const ROLE = { ADMIN: 1, SUPERADMIN: 2 };

const COMPANY_NAME = "Natali Cars";
const DEFAULT_EMAIL =
  process.env.NATALI_CARS_ADMIN_EMAIL || "natali2015makarova@gmail.com";
const DEFAULT_PASSWORD =
  process.env.NATALI_CARS_ADMIN_PASSWORD || "natali-cars-2026";
const DEFAULT_USERNAME =
  process.env.NATALI_CARS_ADMIN_USERNAME || "natali-cars";

const PARTNER_DEFAULTS = {
  tel: "+30 698 000 0000",
  email: "info@natali-cars.com",
  address: "Antonioy Kelesi 12, Nea Kallikratia 630 80, Greece",
  coords: { lat: "40.31", lon: "23.06" },
  hoursDiffForStart: 1,
  hoursDiffForEnd: -1,
  bufferTime: 2,
  defaultStart: "14:00",
  defaultEnd: "12:00",
  seasons: {
    NoSeason: { start: "01/10", end: "24/05" },
    LowSeason: { start: "25/05", end: "30/06" },
    LowUpSeason: { start: "01/09", end: "30/09" },
    MiddleSeason: { start: "01/07", end: "31/07" },
    HighSeason: { start: "01/08", end: "31/08" },
  },
  useSeasons: true,
  langAdmin: "en",
  langSuperadmin: "en",
  useEmail: true,
  minRentalDuration: 1,
  workingHours: { start: "08:00", end: "22:00" },
  deliveryPricePerKm: 1,
};

async function main() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is required");

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    const companies = db.collection("companies");
    const users = db.collection("users");
    const cars = db.collection("cars");
    const orders = db.collection("orders");

    let company = await companies.findOne({
      name: { $regex: /^natali\s*cars$/i },
    });

    if (!company) {
      const insert = await companies.insertOne({
        ...PARTNER_DEFAULTS,
        name: COMPANY_NAME,
        email: PARTNER_DEFAULTS.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      company = await companies.findOne({ _id: insert.insertedId });
      console.log(`Created company: ${COMPANY_NAME} (${company._id})`);
    } else {
      console.log(`Company exists: ${company.name} (${company._id})`);
    }

    const ownerId = company._id;
    const email = String(DEFAULT_EMAIL).trim().toLowerCase();
    const username = String(DEFAULT_USERNAME).trim();
    const password = String(DEFAULT_PASSWORD).trim();
    if (password.length < 6) {
      throw new Error("NATALI_CARS_ADMIN_PASSWORD must be at least 6 chars");
    }

    const hashed = hashSync(password, 10);
    await users.updateOne(
      { $or: [{ email }, { username }] },
      {
        $set: {
          username,
          email,
          password: hashed,
          isAdmin: true,
          role: ROLE.ADMIN,
          ownerId,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    console.log(`Admin user upserted: ${email} / ${username}`);

    const carResult = await cars.updateMany({}, { $set: { ownerId } });
    const orderResult = await orders.updateMany({}, { $set: { ownerId } });

    console.log(
      JSON.stringify(
        {
          companyId: String(ownerId),
          companyName: company.name,
          loginEmail: email,
          loginUsername: username,
          carsAssigned: carResult.modifiedCount,
          carsMatched: carResult.matchedCount,
          ordersAssigned: orderResult.modifiedCount,
          ordersMatched: orderResult.matchedCount,
          carCount: await cars.countDocuments({ ownerId }),
          orderCount: await orders.countDocuments({ ownerId }),
        },
        null,
        2
      )
    );
    console.log(
      "Login at /login with the natali-cars email + password (see env or defaults above)."
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
