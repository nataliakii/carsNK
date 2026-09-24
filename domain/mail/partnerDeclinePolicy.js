/**
 * Structured partner decline reasons + display-only platform recommendations.
 * Recommendations NEVER auto-refund; only SUPERADMIN may approve a voluntary refund.
 */

export const PARTNER_DECLINE_REASON = Object.freeze({
  VEHICLE_UNAVAILABLE: "vehicle_unavailable",
  DATES_UNAVAILABLE: "dates_unavailable",
  CUSTOMER_REQUIREMENTS: "customer_does_not_meet_requirements",
  DOCUMENTS_NOT_ACCEPTABLE: "documents_not_acceptable",
  INCORRECT_LISTING_OR_PRICE: "incorrect_listing_or_price",
  SAFETY_OR_FRAUD: "safety_or_fraud_concern",
  OTHER: "other",
});

export const PARTNER_DECLINE_REASONS = Object.values(PARTNER_DECLINE_REASON);

export const PLATFORM_REFUND_RECOMMENDATION = Object.freeze({
  KEEP_FEE_OFFER_ALTERNATIVE: "keep_fee_offer_alternative",
  OFFER_ANOTHER_VEHICLE: "offer_another_vehicle_or_supplier",
  REFUND_BOOKING_FEE: "refund_booking_fee",
  MANUAL_REVIEW: "manual_review",
});

const LABELS_EN = Object.freeze({
  [PARTNER_DECLINE_REASON.VEHICLE_UNAVAILABLE]: "Vehicle unavailable",
  [PARTNER_DECLINE_REASON.DATES_UNAVAILABLE]: "Dates unavailable",
  [PARTNER_DECLINE_REASON.CUSTOMER_REQUIREMENTS]:
    "Customer does not meet rental requirements",
  [PARTNER_DECLINE_REASON.DOCUMENTS_NOT_ACCEPTABLE]: "Documents not acceptable",
  [PARTNER_DECLINE_REASON.INCORRECT_LISTING_OR_PRICE]: "Incorrect listing or price",
  [PARTNER_DECLINE_REASON.SAFETY_OR_FRAUD]: "Safety or fraud concern",
  [PARTNER_DECLINE_REASON.OTHER]: "Other",
  [PLATFORM_REFUND_RECOMMENDATION.KEEP_FEE_OFFER_ALTERNATIVE]:
    "Keep fee and offer alternative — customer-caused / does not meet disclosed requirements",
  [PLATFORM_REFUND_RECOMMENDATION.OFFER_ANOTHER_VEHICLE]:
    "Offer another vehicle/supplier — car unavailable but alternative may exist",
  [PLATFORM_REFUND_RECOMMENDATION.REFUND_BOOKING_FEE]:
    "Refund booking fee — company cannot fulfil / wrong listing or price / law requires",
  [PLATFORM_REFUND_RECOMMENDATION.MANUAL_REVIEW]:
    "Manual review — fraud/safety/unclear docs/conflict",
});

/**
 * @param {string} raw
 * @param {string} [explanation]
 * @returns {{ ok: true, code: string, explanation: string } | { ok: false, code: string, message: string }}
 */
export function normalizePartnerDeclineReason(raw, explanation = "") {
  const code = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!PARTNER_DECLINE_REASONS.includes(code)) {
    return {
      ok: false,
      code: "invalid_decline_reason",
      message:
        "A structured decline reason is required (vehicle unavailable, dates unavailable, etc.).",
    };
  }
  const note = String(explanation || "").trim().slice(0, 1000);
  if (code === PARTNER_DECLINE_REASON.OTHER && !note) {
    return {
      ok: false,
      code: "explanation_required",
      message: "An explanation is required when the decline reason is Other.",
    };
  }
  return { ok: true, code, explanation: note };
}

/**
 * Display-only recommendation. Never triggers Stripe refunds.
 *
 * @param {{
 *   reasonCode: string,
 *   feePaid?: boolean,
 *   alternativeAvailable?: boolean,
 *   bookingAlreadyAccepted?: boolean,
 * }} input
 */
export function recommendPartnerDeclineAction({
  reasonCode,
  feePaid = false,
  alternativeAvailable = false,
  bookingAlreadyAccepted = false,
} = {}) {
  const code = String(reasonCode || "");
  let recommendation = PLATFORM_REFUND_RECOMMENDATION.MANUAL_REVIEW;

  if (
    code === PARTNER_DECLINE_REASON.CUSTOMER_REQUIREMENTS ||
    code === PARTNER_DECLINE_REASON.DOCUMENTS_NOT_ACCEPTABLE
  ) {
    recommendation = PLATFORM_REFUND_RECOMMENDATION.KEEP_FEE_OFFER_ALTERNATIVE;
  } else if (
    code === PARTNER_DECLINE_REASON.VEHICLE_UNAVAILABLE ||
    code === PARTNER_DECLINE_REASON.DATES_UNAVAILABLE
  ) {
    recommendation = alternativeAvailable
      ? PLATFORM_REFUND_RECOMMENDATION.OFFER_ANOTHER_VEHICLE
      : feePaid && bookingAlreadyAccepted
        ? PLATFORM_REFUND_RECOMMENDATION.REFUND_BOOKING_FEE
        : PLATFORM_REFUND_RECOMMENDATION.OFFER_ANOTHER_VEHICLE;
  } else if (code === PARTNER_DECLINE_REASON.INCORRECT_LISTING_OR_PRICE) {
    recommendation = PLATFORM_REFUND_RECOMMENDATION.REFUND_BOOKING_FEE;
  } else if (code === PARTNER_DECLINE_REASON.SAFETY_OR_FRAUD) {
    recommendation = PLATFORM_REFUND_RECOMMENDATION.MANUAL_REVIEW;
  } else if (code === PARTNER_DECLINE_REASON.OTHER) {
    recommendation = PLATFORM_REFUND_RECOMMENDATION.MANUAL_REVIEW;
  }

  // Partner decline never auto-refunds — recommendation is advisory only.
  return {
    recommendation,
    label: LABELS_EN[recommendation] || recommendation,
    autoRefund: false,
    finalDecision: false,
    note:
      "Platform recommendation only. The Rovaro booking fee is non-refundable by default. Only a SUPERADMIN may approve a voluntary refund.",
  };
}

export function partnerDeclineReasonLabel(code) {
  return LABELS_EN[code] || String(code || "");
}

/** Company must not promise refunds or say the fee is retained as final. */
export const COMPANY_DECLINE_CONFIRMATION_DISCLAIMER =
  "Rovaro handles any payment decision. Do not promise a refund or tell the customer the fee is retained.";
