import { consumeFor } from "@/services/rateLimitService";
import { extractClientContext } from "@/middleware/orderGuard";
import publicRateLimit from "@config/publicRateLimit";

export function publicClientRateLimitKey(request) {
  const { ip, fingerprint, userAgent } = extractClientContext(request);
  if (fingerprint && fingerprint.length > 0) return `fp:${fingerprint}`;
  if (ip && ip !== "unknown") return `ip:${ip}`;
  return `ua:${userAgent || "na"}`;
}

/**
 * @returns {Promise<null | { status: number, body: object }>}
 */
export async function consumePublicPostOrError(request, options) {
  try {
    await consumeFor(publicClientRateLimitKey(request), options);
    return null;
  } catch (err) {
    if (err && err.message === "RATE_LIMIT") {
      return {
        status: 429,
        body: {
          success: false,
          message: "Too many requests",
          code: "RATE_LIMIT",
        },
      };
    }
    console.error("[publicPostRateLimit] check failed", err?.message || err);
    return {
      status: 503,
      body: {
        success: false,
        message: "Service unavailable",
        code: "SERVICE_UNAVAILABLE",
      },
    };
  }
}

export function transferRateLimitOptions() {
  return {
    tableName: publicRateLimit.TRANSFER_RATE_LIMIT_COLLECTION,
    keyPrefix: "transfer",
    points: publicRateLimit.TRANSFER_RATE_LIMIT_MAX,
    duration: publicRateLimit.TRANSFER_RATE_LIMIT_WINDOW_SEC,
  };
}

export function contactRateLimitOptions() {
  return {
    tableName: publicRateLimit.CONTACT_RATE_LIMIT_COLLECTION,
    keyPrefix: "contact",
    points: publicRateLimit.CONTACT_RATE_LIMIT_MAX,
    duration: publicRateLimit.CONTACT_RATE_LIMIT_WINDOW_SEC,
  };
}

export function quoteRateLimitOptions() {
  return {
    tableName: publicRateLimit.QUOTE_RATE_LIMIT_COLLECTION,
    keyPrefix: "transfer_quote",
    points: publicRateLimit.QUOTE_RATE_LIMIT_MAX,
    duration: publicRateLimit.QUOTE_RATE_LIMIT_WINDOW_SEC,
  };
}

export function rentalQuoteRateLimitOptions() {
  return {
    tableName: publicRateLimit.RENTAL_QUOTE_RATE_LIMIT_COLLECTION,
    keyPrefix: "rental_quote",
    points: publicRateLimit.RENTAL_QUOTE_RATE_LIMIT_MAX,
    duration: publicRateLimit.RENTAL_QUOTE_RATE_LIMIT_WINDOW_SEC,
  };
}

export function bookingConfirmRateLimitOptions() {
  return {
    tableName: publicRateLimit.BOOKING_CONFIRM_RATE_LIMIT_COLLECTION,
    keyPrefix: "booking_confirm",
    points: publicRateLimit.BOOKING_CONFIRM_RATE_LIMIT_MAX,
    duration: publicRateLimit.BOOKING_CONFIRM_RATE_LIMIT_WINDOW_SEC,
  };
}

export function agreementAcceptRateLimitOptions() {
  return {
    tableName: publicRateLimit.AGREEMENT_ACCEPT_RATE_LIMIT_COLLECTION,
    keyPrefix: "agreement_accept",
    points: publicRateLimit.AGREEMENT_ACCEPT_RATE_LIMIT_MAX,
    duration: publicRateLimit.AGREEMENT_ACCEPT_RATE_LIMIT_WINDOW_SEC,
  };
}

export function alternativeDecisionRateLimitOptions() {
  return {
    tableName: publicRateLimit.ALTERNATIVE_DECISION_RATE_LIMIT_COLLECTION,
    keyPrefix: "alternative_decision",
    points: publicRateLimit.ALTERNATIVE_DECISION_RATE_LIMIT_MAX,
    duration: publicRateLimit.ALTERNATIVE_DECISION_RATE_LIMIT_WINDOW_SEC,
  };
}

export function retentionJobRateLimitOptions() {
  return {
    tableName: publicRateLimit.RETENTION_JOB_RATE_LIMIT_COLLECTION,
    keyPrefix: "retention_job",
    points: publicRateLimit.RETENTION_JOB_RATE_LIMIT_MAX,
    duration: publicRateLimit.RETENTION_JOB_RATE_LIMIT_WINDOW_SEC,
  };
}

export function sendEmailRateLimitOptions() {
  return {
    tableName: publicRateLimit.SEND_EMAIL_RATE_LIMIT_COLLECTION,
    keyPrefix: "send_email",
    points: publicRateLimit.SEND_EMAIL_RATE_LIMIT_MAX,
    duration: publicRateLimit.SEND_EMAIL_RATE_LIMIT_WINDOW_SEC,
  };
}
