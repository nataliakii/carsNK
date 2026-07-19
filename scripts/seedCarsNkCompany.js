/**
 * Seed / upsert the CarsNK company document at COMPANY_ID.
 *
 * Usage:
 *   npm run seed:carsnk-company
 *   MONGODB_URI="mongodb+srv://..." npm run seed:carsnk-company
 */

const { MongoClient, ObjectId } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const COMPANY_ID = "679903bd10e6c8a8c0f027bc";

const seasons = {
  NoSeason: { start: "01/10", end: "24/05" },
  LowSeason: { start: "25/05", end: "30/06" },
  LowUpSeason: { start: "01/09", end: "30/09" },
  MiddleSeason: { start: "01/07", end: "31/07" },
  HighSeason: { start: "01/08", end: "31/08" },
};

const defaults = {
  name: "CarsNK",
  tel: "+380 68 100 3771",
  tel2: "+353 85 270 96 05",
  email: "admin@bbqr.site",
  address: "Antonioy Kelesi 12, Nea Kallikratia 630 80",
  slogan: "Car rental aggregator in Greece",
  coords: { lat: "40.311273589340836", lon: "23.06426516796098" },
  hoursDiffForStart: 1,
  hoursDiffForEnd: -1,
  bufferTime: 2,
  defaultStart: "14:00",
  defaultEnd: "12:00",
  seasons,
  useSeasons: true,
  langAdmin: "en",
  langSuperadmin: "en",
  useEmail: true,
  locations: [
    { name: "Nea Kallikratia", coords: { lat: "40.31", lon: "23.06" } },
    { name: "Thessaloniki Airport", coords: { lat: "40.52", lon: "22.97" } },
  ],
  notSendIP1: "",
  notSendIP2: "",
  notSendIP3: "",
  notSendIP4: "",
  minRentalDuration: 1,
  workingHours: { start: "08:00", end: "22:00" },
  deliveryPricePerKm: 1,
};

async function seedCarsNkCompany() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    const companies = db.collection("companies");
    const _id = new ObjectId(COMPANY_ID);

    const existing = await companies.findOne({ _id });
    if (existing) {
      console.log(`Company already exists: ${COMPANY_ID} (${existing.name})`);
      return;
    }

    await companies.insertOne({ _id, ...defaults });
    console.log(`Created CarsNK company: ${COMPANY_ID}`);
  } finally {
    await client.close();
  }
}

seedCarsNkCompany()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
