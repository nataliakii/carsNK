/**
 * Public-facing rental booking lifecycle.
 *
 * `domain/booking/bookingStatus.js` stays the storage-level vocabulary that
 * the availability engine already understands. This module adds the shorter
 * lifecycle used by the customer-facing and partner-facing workflow, plus a
 * mapping in both directions so blocking behaviour is unchanged.
 *
 * Canonical marketplace product rule (do not skip stages, do not treat
 * `order.confirmed` as a second confirmation):
 *   domain/booking/ROVARO_MARKETPLACE_WORKFLOW.md
 *   domain/booking/rovaroMarketplaceWorkflow.js
 *
 * Spain MARKETPLACE_REQUEST stored statuses:
 *   REQUESTED          → PENDING_SUPPLIER_CONFIRMATION   (AWAITING_SUPPLIER_RESPONSE)
 *   DECLINED           → SUPPLIER_DECLINED
 *   PARTNER_CONFIRMED  → CONFIRMED_AWAITING_PAYMENT      (brief hold)
 *   PAYMENT_PENDING    → PAYMENT_PROCESSING              (AWAITING_CUSTOMER_PAYMENT)
 *   PAYMENT_EXPIRED    → PAYMENT_EXPIRED
 *   CONFIRMED          → BOOKING_CONFIRMED               (Stripe webhook paid only)
 *   CANCELLED          → CUSTOMER_CANCELLED
 *   COMPLETED          → COMPLETED
 *
 * Do not store the string "PAYMENT_PENDING" or "AWAITING_CUSTOMER_PAYMENT"
 * on `order.bookingStatus`.
 */

import {
  BOOKING_STATUS,
  isHardBlockingBookingStatus,
} from "./bookingStatus";

export const RENTAL_STATE = Object.freeze({
  REQUESTED: "REQUESTED",
  PARTNER_CONFIRMED: "PARTNER_CONFIRMED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",
  CONFIRMED: "CONFIRMED",
  DECLINED: "DECLINED",
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
  [R.PAYMENT_EXPIRED]: BOOKING_STATUS.PAYMENT_EXPIRED,
  [R.CONFIRMED]: BOOKING_STATUS.BOOKING_CONFIRMED,
  [R.DECLINED]: BOOKING_STATUS.SUPPLIER_DECLINED,
  [R.ALTERNATIVE_OFFERED]: BOOKING_STATUS.ALTERNATIVE_PROPOSED,
  [R.ALTERNATIVE_ACCEPTED]: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
  [R.ALTERNATIVE_DECLINED]: BOOKING_STATUS.NO_AVAILABILITY,
  [R.CANCELLED]: BOOKING_STATUS.CUSTOMER_CANCELLED,
  [R.COMPLETED]: BOOKING_STATUS.COMPLETED,
});

/** Allowed lifecycle moves. Anything else is refused. */
export const RENTAL_STATE_TRANSITIONS = Object.freeze({
  [R.REQUESTED]: [
    R.PARTNER_CONFIRMED,
    R.DECLINED,
    R.ALTERNATIVE_OFFERED,
    R.CANCELLED,
  ],
  [R.PARTNER_CONFIRMED]: [
    R.PAYMENT_PENDING,
    R.PAYMENT_EXPIRED,
    R.DECLINED,
    R.ALTERNATIVE_OFFERED,
    R.CANCELLED,
  ],
  [R.PAYMENT_PENDING]: [
    R.CONFIRMED,
    R.PAYMENT_EXPIRED,
    R.DECLINED,
    R.ALTERNATIVE_OFFERED,
    R.CANCELLED,
  ],
  [R.PAYMENT_EXPIRED]: [R.PAYMENT_PENDING, R.CANCELLED, R.ALTERNATIVE_OFFERED],
  // Paid/confirmed bookings are not part of the automatic Spain alternative
  // flow. SUPERADMIN/manual replacement is a separate audited operation.
  [R.CONFIRMED]: [R.COMPLETED, R.CANCELLED],
  [R.DECLINED]: [],
  [R.ALTERNATIVE_OFFERED]: [R.ALTERNATIVE_ACCEPTED, R.ALTERNATIVE_DECLINED, R.CANCELLED],
  [R.ALTERNATIVE_ACCEPTED]: [
    R.PAYMENT_PENDING,
    R.PAYMENT_EXPIRED,
    R.CONFIRMED,
    R.CANCELLED,
  ],
  [R.ALTERNATIVE_DECLINED]: [R.CANCELLED, R.ALTERNATIVE_OFFERED, R.DECLINED],
  [R.CANCELLED]: [],
  [R.COMPLETED]: [],
});

