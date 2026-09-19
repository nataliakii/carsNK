/**
 * Unified rental availability engine.
 *
 * Interval semantics: half-open [pickupInstant, returnInstant).
 * Touching boundaries without buffer (pickup === otherReturn) are allowed.
 * Company preparation buffer expands the *other* interval on both sides:
 *   overlap if pickup < otherReturn + buffer && return > otherPickup - buffer
 * Exact buffer-gap equality is allowed (half-open).
 *
 * Blocking (current):
 *   - confirmed === true  OR  offline === true
 *   - bookingStatus in HARD_BLOCKING_BOOKING_STATUSES (future holds)
 * Non-blocking:
 *   - pending marketplace requests (PENDING_SUPPLIER_CONFIRMATION)
 *   - declined / cancelled / expired statuses
 *   - unconfirmed non-offline Greece requests (soft warning only)
 *
 * Purposes:
 *   REQUEST     — public/admin create
 *   CONFIRM     — supplier/superadmin confirmation
 *   ADMIN_EDIT  — exclude self
 *   CALENDAR    — blocked intervals for UI
 */

import {
  BOOKING_MODES,
  isMarketplaceRequestMode,
} from "./bookingMode";
import {
  isHardBlockingBookingStatus,
  isNonBlockingBookingStatus,
} from "./bookingStatus";
import { isOrderDateBlocking } from "@/domain/orders/isOrderDateBlocking";
import { interpretInstant } from "@/domain/time/businessInstant";
import {
  canonicalizeTimezone,
  LEGACY_FALLBACK_TZ,
} from "@/domain/time/resolveBusinessTimezone";

export const AVAILABILITY_PURPOSE = {
  REQUEST: "REQUEST",
  CONFIRM: "CONFIRM",
  ADMIN_EDIT: "ADMIN_EDIT",
  CALENDAR: "CALENDAR",
};

export const CONFLICT_TYPE = {
  NONE: "NONE",
  INVALID_RANGE: "INVALID_RANGE",
  MIN_DURATION: "MIN_DURATION",
  OVERLAP: "OVERLAP",
  BOUNDARY_BUFFER: "BOUNDARY_BUFFER",
  PENDING_OVERLAP: "PENDING_OVERLAP",
};

const PUBLIC_REASON = {
  [CONFLICT_TYPE.INVALID_RANGE]: "Pickup must be before return.",
  [CONFLICT_TYPE.MIN_DURATION]: "Rental is shorter than the minimum duration.",
  [CONFLICT_TYPE.OVERLAP]: "Those dates are not available.",
  [CONFLICT_TYPE.BOUNDARY_BUFFER]:
    "Pickup or return is too close to another booking.",
  [CONFLICT_TYPE.PENDING_OVERLAP]:
    "Another request overlaps these dates. Your request can still be submitted.",
};

function orderIdOf(order) {
  if (!order) return "";
  const raw = order._id ?? order.id;
  return raw != null ? String(raw) : "";
}

function pickupReturnOf(order, timezone) {
  const tz =
    canonicalizeTimezone(timezone || order?.timezone) || LEGACY_FALLBACK_TZ;
  const pickupSrc = order?.pickupAtUtc || order?.timeIn || order?.rentalStartDate;
  const returnSrc = order?.returnAtUtc || order?.timeOut || order?.rentalEndDate;
  const pickup = interpretInstant(pickupSrc, tz);
  const ret = interpretInstant(returnSrc, tz);
  if (!pickup || !ret) return null;
  return {
    pickupMs: pickup.valueOf(),
    returnMs: ret.valueOf(),
    timezone: tz,
  };
}

/**
 * Whether this existing record hard-blocks a new interval.
 * Pending marketplace / unconfirmed website requests do not hard-block.
 */
export function isHardBlockingRecord(order) {
  if (!order) return false;
  if (isNonBlockingBookingStatus(order.bookingStatus)) return false;
  if (isHardBlockingBookingStatus(order.bookingStatus)) return true;
  return isOrderDateBlocking(order);
}

export function isSoftWarningRecord(order) {
  if (!order) return false;
  if (isHardBlockingRecord(order)) return false;
  if (isNonBlockingBookingStatus(order.bookingStatus)) {
    return (
      String(order.bookingStatus) === "PENDING_SUPPLIER_CONFIRMATION" ||
      String(order.bookingStatus) === "ALTERNATIVE_PROPOSED"
    );
  }
  return order.confirmed !== true && order.offline !== true;
}

