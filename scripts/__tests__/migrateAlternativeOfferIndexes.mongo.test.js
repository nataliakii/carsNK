/**
 * @jest-environment node
 *
 * Disposable Mongo only. Never uses Atlas / production.
 */
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");
const {
  INDEXES,
  COLLECTION,
  applyIndexes,
  listIndexes,
} = require("../migrateAlternativeOfferIndexes");

const REMOTE = /mongodb\+srv|\.mongodb\.net|atlas/i;

function assertLocalUri(uri) {
  if (!uri || REMOTE.test(uri) || !/127\.0\.0\.1|localhost/.test(uri)) {
    throw new Error(`Refusing index migration test against a non-local URI: ${uri}`);
  }
}

describe("alternative offer index migration (memory Mongo)", () => {
  let mongod;
  let client;
  let collection;

  beforeAll(async () => {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongod = await MongoMemoryServer.create({
      instance: { launchTimeout: 120000 },
    });
    const uri = mongod.getUri();
    assertLocalUri(uri);
    client = new MongoClient(uri);
    await client.connect();
    collection = client.db("Car").collection(COLLECTION);
  }, 180_000);

  afterAll(async () => {
    if (client) await client.close();
    if (mongod) {
      await mongod.stop({ doCleanup: true, force: true });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }, 180_000);

  test("dry-run equivalent: planned unique partial index is missing before apply", async () => {
    const existing = await listIndexes(collection);
    expect(existing.some((idx) => idx.name === "orderId_1_status_offered_unique")).toBe(
      false
    );
    const planned = INDEXES.find((idx) => idx.name === "orderId_1_status_offered_unique");
    expect(planned.unique).toBe(true);
    expect(planned.partialFilterExpression).toEqual({ status: "OFFERED" });
  });

  test("apply creates the intended indexes and is idempotent", async () => {
    await collection.createIndex({ extraField: 1 }, { name: "unrelated_keep_me" });
    const first = await applyIndexes(collection, INDEXES);
    expect(first.map((row) => row.name)).toEqual(INDEXES.map((idx) => idx.name));
    const second = await applyIndexes(collection, INDEXES);
    expect(second.map((row) => row.name)).toEqual(INDEXES.map((idx) => idx.name));
    const resulting = await listIndexes(collection);
    const names = resulting.map((idx) => idx.name);
    expect(names).toContain("orderId_1_status_offered_unique");
    expect(names).toContain("unrelated_keep_me");
    const unique = resulting.find((idx) => idx.name === "orderId_1_status_offered_unique");
    expect(unique.unique).toBe(true);
    expect(unique.partialFilterExpression).toEqual({ status: "OFFERED" });
  });

  test("two concurrent OFFERED rows for one order cannot both be created", async () => {
    const orderId = new mongoose.Types.ObjectId();
    const doc = (offerId) => ({
      offerId,
      orderId,
      vehicle: { model: "Seat Leon" },
      priceMinor: 1000,
      originalPriceMinor: 1000,
      reasonForReplacement: "workshop",
      expiresAt: new Date(Date.now() + 86400_000),
      status: "OFFERED",
    });
    const results = await Promise.allSettled([
      collection.insertOne(doc("ALT-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")),
      collection.insertOne(doc("ALT-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")),
    ]);
    const ok = results.filter((row) => row.status === "fulfilled");
    const dup = results.filter(
      (row) => row.status === "rejected" && row.reason?.code === 11000
    );
    expect(ok).toHaveLength(1);
    expect(dup).toHaveLength(1);
  });

  test("historical statuses may coexist and a later OFFERED row is allowed", async () => {
    const orderId = new mongoose.Types.ObjectId();
    await collection.insertMany([
      {
        offerId: "ALT-DECLINED111111111111111111111111",
        orderId,
        vehicle: { model: "A" },
        priceMinor: 1,
        originalPriceMinor: 1,
        reasonForReplacement: "x",
        expiresAt: new Date(),
        status: "DECLINED",
      },
      {
        offerId: "ALT-EXPIRED222222222222222222222222",
        orderId,
        vehicle: { model: "B" },
        priceMinor: 1,
        originalPriceMinor: 1,
        reasonForReplacement: "x",
        expiresAt: new Date(),
        status: "EXPIRED",
      },
      {
        offerId: "ALT-WITHDRAWN3333333333333333333333",
        orderId,
        vehicle: { model: "C" },
        priceMinor: 1,
        originalPriceMinor: 1,
        reasonForReplacement: "x",
        expiresAt: new Date(),
        status: "WITHDRAWN",
      },
    ]);
    await collection.insertOne({
      offerId: "ALT-NEXT4444444444444444444444444444",
      orderId,
      vehicle: { model: "D" },
      priceMinor: 1,
      originalPriceMinor: 1,
      reasonForReplacement: "x",
      expiresAt: new Date(Date.now() + 86400_000),
      status: "OFFERED",
    });
    expect(await collection.countDocuments({ orderId })).toBe(4);
  });
});
