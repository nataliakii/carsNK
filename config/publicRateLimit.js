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
};
