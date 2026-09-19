/**
 * Seed platform cities + assign them to companies that have no cityIds yet.
 * Also fills company slug / country for storefronts.
 *
 * Usage:
 *   npm run seed:platform
 *   NEXT_PUBLIC_SITE_COUNTRY=ES npm run seed:platform
 */

const { MongoClient, ObjectId } = require("mongodb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";

const COUNTRY = String(
  process.env.NEXT_PUBLIC_SITE_COUNTRY || process.env.SITE_COUNTRY || "GR"
)
  .trim()
  .toUpperCase();

const GREECE_CITIES = [
  { name: "Airport", kind: "airport", sort: 10, searchText: "skg makedonia thessaloniki airport" },
  {
    name: "Thessaloniki",
    kind: "city",
    sort: 20,
    requiresAddressDetail: true,
    searchText: "saloniki city center",
  },
  { name: "Nea Kallikratia", kind: "city", sort: 30, searchText: "kallikratia" },
  { name: "Afitos", kind: "city", sort: 40 },
  { name: "Agios Nikolaos", kind: "city", sort: 50 },
  { name: "Fourka", kind: "city", sort: 60 },
  { name: "Hanioti", kind: "city", sort: 70, searchText: "chanioti" },
  { name: "Kallithea", kind: "city", sort: 80 },
  { name: "Kassandra", kind: "region", sort: 90 },
  { name: "Kassandria", kind: "city", sort: 100 },
  { name: "Kriopigi", kind: "city", sort: 110 },
  { name: "Metamorfosi", kind: "city", sort: 120 },
  { name: "Nea Moudania", kind: "city", sort: 130 },
  { name: "Neos Marmaras", kind: "city", sort: 140 },
  { name: "Nikiti", kind: "city", sort: 150 },
  { name: "Olympiada", kind: "city", sort: 160 },
  { name: "Ormilia", kind: "city", sort: 170 },
  { name: "Pefkohori", kind: "city", sort: 180 },
  { name: "Petralona", kind: "city", sort: 190 },
  { name: "Polichrono", kind: "city", sort: 200 },
  { name: "Sani", kind: "city", sort: 210 },
  { name: "Sarti", kind: "city", sort: 220 },
  { name: "Sithonia", kind: "region", sort: 230 },
  { name: "Vrasna", kind: "city", sort: 240 },
];

const SPAIN_CITIES = [
  { name: "Madrid", kind: "city", sort: 10, requiresAddressDetail: true, searchText: "mad aeropuerto barajas" },
  { name: "Barcelona", kind: "city", sort: 20, requiresAddressDetail: true, searchText: "bcn el prat" },
  { name: "Malaga Airport", kind: "airport", sort: 30, searchText: "agp costa del sol malaga" },
  { name: "Malaga", kind: "city", sort: 40 },
  { name: "Alicante", kind: "city", sort: 50, searchText: "alc" },
  { name: "Valencia", kind: "city", sort: 60, searchText: "vlc" },
  { name: "Palma", kind: "city", sort: 70, searchText: "pmi mallorca" },
  { name: "Sevilla", kind: "city", sort: 80, searchText: "svq seville" },
  { name: "Airport", kind: "airport", sort: 5, searchText: "aeropuerto airport" },
];

const DEFAULT_LOCALES = {
  GR: ["en", "el", "ru", "uk", "de", "bg", "ro", "sr", "pl"],
  ES: ["en", "es", "de", "ru"],
};

function slugify(name) {
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "city";
}

async function upsertCities(collection, country, cities) {
  const ids = [];
  for (const city of cities) {
    const slug = slugify(city.name);
    const doc = {
      name: city.name,
      slug,
      country,
      kind: city.kind || "city",
      isActive: true,
      requiresAddressDetail: Boolean(city.requiresAddressDetail),
      searchText: city.searchText || "",
      sort: city.sort ?? 100,
      updatedAt: new Date(),
    };
    const result = await collection.findOneAndUpdate(
      { country, slug },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: "after" }
    );
    const saved = result?.value || (await collection.findOne({ country, slug }));
    if (saved?._id) ids.push(saved._id);
  }
  return ids;
}

async function uniqueSlug(companies, desired, excludeId) {
  const root = slugify(desired);
  let candidate = root;
  let n = 2;
  while (n < 100) {
    const existing = await companies.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
  return `${root}-${Date.now()}`;
}

async function seed() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is required");

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    const citiesCol = db.collection("platform_cities");
    const settingsCol = db.collection("platform_settings");
    const companies = db.collection("companies");

    const country = COUNTRY === "ES" ? "ES" : "GR";
    const catalog = country === "ES" ? SPAIN_CITIES : GREECE_CITIES;
    const cityIds = await upsertCities(citiesCol, country, catalog);
    console.log(`Upserted ${cityIds.length} ${country} cities`);

    const locales = DEFAULT_LOCALES[country] || DEFAULT_LOCALES.GR;
    await settingsCol.updateOne(
      { key: "platform" },
      {
        $set: { enabledLocales: locales, updatedAt: new Date() },
        $setOnInsert: { key: "platform", createdAt: new Date() },
      },
      { upsert: true }
    );
    console.log(`Platform locales: ${locales.join(", ")}`);

    const allCompanies = await companies.find({}).toArray();
    for (const company of allCompanies) {
      const updates = {};
      if (!company.slug) {
        updates.slug = await uniqueSlug(companies, company.name, company._id);
      }
      if (!company.country) updates.country = country;
      if (!Array.isArray(company.cityIds) || company.cityIds.length === 0) {
        const embedded = (company.locations || [])
          .map((loc) => String(loc?.name || "").trim().toLowerCase())
          .filter(Boolean);
        if (embedded.length) {
          const matched = await citiesCol
            .find({
              country,
              isActive: { $ne: false },
              $or: embedded.map((name) => ({
                name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
              })),
            })
            .project({ _id: 1 })
            .toArray();
          updates.cityIds = matched.length ? matched.map((c) => c._id) : cityIds;
        } else {
          updates.cityIds = cityIds;
        }
      }
      if (company.storefrontEnabled == null) updates.storefrontEnabled = true;
      if (company.listedOnMarketplace == null) updates.listedOnMarketplace = true;
      if (Object.keys(updates).length) {
        await companies.updateOne({ _id: company._id }, { $set: updates });
        console.log(`Updated company ${company.name}: ${Object.keys(updates).join(", ")}`);
      }
    }
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
