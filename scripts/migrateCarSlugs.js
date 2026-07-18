/**
 * One-time migration: add/update slug for all cars based on model + transmission.
 * Needed so car pages (/[locale]/cars/[slug]) and links from the homepage grid work.
 *
 * Slug format: lowercase, latin, hyphens (e.g. toyota-yaris-automatic, fiat-500-cabrio).
 * - Idempotent: without --force only cars without slug are updated.
 * - Uniqueness: on collision appends "-2", "-3", etc.
 * - Safe to run multiple times.
 *
 * Usage:
 *   npm run migrate:car-slugs
 *   MONGODB_URI="mongodb://..." npm run migrate:car-slugs
 *   npm run migrate:car-slugs -- --force   # overwrite all existing slugs
 */

const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");
const { generateSlugBase } = require("../utils/slugCar.js");

// Load .env / .env.local so MONGODB_URI is set when running: npm run migrate:car-slugs
loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/natalicar";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const FORCE_OVERWRITE = process.argv.includes("--force");

async function migrateCarSlugs() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB_NAME);
    const carsCollection = db.collection("cars");
    console.log(`Using database: "${MONGODB_DB_NAME}", collection: cars`);

    const allCars = await carsCollection.find({}).toArray();
    console.log(`Total cars in DB: ${allCars.length}`);

    const carsToUpdate = FORCE_OVERWRITE
      ? allCars
      : allCars.filter((c) => !c.slug || !String(c.slug).trim());

    console.log(`Cars to update: ${carsToUpdate.length}${FORCE_OVERWRITE ? " (--force: overwriting all)" : ""}`);

    if (carsToUpdate.length === 0) {
      console.log("All cars already have slug. Migration not needed.");
      return;
    }

    // Build set of slugs that should NOT be overwritten (only for non-force mode)
    const reservedSlugs = new Set();
    if (!FORCE_OVERWRITE) {
      allCars.forEach((c) => {
        if (c.slug && String(c.slug).trim()) {
          reservedSlugs.add(String(c.slug).trim().toLowerCase());
        }
      });
    }

    const assignedSlugs = new Set(reservedSlugs);
    const collisions = [];
    let updated = 0;

    for (const car of carsToUpdate) {
      const base = generateSlugBase(car);
      let slug = base;
      let n = 1;
      while (assignedSlugs.has(slug)) {
        n += 1;
        slug = `${base}-${n}`;
        if (n === 2) {
          collisions.push({ carId: car._id.toString(), model: car.model, base, finalSlug: slug });
        }
      }
      if (n > 2) {
        const collision = collisions.find((c) => c.carId === car._id.toString());
        if (collision) collision.finalSlug = slug;
      }
      assignedSlugs.add(slug);

      if (typeof slug !== "string" || !slug.trim()) continue;

      const result = await carsCollection.updateOne(
        { _id: car._id },
        { $set: { slug: slug.trim() } }
      );
      if (result.modifiedCount) updated += 1;

      console.log(`  ${car.model || car._id} -> ${slug}`);
    }

    if (collisions.length) {
      console.log(`\nCollisions (slug suffix added): ${collisions.length}`);
      collisions.forEach((c) => console.log(`   ${c.base} -> ${c.finalSlug} (${c.model})`));
    }
    console.log(`\nUpdated ${updated} cars with slug.`);
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

if (require.main === module) {
  migrateCarSlugs()
    .then(() => {
      console.log("Migration completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

module.exports = { migrateCarSlugs };
