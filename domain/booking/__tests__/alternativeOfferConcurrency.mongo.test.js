/**
 * @jest-environment node
 *
 * Real Mongo-compatible indexes. Never uses production/staging Atlas.
 */
import mongoose from "mongoose";
import { BOOKING_MODES } from "../bookingMode";
import { BOOKING_STATUS } from "../bookingStatus";

const REMOTE = /mongodb\+srv|\.mongodb\.net|atlas/i;

function assertLocalUri(uri) {
  if (!uri || REMOTE.test(uri) || !/127\.0\.0\.1|localhost/.test(uri)) {
    throw new Error(
      `Refusing Mongo concurrency test against a non-local URI: ${uri}`
    );
  }
}

describe("alternative offer concurrency (real indexes)", () => {
  let mongod;
  let AlternativeVehicleOffer;
  let BookingHold;
  let BookingCarLock;
  let acquireMarketplaceHold;
  let restoreMarketplaceHoldAfterFailedAcquire;
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

    AlternativeVehicleOffer = require("@models/AlternativeVehicleOffer").default;
    ({ BookingHold, BookingCarLock, HOLD_STATUS } = require("@models/BookingHold"));
    ({ acquireMarketplaceHold, restoreMarketplaceHoldAfterFailedAcquire } = require("../bookingHold"));

    await AlternativeVehicleOffer.collection.createIndex(
      { orderId: 1 },
      { unique: true, name: "orderId_1_status_offered_unique", partialFilterExpression: { status: "OFFERED" } }
    );
    await BookingHold.syncIndexes();
    await BookingCarLock.syncIndexes();
  }, 180_000);

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(true);
      }
      await mongoose.disconnect().catch(() => {});
    } finally {
      global.mongoose = { conn: null, promise: null };
      if (mongod) {
        await mongod.stop({ doCleanup: true, force: true });
        mongod = null;
      }
    }
  }, 180_000);

  beforeEach(async () => {
    await AlternativeVehicleOffer.deleteMany({});
    await BookingHold.deleteMany({});
    await BookingCarLock.deleteMany({});
  });

  test("two concurrent OFFERED inserts for one order cannot both succeed", async () => {
    const orderId = new mongoose.Types.ObjectId();
    const doc = (offerId) => ({
      offerId,
      orderId,
      companyId: new mongoose.Types.ObjectId(),
      vehicle: { model: "Seat Leon", photos: ["p"] },
      priceMinor: 1000,
      originalPriceMinor: 1000,
      reasonForReplacement: "workshop",
      expiresAt: new Date(Date.now() + 86400_000),
      status: "OFFERED",
    });

    const results = await Promise.allSettled([
      AlternativeVehicleOffer.create(doc("ALT-AAAAAAAABBBBBBBB")),
      AlternativeVehicleOffer.create(doc("ALT-CCCCCCCCDDDDDDDD")),
    ]);
    const ok = results.filter((row) => row.status === "fulfilled");
    const dup = results.filter(
      (row) => row.status === "rejected" && row.reason?.code === 11000
    );
    expect(ok.length).toBe(1);
    expect(dup.length).toBe(1);
    expect(await AlternativeVehicleOffer.countDocuments({ status: "OFFERED" })).toBe(1);
  });

  test("declined/expired offers do not block a later OFFERED row", async () => {
    const orderId = new mongoose.Types.ObjectId();
    await AlternativeVehicleOffer.create({
      offerId: "ALT-EXPIRED11111111",
      orderId,
      vehicle: { model: "A", photos: ["p"] },
      priceMinor: 1000,
      originalPriceMinor: 1000,
      reasonForReplacement: "first",
      expiresAt: new Date(),
      status: "EXPIRED",
    });
    await AlternativeVehicleOffer.create({
      offerId: "ALT-NEXT22222222222",
      orderId,
      vehicle: { model: "B", photos: ["p"] },
      priceMinor: 1000,
      originalPriceMinor: 1000,
      reasonForReplacement: "second",
      expiresAt: new Date(Date.now() + 86400_000),
      status: "OFFERED",
    });
    expect(await AlternativeVehicleOffer.countDocuments({ orderId })).toBe(2);
  });

  test("two customers cannot hold the same alternative car", async () => {
    const carId = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");
    const holdExpiresAt = new Date(Date.now() + 3600_000);
    const [first, second] = await Promise.all([
      acquireMarketplaceHold({
        carId,
        orderId: new mongoose.Types.ObjectId(),
        pickupAtUtc: pickup,
        returnAtUtc: ret,
        holdExpiresAt,
        offerId: "ALT-ONE",
        bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      }),
      acquireMarketplaceHold({
        carId,
        orderId: new mongoose.Types.ObjectId(),
        pickupAtUtc: pickup,
        returnAtUtc: ret,
        holdExpiresAt,
        offerId: "ALT-TWO",
        bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      }),
    ]);
    const wins = [first, second].filter((row) => row.ok);
    expect(wins).toHaveLength(1);
    const active = await BookingHold.find({ status: HOLD_STATUS.ACTIVE });
    expect(active).toHaveLength(1);
    expect(active[0].offerId).toMatch(/^ALT-/);
  });

  test("CAS acceptance: only one OFFERED row can flip to ACCEPTED", async () => {
    const offer = await AlternativeVehicleOffer.create({
      offerId: "ALT-CASACCEPT111111",
      orderId: new mongoose.Types.ObjectId(),
      vehicle: { model: "B", photos: ["p"] },
      priceMinor: 1000,
      originalPriceMinor: 1000,
      reasonForReplacement: "workshop",
      expiresAt: new Date(Date.now() + 86400_000),
      status: "OFFERED",
    });
    const [a, b] = await Promise.all([
      AlternativeVehicleOffer.findOneAndUpdate(
        { offerId: offer.offerId, status: "OFFERED" },
        { $set: { status: "ACCEPTED" } },
        { new: true }
      ),
      AlternativeVehicleOffer.findOneAndUpdate(
        { offerId: offer.offerId, status: "OFFERED" },
        { $set: { status: "ACCEPTED" } },
        { new: true }
      ),
    ]);
    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
    expect(winners[0].status).toBe("ACCEPTED");
  });

  test("unique orderId: same-order car-A hold is reassigned to car B, not inserted twice", async () => {
    const orderId = new mongoose.Types.ObjectId();
    const carA = new mongoose.Types.ObjectId();
    const carB = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");
    const holdExpiresAt = new Date(Date.now() + 3600_000);

    const first = await acquireMarketplaceHold({
      carId: carA,
      orderId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt,
      offerId: "",
    });
    expect(first.ok).toBe(true);

    const second = await acquireMarketplaceHold({
      carId: carB,
      orderId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt,
      offerId: "ALT-ABCDEF0123456789",
    });
    expect(second.ok).toBe(true);
    expect(second.reassigned).toBe(true);
    expect(String(second.previousHold.carId)).toBe(String(carA));
    expect(String(second.hold.carId)).toBe(String(carB));

    const rows = await BookingHold.find({ orderId });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].carId)).toBe(String(carB));
    expect(rows[0].status).toBe(HOLD_STATUS.ACTIVE);

    const futureLocks = await BookingCarLock.find({
      lockedUntil: { $gt: new Date() },
    });
    expect(futureLocks).toHaveLength(0);
  });

  test("another order holding car B blocks this order and leaves car A held", async () => {
    const carA = new mongoose.Types.ObjectId();
    const carB = new mongoose.Types.ObjectId();
    const orderA = new mongoose.Types.ObjectId();
    const orderB = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");
    const holdExpiresAt = new Date(Date.now() + 3600_000);

    expect(
      (
        await acquireMarketplaceHold({
          carId: carA,
          orderId: orderA,
          pickupAtUtc: pickup,
          returnAtUtc: ret,
          holdExpiresAt,
        })
      ).ok
    ).toBe(true);
    expect(
      (
        await acquireMarketplaceHold({
          carId: carB,
          orderId: orderB,
          pickupAtUtc: pickup,
          returnAtUtc: ret,
          holdExpiresAt,
        })
      ).ok
    ).toBe(true);

    const blocked = await acquireMarketplaceHold({
      carId: carB,
      orderId: orderA,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt,
      offerId: "ALT-ABCDEF0123456789",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("hold_conflict");

    const holdA = await BookingHold.findOne({ orderId: orderA }).lean();
    expect(String(holdA.carId)).toBe(String(carA));
    expect(holdA.status).toBe(HOLD_STATUS.ACTIVE);
    expect(await BookingHold.countDocuments({ status: HOLD_STATUS.ACTIVE })).toBe(2);
  });

  test("compensation restores car A after a failed same-order reassignment", async () => {
    const orderId = new mongoose.Types.ObjectId();
    const carA = new mongoose.Types.ObjectId();
    const carB = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");
    const holdExpiresAt = new Date(Date.now() + 3600_000);

    await acquireMarketplaceHold({
      carId: carA,
      orderId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt,
    });
    const moved = await acquireMarketplaceHold({
      carId: carB,
      orderId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt,
      offerId: "ALT-ABCDEF0123456789",
    });
    expect(moved.ok).toBe(true);

    const restored = await restoreMarketplaceHoldAfterFailedAcquire({
      orderId,
      previousHold: moved.previousHold,
      reason: "alternative_cas_lost",
    });
    expect(restored.restored).toBe(true);
    const hold = await BookingHold.findOne({ orderId }).lean();
    expect(String(hold.carId)).toBe(String(carA));
    expect(hold.status).toBe(HOLD_STATUS.ACTIVE);
  });

  test("compensation releases a newly created car-B hold when there was no previous hold", async () => {
    const orderId = new mongoose.Types.ObjectId();
    const carB = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");
    const acquired = await acquireMarketplaceHold({
      carId: carB,
      orderId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt: new Date(Date.now() + 3600_000),
      offerId: "ALT-ABCDEF0123456789",
    });
    expect(acquired.ok).toBe(true);
    expect(acquired.previousHold).toBeNull();

    await restoreMarketplaceHoldAfterFailedAcquire({
      orderId,
      previousHold: acquired.previousHold,
      reason: "alternative_order_update_failed",
    });
    const hold = await BookingHold.findOne({ orderId }).lean();
    expect(hold.status).toBe(HOLD_STATUS.RELEASED);
  });

  test("replay acquire for the accepted order does not create a second hold", async () => {
    const orderId = new mongoose.Types.ObjectId();
    const carB = new mongoose.Types.ObjectId();
    const pickup = new Date("2026-10-01T10:00:00.000Z");
    const ret = new Date("2026-10-05T10:00:00.000Z");
    const holdExpiresAt = new Date(Date.now() + 3600_000);
    const first = await acquireMarketplaceHold({
      carId: carB,
      orderId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt,
      offerId: "ALT-ABCDEF0123456789",
    });
    const replay = await acquireMarketplaceHold({
      carId: carB,
      orderId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      holdExpiresAt,
      offerId: "ALT-ABCDEF0123456789",
    });
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    expect(await BookingHold.countDocuments({ orderId })).toBe(1);
    expect(String(replay.hold._id)).toBe(String(first.hold._id));
  });
});

describe("Greece / transfer isolation", () => {
  test("OPS_CALENDAR never maps through marketplace alternative eligibility", () => {
    const { evaluateAutomaticAlternativeEligibility } = require("../alternativeOfferCore");
    const result = evaluateAutomaticAlternativeEligibility(
      {
        bookingMode: BOOKING_MODES.OPS_CALENDAR,
        countryCode: "GR",
        ownerId: "company-a",
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      },
      { actor: { role: 1, ownerId: "company-a" } }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_marketplace");
  });
});
