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

import { isInternalBooking } from "@/domain/admin/rovaroContractorAdmin";
import { policyRoleFromUser } from "@/domain/admin/adminViewMode";
import { ROLE } from "@/domain/orders/admin-rbac";
import { isPlatformCustomerDataUnlocked } from "@/domain/orders/orderVisibility";

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
    // Generic not-found on purpose. A 403 would confirm that this booking
    // reference exists, which is itself information another company should not
    // be able to harvest by guessing ids.
    return {
      allowed: false,
      status: 404,
      code: "not_found",
      message: "Booking not found",
    };
  }

  if (isInternalBooking(order)) return { allowed: true };

  // Verified Booking Fee / paid workflow stage unlocks documents. Prefer the
  // shared unlock helper so a lagging payment.status cannot hide the licence
  // after bookingStatus already moved to BOOKING_CONFIRMED.
  const paid = isPlatformCustomerDataUnlocked(order);
  if (!paid) {
    return {
      allowed: false,
      status: 403,
      code: "not_yet_lawful",
      message:
        "Driver documents become available after the Booking Fee payment is confirmed",
    };
  }

  // A completed booking remains operationally editable, and the company may
  // need the verification record when correcting return/problem information.
  // The retention job still removes documents at the configured retention
  // deadline; COMPLETED itself is not a reason to close access after 72 hours.
  if (String(order.bookingStatus || "") === "COMPLETED") {
    return { allowed: true };
  }

  const dropoff = order.returnAtUtc || order.timeOut || order.rentalEndDate;

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
 * THE licence-visibility helper.
 *
 * Anything that decides whether to show, serialise or serve driving licence
 * data must call this — the contractor admin's VIEW_DRIVING_DOCUMENTS
 * capability, the download endpoint, and the API response stripper alike. It
 * delegates to evaluateDrivingLicenceAccess so a UI capability and the endpoint
 * that serves the bytes can never drift apart.
 *
 * @param {{ order: object, user: object|null, now?: Date }} params
 *   `user` is the session user (session.user), not a role number.
 * @returns {boolean}
 */
export function canViewDrivingLicenceDocuments({
  order,
  user,
  now = new Date(),
}) {
  if (!order || !user?.isAdmin) return false;
  const decision = evaluateDrivingLicenceAccess({
    order,
    isSuperadmin: policyRoleFromUser(user) === ROLE.SUPERADMIN,
    sessionOwnerId: user?.ownerId || null,
    now,
  });
  return decision.allowed === true;
}

/**
 * Options for a short-lived signed document URL. Callers must not return the
 * stored Cloudinary URL in its place.
 *
 * `authenticated` assets have no usable plain delivery URL at all, which is why
 * new licence captures are stored that way; `upload` is kept for the legacy
 * admin-uploaded images that predate the capture snapshot.
 */
export function signedDocumentDelivery(
  now = new Date(),
  { storageType = "upload", resourceType = "image" } = {}
) {
  const expiresAt =
    Math.floor(new Date(now).getTime() / 1000) + SIGNED_URL_TTL_SECONDS;
  return {
    options: {
      secure: true,
      sign_url: true,
      type: storageType === "authenticated" ? "authenticated" : "upload",
      resource_type: resourceType === "raw" ? "raw" : "image",
      expires_at: expiresAt,
    },
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    ttlSeconds: SIGNED_URL_TTL_SECONDS,
  };
}

export function issuedUrlIsPermanent(storedUrl, issuedUrl) {
  const stored = String(storedUrl || "");
  const issued = String(issuedUrl || "");
  if (!issued) return true;
  return Boolean(stored) && issued === stored;
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
