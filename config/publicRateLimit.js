/**
 * Rate limits for public POST endpoints (contact form, transfers).
 * Mirrors orderGuard env-tunable style; no magic numbers in routes.
 */

module.exports = {
  CONTACT_RATE_LIMIT_MAX: parseInt(
    process.env.CONTACT_RATE_LIMIT_MAX || "5",
    10
  ),
  CONTACT_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.CONTACT_RATE_LIMIT_WINDOW_SEC || "600",
    10
  ),
  CONTACT_RATE_LIMIT_COLLECTION: "contactRateLimit",

  TRANSFER_RATE_LIMIT_MAX: parseInt(
    process.env.TRANSFER_RATE_LIMIT_MAX || "5",
    10
  ),
  TRANSFER_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.TRANSFER_RATE_LIMIT_WINDOW_SEC || "600",
    10
  ),
  TRANSFER_RATE_LIMIT_COLLECTION: "transferRateLimit",

  QUOTE_RATE_LIMIT_MAX: parseInt(
    process.env.TRANSFER_QUOTE_RATE_LIMIT_MAX ||
      process.env.TRANSFER_RATE_LIMIT_MAX ||
      "5",
    10
  ),
  QUOTE_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.TRANSFER_QUOTE_RATE_LIMIT_WINDOW_SEC ||
      process.env.TRANSFER_RATE_LIMIT_WINDOW_SEC ||
      "600",
    10
  ),
  QUOTE_RATE_LIMIT_COLLECTION: "transferQuoteRateLimit",

  RENTAL_QUOTE_RATE_LIMIT_MAX: parseInt(
    process.env.RENTAL_QUOTE_RATE_LIMIT_MAX || "20",
    10
  ),
  RENTAL_QUOTE_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.RENTAL_QUOTE_RATE_LIMIT_WINDOW_SEC || "60",
    10
  ),
  RENTAL_QUOTE_RATE_LIMIT_COLLECTION: "rentalQuoteRateLimit",

  SEND_EMAIL_RATE_LIMIT_MAX: parseInt(
    process.env.SEND_EMAIL_RATE_LIMIT_MAX || "10",
    10
  ),
  SEND_EMAIL_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.SEND_EMAIL_RATE_LIMIT_WINDOW_SEC || "600",
    10
  ),
  SEND_EMAIL_RATE_LIMIT_COLLECTION: "sendEmailRateLimit",

  /** Partner clicking "Confirm availability" from an emailed link. */
  BOOKING_CONFIRM_RATE_LIMIT_MAX: parseInt(
    process.env.BOOKING_CONFIRM_RATE_LIMIT_MAX || "20",
    10
  ),
  BOOKING_CONFIRM_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.BOOKING_CONFIRM_RATE_LIMIT_WINDOW_SEC || "600",
    10
  ),
  BOOKING_CONFIRM_RATE_LIMIT_COLLECTION: "bookingConfirmRateLimit",

  /** Signing the Master Partner Agreement — rare by nature. */
  AGREEMENT_ACCEPT_RATE_LIMIT_MAX: parseInt(
    process.env.AGREEMENT_ACCEPT_RATE_LIMIT_MAX || "5",
    10
  ),
  AGREEMENT_ACCEPT_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.AGREEMENT_ACCEPT_RATE_LIMIT_WINDOW_SEC || "600",
    10
  ),
  AGREEMENT_ACCEPT_RATE_LIMIT_COLLECTION: "agreementAcceptRateLimit",

  /** Customer accepting or declining an alternative vehicle offer. */
  ALTERNATIVE_DECISION_RATE_LIMIT_MAX: parseInt(
    process.env.ALTERNATIVE_DECISION_RATE_LIMIT_MAX || "20",
    10
  ),
  ALTERNATIVE_DECISION_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.ALTERNATIVE_DECISION_RATE_LIMIT_WINDOW_SEC || "600",
    10
  ),
  ALTERNATIVE_DECISION_RATE_LIMIT_COLLECTION: "alternativeDecisionRateLimit",

  /**
   * Driving licence retention job trigger. Secret-protected, so the limit is
   * there to blunt secret guessing, not to throttle the scheduler itself —
   * one run a day needs a single point.
   */
  RETENTION_JOB_RATE_LIMIT_MAX: parseInt(
    process.env.RETENTION_JOB_RATE_LIMIT_MAX || "10",
    10
  ),
  RETENTION_JOB_RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.RETENTION_JOB_RATE_LIMIT_WINDOW_SEC || "600",
    10
  ),
  RETENTION_JOB_RATE_LIMIT_COLLECTION: "retentionJobRateLimit",
};
