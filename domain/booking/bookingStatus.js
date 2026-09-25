/**
 * Storage-level booking statuses. Lifecycle names live in
 * `domain/booking/rentalBookingState.js` and must be applied through
 * `canTransitionRentalState` / `applyRentalStateTransition`.
 *
 * Canonical product workflow: domain/booking/ROVARO_MARKETPLACE_WORKFLOW.md
 * Contractor calendar/table: domain/admin/ROVARO_CONTRACTOR_ADMIN.md
 *
 * Spain MARKETPLACE_REQUEST mapping:
 *   PENDING_SUPPLIER_CONFIRMATION  — AWAITING_SUPPLIER_RESPONSE
 *   CONFIRMED_AWAITING_PAYMENT     — brief hold after Vehicle available
 *   PAYMENT_PROCESSING             — AWAITING_CUSTOMER_PAYMENT (Checkout created)
 *   BOOKING_CONFIRMED              — Stripe webhook paid only
 *   SUPPLIER_DECLINED              — Cannot provide; no Stripe link
 *   PAYMENT_EXPIRED                — unpaid link expired
 *   ALTERNATIVE_PROPOSED           — customer must accept; admin must not
 *   COMPLETED                      — rental finished / auto-closed
 *
 * Do not mass-migrate historical rows. New marketplace writes use these
 * constants; Greece ops still mostly uses legacy `confirmed` / `offline`.
 */

export const BOOKING_STATUS = {
  PENDING_SUPPLIER_CONFIRMATION: "PENDING_SUPPLIER_CONFIRMATION",
  ALTERNATIVE_PROPOSED: "ALTERNATIVE_PROPOSED",
  ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT:
    "ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT",
  SUPPLIER_DECLINED: "SUPPLIER_DECLINED",
  NO_AVAILABILITY: "NO_AVAILABILITY",
  CONFIRMED_AWAITING_PAYMENT: "CONFIRMED_AWAITING_PAYMENT",
  PAYMENT_PROCESSING: "PAYMENT_PROCESSING",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  COMPLETED: "COMPLETED",
  CUSTOMER_CANCELLED: "CUSTOMER_CANCELLED",
  SUPPLIER_CANCELLED: "SUPPLIER_CANCELLED",
  ADMIN_CANCELLED: "ADMIN_CANCELLED",
};

export const HARD_BLOCKING_BOOKING_STATUSES = [
  BOOKING_STATUS.CONFIRMED_AWAITING_PAYMENT,
  BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
  BOOKING_STATUS.PAYMENT_PROCESSING,
  BOOKING_STATUS.BOOKING_CONFIRMED,
  BOOKING_STATUS.COMPLETED,
];

export const NON_BLOCKING_BOOKING_STATUSES = [
  BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
  BOOKING_STATUS.ALTERNATIVE_PROPOSED,
  BOOKING_STATUS.SUPPLIER_DECLINED,
  BOOKING_STATUS.NO_AVAILABILITY,
  BOOKING_STATUS.PAYMENT_EXPIRED,
  BOOKING_STATUS.CUSTOMER_CANCELLED,
  BOOKING_STATUS.SUPPLIER_CANCELLED,
  BOOKING_STATUS.ADMIN_CANCELLED,
];

const HARD_SET = new Set(HARD_BLOCKING_BOOKING_STATUSES);
const NON_SET = new Set(NON_BLOCKING_BOOKING_STATUSES);

export function isHardBlockingBookingStatus(status) {
  return HARD_SET.has(String(status || "").trim());
}

export function isNonBlockingBookingStatus(status) {
  return NON_SET.has(String(status || "").trim());
}
