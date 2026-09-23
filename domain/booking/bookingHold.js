/**
 * Atomic-enough marketplace booking holds.
 *
 * Mongo transactions are not used in this deployment. Overlapping confirms
 * are serialized with a short per-car lock, then an active BookingHold row
 * plus hard-blocking orders are checked before the hold is kept.
 */

import { BookingHold, BookingCarLock, HOLD_STATUS } from "@models/BookingHold";
import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import {
  AVAILABILITY_PURPOSE,
  evaluateRentalAvailability,
} from "@/domain/booking/availabilityEngine";

const LOCK_MS = 15_000;

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

export function snapshotHold(hold) {
  if (!hold) return null;
  return {
    _id: hold._id,
    carId: hold.carId,
    orderId: hold.orderId,
    companyId: hold.companyId || null,
    pickupAtUtc: hold.pickupAtUtc,
    returnAtUtc: hold.returnAtUtc,
    holdExpiresAt: hold.holdExpiresAt,
    status: hold.status,
    offerId: hold.offerId || "",
    stripeSessionId: hold.stripeSessionId || "",
    releasedAt: hold.releasedAt || null,
    finalizedAt: hold.finalizedAt || null,
    releaseReason: hold.releaseReason || "",
  };
}

function isRestorableHoldStatus(status) {
  return status === HOLD_STATUS.ACTIVE || status === HOLD_STATUS.RETRY;
}

export async function cleanupExpiredHolds(now = new Date(), options = {}) {
  const { cleanupExpiredHolds: run } = await import(
    "@/domain/booking/expiredHoldCleanup"
  );
  return run(now, options);
}

async function acquireCarLock(carId, orderId, now) {
  const lockedUntil = new Date(now.getTime() + LOCK_MS);
  try {
    const lock = await BookingCarLock.findOneAndUpdate(
      {
        carId,
        $or: [
          { lockedUntil: { $lte: now } },
          { lockedUntil: null },
          { lockedByOrderId: orderId },
        ],
      },
      {
        $set: {
          lockedByOrderId: orderId,
          lockedUntil,
        },
      },
      { upsert: true, new: true }
    );
    if (!lock) {
      return { ok: false, code: "hold_conflict" };
    }
    if (
      lock.lockedByOrderId &&
      String(lock.lockedByOrderId) !== String(orderId) &&
      lock.lockedUntil &&
      lock.lockedUntil > now
    ) {
      return { ok: false, code: "hold_conflict" };
    }
    return { ok: true, lock };
  } catch (err) {
    if (err?.code === 11000) {
      return { ok: false, code: "hold_conflict" };
    }
    throw err;
  }
}

async function releaseCarLock(carId, orderId) {
  await BookingCarLock.updateOne(
    { carId, lockedByOrderId: orderId },
    { $set: { lockedUntil: new Date(0), lockedByOrderId: null } }
  ).catch(() => {});
}

export async function findOverlappingActiveHold({
  carId,
  pickupAtUtc,
  returnAtUtc,
  excludeOrderId,
  now = new Date(),
}) {
  const pickup = asDate(pickupAtUtc);
  const ret = asDate(returnAtUtc);
  if (!pickup || !ret) return null;

  const query = BookingHold.find({
    carId,
    status: { $in: [HOLD_STATUS.ACTIVE, HOLD_STATUS.FINALIZED] },
    $or: [
      { status: HOLD_STATUS.FINALIZED },
      { holdExpiresAt: { $gt: now } },
    ],
    ...(excludeOrderId ? { orderId: { $ne: excludeOrderId } } : {}),
  });
  const holds = typeof query.lean === "function" ? await query.lean() : await query;

  return (
    holds.find((hold) =>
      intervalsOverlap(pickup, ret, hold.pickupAtUtc, hold.returnAtUtc)
    ) || null
  );
}

/**
 * @param {{
 *   carId: string,
 *   orderId: string,
 *   companyId?: string|null,
 *   pickupAtUtc: Date|string,
 *   returnAtUtc: Date|string,
 *   holdExpiresAt: Date,
 *   timezone?: string,
 *   bookingMode?: string,
 *   bufferHours?: number,
 * }} params
 */
export async function acquireMarketplaceHold(params) {
  await connectToDB();
  const now = new Date();
  await cleanupExpiredHolds(now, {
    carId: params.carId,
    limit: 25,
    trigger: "acquire",
  });

  const pickup = asDate(params.pickupAtUtc);
  const ret = asDate(params.returnAtUtc);
  if (!pickup || !ret || !(pickup < ret)) {
    return {
      ok: false,
      code: "invalid_range",
      message: "Invalid hold interval",
    };
  }

  const lock = await acquireCarLock(params.carId, params.orderId, now);
  if (!lock.ok) {
    return {
      ok: false,
      code: "hold_conflict",
      message: "Another overlapping booking is already being confirmed.",
    };
  }

  let previousHold = null;
  try {
    const overlappingHold = await findOverlappingActiveHold({
      carId: params.carId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      excludeOrderId: params.orderId,
      now,
    });
    if (overlappingHold) {
      return {
        ok: false,
        code: "hold_conflict",
        message: "Those dates are already held for another booking.",
        conflictingOrderId: String(overlappingHold.orderId),
        previousHold,
      };
    }

    const orderQuery = Order.find({ car: params.carId });
    const existingOrders =
      typeof orderQuery.lean === "function"
        ? await orderQuery.lean()
        : await orderQuery;
    const availability = evaluateRentalAvailability({
      carId: params.carId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      timezone: params.timezone,
      existingOrders,
      excludeOrderId: params.orderId,
      bufferHours: params.bufferHours || 0,
      purpose: AVAILABILITY_PURPOSE.CONFIRM,
      bookingMode: params.bookingMode,
    });
    if (availability.hardConflict) {
      return {
        ok: false,
        code: "date_conflict",
        message: availability.userSafeReason || "Those dates are not available.",
        previousHold,
      };
    }

    const existing = await BookingHold.findOne({ orderId: params.orderId });
    previousHold = snapshotHold(
      existing?.toObject ? existing.toObject() : existing
    );
    if (previousHold?.status === HOLD_STATUS.FINALIZED) {
      return {
        ok: false,
        code: "hold_finalized",
        message: "This booking already has a finalized hold.",
        previousHold,
      };
    }

    const hold = await BookingHold.findOneAndUpdate(
      { orderId: params.orderId },
      {
        $set: {
          carId: params.carId,
          companyId: params.companyId || null,
          pickupAtUtc: pickup,
          returnAtUtc: ret,
          holdExpiresAt: params.holdExpiresAt,
          status: HOLD_STATUS.ACTIVE,
          releasedAt: null,
          finalizedAt: null,
          releaseReason: "",
          offerId: params.offerId || "",
        },
      },
      { upsert: true, new: true }
    );

    return {
      ok: true,
      hold: hold.toObject ? hold.toObject() : hold,
      previousHold,
      reassigned: Boolean(
        previousHold?.carId &&
          String(previousHold.carId) !== String(params.carId)
      ),
    };
  } finally {
    await releaseCarLock(params.carId, params.orderId);
  }
}

