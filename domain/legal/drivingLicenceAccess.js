/**
 * Access policy for customer driving licence images.
 *
 * Driving licences are identity documents. The rules implemented here:
 *   - never reachable through a public endpoint (the route requires a session)
 *   - never sent as an email attachment (only a link into the partner area)
 *   - shown to the supplier only from the lawful and necessary stage, which
 *     is a confirmed and paid booking, and only inside a window around the
 *     rental
 *   - delivered as short-lived signed URLs, not permanent delivery URLs
 *   - every view and download is audit-logged
 *   - deleted automatically after a configurable retention period
 *
 * Controller roles: Rovaro is controller for the booking-intermediation
 * purpose; the Supplier is controller for the rental contract and the
 * identity check at handover. Neither acts as the other's processor for this
 * data, which is why access is gated rather than mirrored.
 */

/** How long a generated signed URL stays valid. */
export const SIGNED_URL_TTL_SECONDS = 120;

/** Supplier may look this long before pickup. */
export const ACCESS_WINDOW_BEFORE_PICKUP_HOURS = 72;

/** Supplier may still look this long after the return, for disputes. */
export const ACCESS_WINDOW_AFTER_RETURN_HOURS = 72;

const HOUR_MS = 3600 * 1000;

/**
 * @param {{
 *   order: object,
 *   isSuperadmin: boolean,
 *   sessionOwnerId: string|null,
 *   now?: Date,
 * }} params
 * @returns {{ allowed: true } | { allowed: false, code: string, message: string, status: number }}
 */
export function evaluateDrivingLicenceAccess({
  order,
  isSuperadmin,
  sessionOwnerId,
  now = new Date(),
}) {
  if (!order) {
    return {
      allowed: false,
      status: 404,
      code: "not_found",
      message: "Booking not found",
    };
  }

  if (isSuperadmin) return { allowed: true };

  const owner = sessionOwnerId ? String(sessionOwnerId) : "";
  if (!owner || String(order.ownerId || "") !== owner) {
    return {
      allowed: false,
      status: 403,
      code: "wrong_fleet",
      message: "This booking belongs to another fleet",
    };
  }

  const paid = order?.payment?.status === "paid";
  const confirmed = Boolean(order?.confirmed);
  if (!paid && !confirmed) {
    return {
      allowed: false,
      status: 403,
      code: "not_yet_lawful",
      message:
        "Driver documents become available once the booking is confirmed and the prepayment has been received",
    };
  }

  const pickup = order.pickupAtUtc || order.timeIn || order.rentalStartDate;
  const dropoff = order.returnAtUtc || order.timeOut || order.rentalEndDate;

  if (pickup) {
    const opensAt =
      new Date(pickup).getTime() - ACCESS_WINDOW_BEFORE_PICKUP_HOURS * HOUR_MS;
    if (now.getTime() < opensAt) {
      return {
        allowed: false,
        status: 403,
        code: "too_early",
        message: `Driver documents become available ${ACCESS_WINDOW_BEFORE_PICKUP_HOURS} hours before pickup`,
      };
    }
  }

  if (dropoff) {
    const closesAt =
      new Date(dropoff).getTime() + ACCESS_WINDOW_AFTER_RETURN_HOURS * HOUR_MS;
    if (now.getTime() > closesAt) {
      return {
        allowed: false,
        status: 403,
        code: "window_closed",
        message: "The access window for these documents has closed",
      };
    }
  }

  return { allowed: true };
}

/**
 * The moment a rental ended, which is what every retention clock counts from.
 *
 * Bookings carry up to three end timestamps of decreasing authority, so the
 * order of preference lives here and nowhere else.
 *
 * @param {object} order
 * @returns {Date|string|number|null}
 */
export function resolveRetentionAnchor(order) {
  return order?.returnAtUtc || order?.timeOut || order?.rentalEndDate || null;
}

/**
 * Documents past their retention period, ready for automatic deletion.
 *
 * @param {{ order: object, retentionDays: number, now?: Date }} params
 */
export function isPastRetention({ order, retentionDays, now = new Date() }) {
  const end = resolveRetentionAnchor(order);
  if (!end) return false;
  const deleteAfter =
    new Date(end).getTime() + Number(retentionDays) * 24 * HOUR_MS;
  return now.getTime() > deleteAfter;
}
