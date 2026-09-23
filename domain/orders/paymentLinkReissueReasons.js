export const PAYMENT_LINK_REISSUE_REASONS = Object.freeze({
  PAYMENT_LINK_EXPIRED: "payment_link_expired",
  CUSTOMER_REQUESTED: "customer_requested",
  PREVIOUS_CHECKOUT_FAILED: "previous_checkout_failed",
  TECHNICAL_RETRY: "technical_retry",
  OTHER: "other",
});

const REASON_SET = new Set(Object.values(PAYMENT_LINK_REISSUE_REASONS));

export function normalizeReissueReason(value) {
  const raw = String(value || "").trim();
  return REASON_SET.has(raw) ? raw : "";
}
