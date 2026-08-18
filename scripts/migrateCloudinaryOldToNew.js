/**
 * Migrate Cloudinary assets from the "old" cloud into the "new" cloud used by this app.
 *
 * Motivation (based on Mongo schema in this repo):
 * - cars.photoUrl stores Cloudinary "public_id" (no URL, no cloud name).
 *   After switching env to a new cloud, images will only work if we copy assets
 *   into the new cloud with the same public_id.
 * - orders.drivingLicenceUrls stores full Cloudinary HTTPS URLs.
 *   After switching env, those URLs still point to the old cloud until we update Mongo.
 *
 * Usage:
 *   node --env-file=.env scripts/migrateCloudinaryOldToNew.js --dry-run
 *   node --env-file=.env scripts/migrateCloudinaryOldToNew.js
 *
 * Notes:
 * - Script assumes old assets are publicly accessible via stored URLs
 *   (for driving licences) and via URL template for car public_ids.
 * - For deleting old cloud assets you need credentials for the old cloud (not included).
 */

const { MongoClient } = require("mongodb");
const { v2: cloudinary } = require("cloudinary");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");

function firstTrimmed(...keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw == null) continue;
    const t = String(raw).trim();
    if (t) return t;
  }
  return "";
}

function ensureCloudinaryNewConfigured() {
  const cloudName = firstTrimmed(
    "CLOUDINARY_CLOUD_NAME",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"
  );
  const apiKey = firstTrimmed("CLOUDINARY_API_KEY", "NEXT_PUBLIC_CLOUDINARY_API_KEY");
  const apiSecret = firstTrimmed(
    "CLOUDINARY_API_SECRET",
    "NEXT_PUBLIC_CLOUDINARY_API_SECRET"
  );

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "New Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return { cloudName };
}

function cloudNameFromUrl(u) {
  if (typeof u !== "string") return null;
  const m = u.match(/res\.cloudinary\.com\/([^/]+)\//);
  return m?.[1] || null;
}

/**
 * Extract Cloudinary public_id (without extension) from secure URL.
 * Kept intentionally in this script (commonjs) to avoid ESM import issues.
 */
function cloudinaryPublicIdFromSecureUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (!trimmed.includes("cloudinary.com")) return null;

  let pathname;
  try {
    pathname = decodeURI(new URL(trimmed).pathname);
  } catch {
    return null;
  }

  const marker = "/upload/";
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const after = pathname.slice(idx + marker.length);
  const segments = after.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const versionIndex = segments.findIndex((s) => /^v\d+$/i.test(s));
  let pathSegments;
  if (versionIndex !== -1 && versionIndex < segments.length - 1) {
    pathSegments = segments.slice(versionIndex + 1);
  } else {
    // Skip any transformation segments that contain commas (rare but supported by app code).
    let i = 0;
    while (i < segments.length && segments[i].includes(",")) {
      i += 1;
    }
    pathSegments = segments.slice(i);
  }

  if (pathSegments.length === 0) return null;
  const joined = pathSegments.join("/");
  const withoutExt = joined.replace(/\.[a-z0-9]+$/i, "");
  return withoutExt || null;
}

async function withMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

