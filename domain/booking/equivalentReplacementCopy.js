/**
 * Customer-facing replacement copy. Safe for client components.
 * Offering a replacement does not charge the Booking Fee.
 */

/**
 * A replacement is either one named car out of this company's fleet, or a
 * commitment to an equivalent whose exact model is confirmed later. Naming an
 * unlisted car and guaranteeing a class used to be separate options, but both
 * are the same promise — same or higher class, same transmission, same price,
 * model to follow — so they are one.
 */
export const REPLACEMENT_SOURCE = Object.freeze({
  COMPANY_VEHICLE: "COMPANY_VEHICLE",
  GUARANTEED_EQUIVALENT: "GUARANTEED_EQUIVALENT",
});

export const REPLACEMENT_SOURCES = Object.freeze(Object.values(REPLACEMENT_SOURCE));

/** Rows written while the promise had two names still resolve to the one. */
const MERGED_REPLACEMENT_SOURCE = Object.freeze({
  EXTERNAL_VEHICLE: REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT,
  GUARANTEED_CLASS: REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT,
});

/**
 * @returns {string} a canonical replacement source, or "" when the value is
 * not one the rules accept. Callers must reject "" rather than default it.
 */
export function resolveReplacementSource(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return REPLACEMENT_SOURCE[raw] || MERGED_REPLACEMENT_SOURCE[raw] || "";
}

/**
 * Stored on the proposal in place of a make and model the supplier has not
 * named yet. The guarantees beside it are what the customer is promised.
 */
export const GUARANTEED_EQUIVALENT_MODEL = "Guaranteed same or higher class";

export function equivalentReplacementDisclosure({ vehicle, transmission, seats }) {
  return `The originally requested ${vehicle} is unavailable. The supplier offers a guaranteed vehicle of the same or a higher class, with ${transmission} transmission, at least ${seats} seats, for the same total rental price. The exact make and model may differ.`;
}

export function equivalentReplacementPayCta(bookingFee) {
  return `Accept replacement and pay ${bookingFee}`;
}

/** The fee is charged only after the customer has seen the disclosure and accepted. */
export function replacementMayChargeBookingFee({ acceptedByCustomer, disclosureShown } = {}) {
  return acceptedByCustomer === true && disclosureShown === true;
}

export function replacementAcceptanceOnVerifiedPayment(order, paidAt) {
  const pending = order?.pendingReplacementProposal;
  if (!pending?.checksum) return {};
  return {
    replacementProposalAcceptedChecksum: pending.checksum,
    replacementProposalAcceptedVersion: pending.version || 1,
    replacementProposalAcceptedOfferId: pending.offerId || "",
    replacementProposalAcceptedAt: paidAt,
  };
}
