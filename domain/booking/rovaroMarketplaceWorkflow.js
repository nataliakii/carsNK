/**
 * Canonical Rovaro marketplace booking workflow.
 *
 * Full narrative: ./ROVARO_MARKETPLACE_WORKFLOW.md
 *
 * MARKETPLACE_REQUEST only. Internal company-calendar bookings
 * (`my_order !== true`) are outside this workflow and must not receive a
 * Booking Fee, Stripe link, or Rovaro payouts.
 *
 * Storage still uses BOOKING_STATUS in bookingStatus.js. UI, emails, bells
 * and buttons must speak the canonical stage names below and must not skip
 * stages or treat legacy `order.confirmed` as a parallel confirmation.
 */

import { BOOKING_STATUS } from "./bookingStatus";

/** Product-facing stages. Do not persist these strings on bookingStatus. */
export const CANONICAL_STAGE = Object.freeze({
  AWAITING_SUPPLIER_RESPONSE: "AWAITING_SUPPLIER_RESPONSE",
  AWAITING_CUSTOMER_PAYMENT: "AWAITING_CUSTOMER_PAYMENT",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  RENTAL_IN_PROGRESS: "RENTAL_IN_PROGRESS",
  RETURN_EXPECTED: "RETURN_EXPECTED",
  COMPLETED: "COMPLETED",
  SUPPLIER_DECLINED: "SUPPLIER_DECLINED",
  ALTERNATIVE_PROPOSED: "ALTERNATIVE_PROPOSED",
  REPLACED_BY_ALTERNATIVE: "REPLACED_BY_ALTERNATIVE",
});

/**
 * Canonical stage → stored `order.bookingStatus`.
 * Brief hold after Vehicle available (before Checkout exists) still uses
 * CONFIRMED_AWAITING_PAYMENT; the customer-facing stage is already
 * AWAITING_CUSTOMER_PAYMENT once the Stripe link is created (PAYMENT_PROCESSING).
 */
export const CANONICAL_STAGE_TO_BOOKING_STATUS = Object.freeze({
  [CANONICAL_STAGE.AWAITING_SUPPLIER_RESPONSE]:
    BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
  [CANONICAL_STAGE.AWAITING_CUSTOMER_PAYMENT]:
    BOOKING_STATUS.PAYMENT_PROCESSING,
  [CANONICAL_STAGE.BOOKING_CONFIRMED]: BOOKING_STATUS.BOOKING_CONFIRMED,
  [CANONICAL_STAGE.COMPLETED]: BOOKING_STATUS.COMPLETED,
  [CANONICAL_STAGE.SUPPLIER_DECLINED]: BOOKING_STATUS.SUPPLIER_DECLINED,
  [CANONICAL_STAGE.ALTERNATIVE_PROPOSED]: BOOKING_STATUS.ALTERNATIVE_PROPOSED,
});

/** Planned stored values not yet on BOOKING_STATUS. Do not invent them in UI. */
export const CANONICAL_STAGES_NOT_YET_STORED = Object.freeze([
  CANONICAL_STAGE.RENTAL_IN_PROGRESS,
  CANONICAL_STAGE.RETURN_EXPECTED,
  CANONICAL_STAGE.REPLACED_BY_ALTERNATIVE,
]);

export const WORKFLOW_INVARIANTS = Object.freeze([
  "Stripe Checkout for Booking Fee is created only after supplier Vehicle available.",
  "order.confirmed on marketplace means BOOKING_CONFIRMED after Stripe webhook paid. Never set it from Vehicle available.",
  "Stripe webhook is the only source of truth for payment success. Success page must not confirm the booking.",
  "Until payment.paid: contractor cannot see client contacts or driving licence.",
  "Superadmin may see client data for review. Contractor may not, until paid.",
  "Email failure must not roll back a saved order or a recorded payment.",
  "Repeat webhooks must not resend paid emails or rewrite a paid order.",
  "Every supplier action, payment event and auto-close is audit-logged.",
  "Expired payment links may be reissued by superadmin only.",
  "A declined or replaced request cannot be paid.",
  "After payment, vehicle/price/material changes require customer consent.",
  "Driving licence is required before the initial request is submitted.",
  "Admin must not accept an alternative on behalf of the customer.",
  "Internal calendar bookings are not this workflow.",
]);
