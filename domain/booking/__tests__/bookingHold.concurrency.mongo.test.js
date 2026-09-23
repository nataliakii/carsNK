/**
 * @jest-environment node
 *
 * Real Mongo-compatible indexes. Never uses production/staging Atlas.
 */
import mongoose from "mongoose";

const REMOTE = /mongodb\+srv|\.mongodb\.net|atlas/i;

function assertLocalUri(uri) {
  if (!uri || REMOTE.test(uri) || !/127\.0\.0\.1|localhost/.test(uri)) {
    throw new Error(
      `Refusing Mongo concurrency test against a non-local URI: ${uri}`
    );
  }
}

describe("booking hold concurrency (real indexes)", () => {
  let mongod;
  let BookingHold;
  let BookingCarLock;
  let acquireMarketplaceHold;
  let releaseMarketplaceHold;
  let HOLD_STATUS;

  beforeAll(async () => {
    let MongoMemoryServer;
    try {
      ({ MongoMemoryServer } = require("mongodb-memory-server"));
    } catch (err) {
      throw new Error(
        "mongodb-memory-server is required for this test. Install it as a devDependency."
      );
    }

    mongod = await MongoMemoryServer.create({
      instance: { launchTimeout: 120000 },
    });
    const uri = mongod.getUri();
    assertLocalUri(uri);
    process.env.MONGODB_URI = uri;
    global.mongoose = { conn: null, promise: null };
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(uri, { dbName: "Car" });
    ({
      BookingHold,
      BookingCarLock,
      HOLD_STATUS,
    } = require("@models/BookingHold"));
    ({
      acquireMarketplaceHold,
      releaseMarketplaceHold,
    } = require("../bookingHold"));

    await BookingHold.syncIndexes();
    await BookingCarLock.syncIndexes();
  }, 180_000);

  afterAll(async () => {
    try {
      // Close every mongoose connection before stopping the in-memory server
      // so Jest does not leave open handles (MongoClient + mongod child).
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(true);
      }
      const open = mongoose.connections.filter((c) => c.readyState !== 0);
      if (open.length) {
        await Promise.all(open.map((c) => c.close(true)));
      }
      await mongoose.disconnect().catch(() => {});
    } finally {
      global.mongoose = { conn: null, promise: null };
      delete mongoose.models.BookingHold;
      delete mongoose.models.BookingCarLock;
      delete mongoose.connection.collections.booking_holds;
      delete mongoose.connection.collections.booking_car_locks;
      if (mongod) {
        await mongod.stop({ doCleanup: true, force: true });
        mongod = null;
      }
    }
  }, 180_000);

  beforeEach(async () => {
    await BookingHold.deleteMany({});
    await BookingCarLock.deleteMany({});
  });

  test("unique indexes exist on booking_holds.orderId and booking_car_locks.carId", async () => {
    const holdIndexes = await BookingHold.collection.indexes();
    const lockIndexes = await BookingCarLock.collection.indexes();
    expect(
      holdIndexes.some((idx) => idx.unique && idx.key && idx.key.orderId === 1)
    ).toBe(true);
    expect(
      lockIndexes.some((idx) => idx.unique && idx.key && idx.key.carId === 1)
    ).toBe(true);
  });

  test("only one of two overlapping concurrent acquires stays active", async () => {
    const carId = new mongoose.Types.ObjectId();
    const orderA = new mongoose.Types.ObjectId();
    const orderB = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");
    const holdExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const [first, second] = await Promise.all([
      acquireMarketplaceHold({
        carId,
        orderId: orderA,
        pickupAtUtc: pickup,
        returnAtUtc: ret,
        holdExpiresAt,
      }),
      acquireMarketplaceHold({
        carId,
        orderId: orderB,
        pickupAtUtc: pickup,
        returnAtUtc: ret,
        holdExpiresAt,
      }),
    ]);

    const wins = [first, second].filter((row) => row.ok);
    const losses = [first, second].filter((row) => !row.ok);
    expect(wins.length).toBe(1);
    expect(losses.length).toBe(1);
    expect(losses[0].code).toBe("hold_conflict");

    const active = await BookingHold.find({ status: HOLD_STATUS.ACTIVE });
    expect(active).toHaveLength(1);
  });

  test("after expiration/release the second request can acquire", async () => {
    const carId = new mongoose.Types.ObjectId();
    const orderA = new mongoose.Types.ObjectId();
    const orderB = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");

    const first = await acquireMarketplaceHold({
      carId,
      orderId: orderA,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(first.ok).toBe(true);

    await releaseMarketplaceHold(orderA, { reason: "expired" });

    const second = await acquireMarketplaceHold({
      carId,
      orderId: orderB,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(second.ok).toBe(true);
  });

  test("a finalized hold cannot be displaced", async () => {
    const carId = new mongoose.Types.ObjectId();
    const orderA = new mongoose.Types.ObjectId();
    const orderB = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");

    const first = await acquireMarketplaceHold({
      carId,
      orderId: orderA,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(first.ok).toBe(true);
    await BookingHold.updateOne(
      { orderId: orderA },
      { $set: { status: HOLD_STATUS.FINALIZED, finalizedAt: new Date() } }
    );

    const second = await acquireMarketplaceHold({
      carId,
      orderId: orderB,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const holdA = await BookingHold.findOne({ orderId: orderA }).lean();
    expect(holdA.status).toBe(HOLD_STATUS.FINALIZED);
    expect(second.ok).toBe(false);
    expect(second.code).toBe("hold_conflict");
  });
});