export function canTransitionRentalState(from, to) {
  const allowed = RENTAL_STATE_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Apply a lifecycle move onto `order.bookingStatus`. Does not set the
 * legacy `confirmed` flag — that flag means "fully booked / paid" in
 * Greece ops and must not be flipped by partner availability confirm.
 *
 * @param {object} order
 * @param {string} toState
 * @returns {{ ok: boolean, from?: string, to?: string, bookingStatus?: string, code?: string }}
 */
export function applyRentalStateTransition(order, toState) {
  const from = resolveRentalState(order);
  if (!canTransitionRentalState(from, toState)) {
    return { ok: false, from, to: toState, code: "illegal_transition" };
  }
  const bookingStatus = RENTAL_STATE_TO_BOOKING_STATUS[toState];
  if (order && typeof order === "object") {
    if (typeof order.set === "function") {
      order.set("bookingStatus", bookingStatus, { strict: false });
    } else {
      order.bookingStatus = bookingStatus;
    }
  }
  return { ok: true, from, to: toState, bookingStatus };
}

/** Unpaid marketplace states that compliance invalidation may expire. */
export const COMPLIANCE_PAYMENT_EXPIRABLE_STATES = Object.freeze([
  R.PARTNER_CONFIRMED,
  R.PAYMENT_PENDING,
  R.ALTERNATIVE_ACCEPTED,
]);

const TERMINAL_NON_EXPIRABLE = new Set([
  R.CONFIRMED,
  R.CANCELLED,
  R.COMPLETED,
  R.DECLINED,
  R.ALTERNATIVE_DECLINED,
]);

/**
 * Explicit unpaid → PAYMENT_EXPIRED move for compliance invalidation.
 * Refuses paid, confirmed, cancelled, and other terminal states.
 * Does not force-write bookingStatus outside the transition table.
 */
export function applyCompliancePaymentExpiration(order) {
  if (!order) {
    return { ok: false, code: "missing_order" };
  }
  const bookingStatus = String(order.bookingStatus || "");
  const paymentStatus = String(order.payment?.status || "").toLowerCase();
  const from = resolveRentalState(order);

  if (
    paymentStatus === "paid" ||
    paymentStatus === "refunded" ||
    paymentStatus === "disputed" ||
    bookingStatus === BOOKING_STATUS.BOOKING_CONFIRMED ||
    from === R.CONFIRMED
  ) {
    return { ok: false, from, to: R.PAYMENT_EXPIRED, code: "paid_or_confirmed" };
  }
  if (
    TERMINAL_NON_EXPIRABLE.has(from) ||
    bookingStatus === BOOKING_STATUS.CUSTOMER_CANCELLED ||
    bookingStatus === BOOKING_STATUS.SUPPLIER_CANCELLED ||
    bookingStatus === BOOKING_STATUS.ADMIN_CANCELLED
  ) {
    return { ok: false, from, to: R.PAYMENT_EXPIRED, code: "terminal" };
  }
  if (!COMPLIANCE_PAYMENT_EXPIRABLE_STATES.includes(from)) {
    return { ok: false, from, to: R.PAYMENT_EXPIRED, code: "illegal_transition" };
  }
  return applyRentalStateTransition(order, R.PAYMENT_EXPIRED);
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