export async function releaseMarketplaceHold(
  orderId,
  { reason = "released" } = {}
) {
  await connectToDB();
  const now = new Date();
  const hold = await BookingHold.findOneAndUpdate(
    {
      orderId,
      status: { $in: [HOLD_STATUS.ACTIVE, HOLD_STATUS.RETRY] },
    },
    {
      $set: {
        status: HOLD_STATUS.RELEASED,
        releasedAt: now,
        releaseReason: reason,
      },
    },
    { new: true }
  );
  return { ok: true, hold: hold ? hold.toObject() : null };
}

/**
 * Release only the unpaid hold tied to a specific alternative offer.
 * Another order's hold, and a hold for a different offer, are never touched.
 */
export async function releaseMarketplaceHoldForOffer(
  orderId,
  offerId,
  { reason = "released" } = {}
) {
  await connectToDB();
  const id = String(offerId || "").trim();
  if (!orderId || !id) return { ok: true, hold: null };
  const now = new Date();
  const hold = await BookingHold.findOneAndUpdate(
    {
      orderId,
      offerId: id,
      status: { $in: [HOLD_STATUS.ACTIVE, HOLD_STATUS.RETRY] },
    },
    {
      $set: {
        status: HOLD_STATUS.RELEASED,
        releasedAt: now,
        releaseReason: reason,
      },
    },
    { new: true }
  );
  return { ok: true, hold: hold ? hold.toObject() : null };
}

/**
 * Undo a same-order hold upsert after a failed alternative acceptance.
 *
 * Unique `orderId` means we never insert a second hold. Compensation either
 * restores the previous same-order snapshot (car A) or releases the newly
 * acquired car-B hold. Another order's hold is never touched.
 */
export async function restoreMarketplaceHoldAfterFailedAcquire({
  orderId,
  previousHold,
  reason = "alternative_compensation",
} = {}) {
  await connectToDB();
  if (!orderId) return { ok: false, code: "invalid_order" };

  const prevActive =
    previousHold && isRestorableHoldStatus(previousHold.status);

  if (prevActive && previousHold.carId) {
    const restored = await BookingHold.findOneAndUpdate(
      { orderId },
      {
        $set: {
          carId: previousHold.carId,
          companyId: previousHold.companyId || null,
          pickupAtUtc: previousHold.pickupAtUtc,
          returnAtUtc: previousHold.returnAtUtc,
          holdExpiresAt: previousHold.holdExpiresAt,
          status: previousHold.status,
          offerId: previousHold.offerId || "",
          stripeSessionId: previousHold.stripeSessionId || "",
          releasedAt: previousHold.releasedAt || null,
          finalizedAt: previousHold.finalizedAt || null,
          releaseReason: previousHold.releaseReason || "",
        },
      },
      { new: true }
    );
    return {
      ok: true,
      restored: true,
      hold: restored ? restored.toObject() : null,
    };
  }

  return releaseMarketplaceHold(orderId, { reason });
}

export async function markHoldForRetry(orderId, { reason = "checkout_failed" } = {}) {
  await connectToDB();
  const hold = await BookingHold.findOneAndUpdate(
    { orderId },
    {
      $set: {
        status: HOLD_STATUS.RETRY,
        releaseReason: reason,
        stripeSessionId: "",
      },
    },
    { new: true }
  );
  return { ok: true, hold: hold ? hold.toObject() : null };
}

export async function finalizeMarketplaceHold(orderId, { stripeSessionId = "" } = {}) {
  await connectToDB();
  const now = new Date();
  const hold = await BookingHold.findOneAndUpdate(
    { orderId },
    {
      $set: {
        status: HOLD_STATUS.FINALIZED,
        finalizedAt: now,
        stripeSessionId: stripeSessionId || "",
      },
    },
    { new: true }
  );
  return { ok: true, hold: hold ? hold.toObject() : null };
}

export async function attachStripeSessionToHold(orderId, stripeSessionId) {
  await connectToDB();
  await BookingHold.updateOne(
    { orderId, status: HOLD_STATUS.ACTIVE },
    { $set: { stripeSessionId: stripeSessionId || "" } }
  );
}

export { HOLD_STATUS };
