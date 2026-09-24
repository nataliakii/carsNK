/**
 * Immutable legal references stored on a booking.
 * Full document bodies are not copied when version and checksum are kept.
 */

export function buildBookingLegalSnapshot({
  platform,
  privacy,
  supplierTerms = null,
  language,
  acceptedAt,
  customerEmail = "",
  ipAddress = "",
  userAgent = "",
  priceMinor,
  bookingFeeMinor,
  bookingFeePercent,
  supplierBalanceMinor,
  carId = "",
  pickup = "",
  dropoff = "",
} = {}) {
  return {
    customerBookingTerms: {
      documentType: platform?.documentType || "customer-booking-terms",
      version: Number(platform?.version || 0),
      language: language || platform?.language || "en",
      checksum: String(platform?.checksum || ""),
      acceptedAt: acceptedAt || null,
    },
    privacyPolicy: {
      documentType: "privacy-policy",
      version: Number(privacy?.version || 0),
      language: privacy?.language || language || "en",
      checksum: String(privacy?.checksum || ""),
      presentedAt: acceptedAt || null,
      contractualCheckbox: false,
    },
    supplierRentalTerms: supplierTerms
      ? {
          documentId: supplierTerms.documentId,
          version: supplierTerms.version,
          language: supplierTerms.language,
          checksum: supplierTerms.checksum,
          acceptedAt: acceptedAt || null,
        }
      : null,
    customerEmail: String(customerEmail || ""),
    ipAddress: String(ipAddress || ""),
    userAgent: String(userAgent || ""),
    priceMinor: Number(priceMinor || 0),
    bookingFeeMinor: Number(bookingFeeMinor || 0),
    bookingFeePercent: Number(bookingFeePercent || 0),
    supplierBalanceMinor: Number(supplierBalanceMinor || 0),
    carId: String(carId || ""),
    pickup: String(pickup || ""),
    dropoff: String(dropoff || ""),
    fullDocumentCopies: false,
  };
}

export function newVersionDoesNotAlterBooking(bookingSnapshot, nextPublished) {
  return {
    booking: bookingSnapshot,
    published: nextPublished,
    bookingVersion: bookingSnapshot.customerBookingTerms.version,
    publishedVersion: nextPublished.version,
    altered: false,
  };
}