function intervalsOverlapHalfOpen(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function bufferMs(bufferHours) {
  const h = Number(bufferHours);
  if (!Number.isFinite(h) || h <= 0) return 0;
  return h * 60 * 60 * 1000;
}

function classifyConflict(pickupMs, returnMs, otherPickup, otherReturn, bufMs) {
  const rawOverlap = intervalsOverlapHalfOpen(
    pickupMs,
    returnMs,
    otherPickup,
    otherReturn
  );
  const bufferedOverlap = intervalsOverlapHalfOpen(
    pickupMs,
    returnMs,
    otherPickup - bufMs,
    otherReturn + bufMs
  );
  if (rawOverlap) return CONFLICT_TYPE.OVERLAP;
  if (bufferedOverlap) return CONFLICT_TYPE.BOUNDARY_BUFFER;
  return CONFLICT_TYPE.NONE;
}

function publicRecord(order, extra = {}) {
  return {
    orderId: orderIdOf(order),
    offline: order.offline === true,
    confirmed: order.confirmed === true,
    bookingStatus: order.bookingStatus || null,
    ...extra,
  };
}

function emptyResult(overrides = {}) {
  return {
    available: true,
    hardConflict: false,
    softConflict: false,
    conflictType: CONFLICT_TYPE.NONE,
    blockingRecords: [],
    warningRecords: [],
    effectiveBlockedIntervals: [],
    reasonCodes: [],
    userSafeReason: null,
    adminDiagnostics: {},
    ...overrides,
  };
}

/**
 * @param {object} input
 */
export function evaluateRentalAvailability(input = {}) {
  const purpose = input.purpose || AVAILABILITY_PURPOSE.REQUEST;
  const bookingMode = input.bookingMode || BOOKING_MODES.OPS_CALENDAR;
  const timezone = canonicalizeTimezone(input.timezone) || LEGACY_FALLBACK_TZ;
  const bufMs = bufferMs(input.bufferHours);
  const excludeId =
    input.excludeOrderId != null ? String(input.excludeOrderId) : "";
  const existing = Array.isArray(input.existingOrders)
    ? input.existingOrders
    : [];

  const pickup = interpretInstant(input.pickupAtUtc, timezone);
  const ret = interpretInstant(input.returnAtUtc, timezone);

  if (!pickup || !ret) {
    return emptyResult({
      available: false,
      hardConflict: true,
      conflictType: CONFLICT_TYPE.INVALID_RANGE,
      reasonCodes: [CONFLICT_TYPE.INVALID_RANGE],
      userSafeReason: PUBLIC_REASON[CONFLICT_TYPE.INVALID_RANGE],
    });
  }

  const pickupMs = pickup.valueOf();
  const returnMs = ret.valueOf();

  if (!(pickupMs < returnMs)) {
    return emptyResult({
      available: false,
      hardConflict: true,
      conflictType: CONFLICT_TYPE.INVALID_RANGE,
      reasonCodes: [CONFLICT_TYPE.INVALID_RANGE],
      userSafeReason: PUBLIC_REASON[CONFLICT_TYPE.INVALID_RANGE],
    });
  }

  const minHours = Number(input.minDurationHours);
  if (Number.isFinite(minHours) && minHours > 0) {
    const durationHours = (returnMs - pickupMs) / (60 * 60 * 1000);
    if (durationHours < minHours) {
      return emptyResult({
        available: false,
        hardConflict: true,
        conflictType: CONFLICT_TYPE.MIN_DURATION,
        reasonCodes: [CONFLICT_TYPE.MIN_DURATION],
        userSafeReason: PUBLIC_REASON[CONFLICT_TYPE.MIN_DURATION],
      });
    }
  }

  const blockingRecords = [];
  const warningRecords = [];
  const effectiveBlockedIntervals = [];
  let hardType = CONFLICT_TYPE.NONE;

  for (const order of existing) {
    if (!order) continue;
    const oid = orderIdOf(order);
    if (excludeId && oid === excludeId) continue;

    const interval = pickupReturnOf(order, order.timezone || timezone);
    if (!interval) continue;

    const kind = classifyConflict(
      pickupMs,
      returnMs,
      interval.pickupMs,
      interval.returnMs,
      bufMs
    );
    if (kind === CONFLICT_TYPE.NONE) continue;

    if (isHardBlockingRecord(order)) {
      blockingRecords.push(
        publicRecord(order, {
          conflictType: kind,
          pickupAtUtc: new Date(interval.pickupMs).toISOString(),
          returnAtUtc: new Date(interval.returnMs).toISOString(),
        })
      );
      effectiveBlockedIntervals.push({
        startUtc: new Date(interval.pickupMs - bufMs).toISOString(),
        endUtc: new Date(interval.returnMs + bufMs).toISOString(),
      });
      if (
        hardType === CONFLICT_TYPE.NONE ||
        hardType === CONFLICT_TYPE.BOUNDARY_BUFFER
      ) {
        hardType = kind;
      }
    } else if (isSoftWarningRecord(order)) {
      warningRecords.push(
        publicRecord(order, {
          conflictType: CONFLICT_TYPE.PENDING_OVERLAP,
        })
      );
    }
  }

  const hardConflict = blockingRecords.length > 0;
  const softConflict = !hardConflict && warningRecords.length > 0;
  const conflictType = hardConflict
    ? hardType
    : softConflict
      ? CONFLICT_TYPE.PENDING_OVERLAP
      : CONFLICT_TYPE.NONE;

  const reasonCodes = [];
  if (hardConflict) reasonCodes.push(conflictType);
  if (softConflict) reasonCodes.push(CONFLICT_TYPE.PENDING_OVERLAP);

  const marketplace = isMarketplaceRequestMode(bookingMode);

  return {
    available: !hardConflict,
    hardConflict,
    softConflict,
    conflictType,
    blockingRecords,
    warningRecords,
    effectiveBlockedIntervals,
    reasonCodes,
    userSafeReason: hardConflict
      ? PUBLIC_REASON[conflictType] || PUBLIC_REASON[CONFLICT_TYPE.OVERLAP]
      : softConflict
        ? PUBLIC_REASON[CONFLICT_TYPE.PENDING_OVERLAP]
        : null,
    adminDiagnostics: {
      purpose,
      bookingMode,
      timezone,
      bufferHours: Number(input.bufferHours) || 0,
      marketplacePendingDoesNotBlock: marketplace,
      pickupAtUtc: pickup.toISOString(),
      returnAtUtc: ret.toISOString(),
      blockingCount: blockingRecords.length,
      warningCount: warningRecords.length,
    },
  };
}

/**
 * Map engine result to the legacy checkConflicts status codes.
 * 409 = inner overlap, 408 = boundary/buffer (must now reject), 202 = pending warning.
 */
export function toLegacyCreateConflict(result) {
  if (!result) return false;
  if (result.hardConflict) {
    const isBoundary = result.conflictType === CONFLICT_TYPE.BOUNDARY_BUFFER;
    const ids = result.blockingRecords.map((r) => r.orderId).filter(Boolean);
    return {
      status: isBoundary ? 408 : 409,
      data: {
        conflictMessage: result.userSafeReason,
        conflictDates: ids,
        conflictOrdersIds: ids,
        conflictingOrders: result.blockingRecords,
        conflictType: result.conflictType,
      },
    };
  }
  if (result.softConflict) {
    const ids = result.warningRecords.map((r) => r.orderId).filter(Boolean);
    return {
      status: 202,
      data: {
        conflictMessage: result.userSafeReason,
        conflictDates: ids,
        conflictOrdersIds: ids,
        conflictingOrders: result.warningRecords,
        conflictType: result.conflictType,
      },
    };
  }
  return false;
}

/**
 * Compatibility wrapper for admin edit / move / change-dates routes.
 * Hard conflicts (including the old 408 boundary/buffer case) must reject.
 */
export function checkOrderIntervalConflicts({
  existingOrders,
  pickupAtUtc,
  returnAtUtc,
  timezone,
  excludeOrderId,
  bufferHours = 0,
  bookingMode,
  purpose = AVAILABILITY_PURPOSE.ADMIN_EDIT,
} = {}) {
  const result = evaluateRentalAvailability({
    pickupAtUtc,
    returnAtUtc,
    timezone,
    existingOrders,
    excludeOrderId,
    bufferHours,
    bookingMode,
    purpose,
  });
  const legacy = toLegacyCreateConflict(result);
  if (!legacy) return { status: null, data: null, availability: result };
  return { ...legacy, availability: result };
}

/**
 * Safe blocked intervals for calendars — no customer PII.
 */
export function serializePublicBlockedIntervals(
  existingOrders,
  { bufferHours = 0, timezone, excludeOrderId } = {}
) {
  const bufMs = bufferMs(bufferHours);
  const tz = canonicalizeTimezone(timezone) || LEGACY_FALLBACK_TZ;
  const intervals = [];
  for (const order of existingOrders || []) {
    if (!isHardBlockingRecord(order)) continue;
    if (excludeOrderId && orderIdOf(order) === String(excludeOrderId)) continue;
    const interval = pickupReturnOf(order, order.timezone || tz);
    if (!interval) continue;
    intervals.push({
      orderId: orderIdOf(order),
      startUtc: new Date(interval.pickupMs - bufMs).toISOString(),
      endUtc: new Date(interval.returnMs + bufMs).toISOString(),
    });
  }
  return intervals;
}
