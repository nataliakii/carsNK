/**
 * Customer-facing replacement copy. Safe for client components.
 * Offering a replacement does not charge the Booking Fee.
 */

export const REPLACEMENT_SOURCE = Object.freeze({
  COMPANY_VEHICLE: "COMPANY_VEHICLE",
  EXTERNAL_VEHICLE: "EXTERNAL_VEHICLE",
  GUARANTEED_CLASS: "GUARANTEED_CLASS",
});

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
