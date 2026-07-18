/**
 * Order guard configuration.
 * All limits and durations are centralized so tuning doesn't require code changes.
 * No magic numbers in middleware or services.
 */

module.exports = {
  /** Rate limit: max requests per window (per IP or fingerprint). */
  RATE_LIMIT_MAX: parseInt(process.env.ORDER_GUARD_RATE_LIMIT_MAX || "5", 10),

  /** Rate limit window in seconds. */
  RATE_LIMIT_WINDOW_SEC: parseInt(
    process.env.ORDER_GUARD_RATE_LIMIT_WINDOW_SEC || "600",
    10
  ),

  /** Abuse: max identical payloads (same hash) in window before auto-ban. */
  ABUSE_IDENTICAL_PAYLOAD_MAX: parseInt(
    process.env.ORDER_GUARD_ABUSE_IDENTICAL_MAX || "3",
    10
  ),

  /** Abuse: max failed/conflict attempts in window before auto-ban. */
  ABUSE_FAILED_ATTEMPTS_MAX: parseInt(
    process.env.ORDER_GUARD_ABUSE_FAILED_MAX || "10",
    10
  ),

  /** Abuse: time window in seconds for counting attempts. */
  ABUSE_WINDOW_SEC: parseInt(
    process.env.ORDER_GUARD_ABUSE_WINDOW_SEC || "900",
    10
  ),

  /** Auto-ban duration in seconds when suspicious activity is detected. */
  AUTO_BAN_DURATION_SEC: parseInt(
    process.env.ORDER_GUARD_AUTO_BAN_DURATION_SEC || "3600",
    10
  ),

  /** MongoDB collection name for rate limit state (stateless = store in DB). */
  RATE_LIMIT_COLLECTION: "orderRateLimit",

  /** MongoDB collection name for abuse attempt history. */
  ABUSE_ATTEMPTS_COLLECTION: "orderAttempts",
};