async function detectDbName(client) {
  const adminDb = client.db("admin");
  const res = await adminDb.command({ listDatabases: 1 });
  const dbName = (res.databases || [])
    .map((d) => d.name)
    .find((n) => n !== "admin" && n !== "local" && n !== "config");
  if (!dbName) throw new Error("Could not detect target Mongo database name");
  return dbName;
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

async function main() {
  const { cloudName: newCloudName } = ensureCloudinaryNewConfigured();
  const mongo = await withMongo();

  try {
    const dbName = await detectDbName(mongo);
    const db = mongo.db(dbName);
    const carsCol = db.collection("cars");
    const ordersCol = db.collection("orders");

    // Determine old cloud name from stored driving licence URLs.
    const ordersWithLic = await ordersCol
      .find({ drivingLicenceUrls: { $exists: true, $ne: [] } })
      .project({ drivingLicenceUrls: 1 })
      .limit(2000)
      .toArray();

    const oldCloudNames = new Set();
    for (const d of ordersWithLic) {
      for (const u of d.drivingLicenceUrls || []) {
        const c = cloudNameFromUrl(u);
        if (c) oldCloudNames.add(c);
      }
    }

    const oldCloudNameArr = [...oldCloudNames];
    if (oldCloudNameArr.length === 0) {
      console.log("[migrate] No old cloud names found in drivingLicenceUrls. Nothing to migrate for orders.");
      return;
    }
    if (oldCloudNameArr.length !== 1) {
      console.log("[migrate] Multiple old cloud names found:", oldCloudNameArr);
      console.log("[migrate] Aborting for safety. Please consolidate mapping or run per-cloud migration.");
      return;
    }
    const oldCloudName = oldCloudNameArr[0];

    // Cars: photoUrl stores public_id.
    const carsCursor = carsCol
      .find({
        photoUrl: { $exists: true, $ne: null, $nin: ["", "carsnk/NO_PHOTO"] },
      })
      .project({ photoUrl: 1 });

    const carPublicIds = [];
    for await (const doc of carsCursor) {
      if (typeof doc.photoUrl === "string" && doc.photoUrl.trim()) {
        carPublicIds.push(doc.photoUrl.trim());
      }
    }
    const carIdsUnique = unique(carPublicIds);

    // Orders: drivingLicenceUrls are full URLs; extract public_id -> source URL.
    const publicIdToSourceUrl = new Map();
    let totalLicenceUrls = 0;
    for (const d of ordersWithLic) {
      for (const u of d.drivingLicenceUrls || []) {
        if (typeof u !== "string") continue;
        totalLicenceUrls += 1;
        const publicId = cloudinaryPublicIdFromSecureUrl(u);
        if (!publicId) continue;
        if (!publicIdToSourceUrl.has(publicId)) {
          publicIdToSourceUrl.set(publicId, u);
        }
      }
    }
    const licencePublicIds = [...publicIdToSourceUrl.keys()];

    console.log("[migrate] Detected clouds:", {
      oldCloudName,
      newCloudName,
      dbName,
    });
    console.log("[migrate] Cars public_id count:", carIdsUnique.length);
    console.log("[migrate] Licence URLs total:", totalLicenceUrls);
    console.log("[migrate] Licence unique public_id count:", licencePublicIds.length);

    if (DRY_RUN) {
      console.log("[migrate] DRY RUN: samples only.");
      console.log("[migrate] Car sample:", carIdsUnique.slice(0, 5));
      console.log("[migrate] Licence sample public_id:", licencePublicIds.slice(0, 5));
      const sample = licencePublicIds[0];
      console.log("[migrate] Licence sample source URL:", publicIdToSourceUrl.get(sample) || null);
      return;
    }

    // 1) Copy car photos.
    // We build a source URL using old cloud name and the stored public_id.
    const carCopyFailures = [];
    let carCopied = 0;

    for (let i = 0; i < carIdsUnique.length; i += 1) {
      const publicId = carIdsUnique[i];
      const sourceUrl = `https://res.cloudinary.com/${oldCloudName}/image/upload/${publicId}`;
      try {
        console.log(`[migrate] Copy car ${i + 1}/${carIdsUnique.length}: ${publicId}`);
        await cloudinary.uploader.upload(sourceUrl, {
          public_id: publicId,
          overwrite: true,
          invalidate: true,
          resource_type: "image",
        });
        carCopied += 1;
      } catch (err) {
        carCopyFailures.push({ publicId, message: err?.message || String(err) });
        console.warn(`[migrate] Car copy failed: ${publicId}`, err?.message || err);
      }
    }

    console.log("[migrate] Car migration done:", { carCopied, carFailures: carCopyFailures.length });

    // 2) Copy driving licences and remember new URLs.
    const licenceUrlByPublicId = {};
    const licenceFailures = [];

    for (let i = 0; i < licencePublicIds.length; i += 1) {
      const publicId = licencePublicIds[i];
      const sourceUrl = publicIdToSourceUrl.get(publicId);
      try {
        console.log(`[migrate] Copy licence ${i + 1}/${licencePublicIds.length}: ${publicId}`);
        const res = await cloudinary.uploader.upload(sourceUrl, {
          public_id: publicId,
          overwrite: true,
          invalidate: true,
          resource_type: "image",
        });
        licenceUrlByPublicId[publicId] = res?.secure_url;
      } catch (err) {
        licenceFailures.push({ publicId, message: err?.message || String(err) });
        console.warn(`[migrate] Licence copy failed: ${publicId}`, err?.message || err);
      }
    }

    console.log("[migrate] Licence migration done:", {
      mapped: Object.keys(licenceUrlByPublicId).length,
      failures: licenceFailures.length,
    });

    // 3) Update Mongo orders: replace each drivingLicenceUrls entry with new URL for its public_id.
    const ordersCursor = ordersCol.find(
      { drivingLicenceUrls: { $exists: true, $ne: [] } },
      { projection: { drivingLicenceUrls: 1 } }
    );

    const bulkOps = [];
    let docsVisited = 0;
    for await (const order of ordersCursor) {
      docsVisited += 1;
      const nextUrls = (order.drivingLicenceUrls || []).map((u) => {
        if (typeof u !== "string") return u;
        const id = cloudinaryPublicIdFromSecureUrl(u);
        if (!id) return u;
        return licenceUrlByPublicId[id] || u;
      });

      bulkOps.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { drivingLicenceUrls: nextUrls } },
        },
      });
    }

    console.log(`[migrate] Updating Mongo orders: ops=${bulkOps.length}, visited=${docsVisited}`);
    if (bulkOps.length > 0) {
      await ordersCol.bulkWrite(bulkOps, { ordered: false });
    }

    console.log("[migrate] Mongo update done.");
    console.log("[migrate] Next step: you can delete old Cloudinary assets manually (requires old cloud credentials).");
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error("[migrate] Fatal:", err?.message || err);
  process.exit(1);
});

