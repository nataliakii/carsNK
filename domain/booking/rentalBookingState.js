/**
 * Public-facing rental booking lifecycle.
 *
 * `domain/booking/bookingStatus.js` stays the storage-level vocabulary that
 * the availability engine already understands. This module adds the shorter
 * lifecycle used by the customer-facing and partner-facing workflow, plus a
 * mapping in both directions so blocking behaviour is unchanged.
 */

import {
  BOOKING_STATUS,
  isHardBlockingBookingStatus,
} from "./bookingStatus";

export const RENTAL_STATE = Object.freeze({
  REQUESTED: "REQUESTED",
  PARTNER_CONFIRMED: "PARTNER_CONFIRMED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  CONFIRMED: "CONFIRMED",
  ALTERNATIVE_OFFERED: "ALTERNATIVE_OFFERED",
  ALTERNATIVE_ACCEPTED: "ALTERNATIVE_ACCEPTED",
  ALTERNATIVE_DECLINED: "ALTERNATIVE_DECLINED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
});

export const ALL_RENTAL_STATES = Object.freeze(Object.values(RENTAL_STATE));

const R = RENTAL_STATE;

/** Storage status written to `order.bookingStatus` for each lifecycle state. */
export const RENTAL_STATE_TO_BOOKING_STATUS = Object.freeze({
  [R.REQUESTED]: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
  [R.PARTNER_CONFIRMED]: BOOKING_STATUS.CONFIRMED_AWAITING_PAYMENT,
  [R.PAYMENT_PENDING]: BOOKING_STATUS.PAYMENT_PROCESSING,
  [R.CONFIRMED]: BOOKING_STATUS.BOOKING_CONFIRMED,
  [R.ALTERNATIVE_OFFERED]: BOOKING_STATUS.ALTERNATIVE_PROPOSED,
  [R.ALTERNATIVE_ACCEPTED]: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
  [R.ALTERNATIVE_DECLINED]: BOOKING_STATUS.NO_AVAILABILITY,
  [R.CANCELLED]: BOOKING_STATUS.CUSTOMER_CANCELLED,
  [R.COMPLETED]: BOOKING_STATUS.COMPLETED,
});

/** Allowed lifecycle moves. Anything else is refused. */
export const RENTAL_STATE_TRANSITIONS = Object.freeze({
  [R.REQUESTED]: [R.PARTNER_CONFIRMED, R.ALTERNATIVE_OFFERED, R.CANCELLED],
  [R.PARTNER_CONFIRMED]: [R.PAYMENT_PENDING, R.ALTERNATIVE_OFFERED, R.CANCELLED],
  [R.PAYMENT_PENDING]: [R.CONFIRMED, R.ALTERNATIVE_OFFERED, R.CANCELLED],
  [R.CONFIRMED]: [R.ALTERNATIVE_OFFERED, R.COMPLETED, R.CANCELLED],
  [R.ALTERNATIVE_OFFERED]: [R.ALTERNATIVE_ACCEPTED, R.ALTERNATIVE_DECLINED, R.CANCELLED],
  [R.ALTERNATIVE_ACCEPTED]: [R.PAYMENT_PENDING, R.CONFIRMED, R.CANCELLED],
  [R.ALTERNATIVE_DECLINED]: [R.CANCELLED, R.ALTERNATIVE_OFFERED],
  [R.CANCELLED]: [],
  [R.COMPLETED]: [],
});

export function canTransitionRentalState(from, to) {
  const allowed = RENTAL_STATE_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Lifecycle state of an order, derived from the stored booking status with a
 * fallback to the legacy `confirmed` flag so older rows still resolve.
 *
 * @param {object} order
 */
export function resolveRentalState(order) {
  const stored = String(order?.bookingStatus || "").trim();
  if (stored) {
    const match = Object.entries(RENTAL_STATE_TO_BOOKING_STATUS).find(
      ([, status]) => status === stored
    );
    if (match) return match[0];
  }
  if (order?.payment?.status === "paid") return R.CONFIRMED;
  if (order?.confirmed) return R.PARTNER_CONFIRMED;
  return R.REQUESTED;
}

/** Does this lifecycle state block the vehicle's calendar? */
export function blocksCalendar(state) {
  const status = RENTAL_STATE_TO_BOOKING_STATUS[state];
  return isHardBlockingBookingStatus(status);
}
