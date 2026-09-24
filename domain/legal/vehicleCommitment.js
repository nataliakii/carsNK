/**
 * Confirmed vehicle and price. A rejected supplier-controlled change refunds
 * the Booking Fee. There is no automatic penalty equal to the full rental price.
 */

export const VEHICLE_COMMITMENT_TEXT =
  "The supplier must provide the confirmed vehicle. If the confirmed vehicle becomes unavailable, the supplier may offer the same or a higher class at the same price. Any replacement requires the customer's explicit agreement. The supplier may not increase the confirmed price without the customer's explicit agreement. If the customer rejects a changed vehicle or price, the booking is cancelled and the Booking Fee is refunded in full. The supplier reimburses Rovaro for the refunded Booking Fee where the failure was within the supplier's control. Repeated or serious failures may result in listing restrictions, suspension or termination. This does not impose an automatic penalty equal to the full rental price.";

const CLASS_RANK = Object.freeze({
  economy: 1,
  compact: 2,
  intermediate: 3,
  standard: 4,
  fullsize: 5,
  premium: 6,
  luxury: 7,
  suv: 5,
  van: 5,
});

function rank(vehicleClass) {
  const key = String(vehicleClass || "")
    .toLowerCase()
    .trim();
  return CLASS_RANK[key] || 0;
}

export function evaluateVehicleChange({
  originalClass,
  offeredClass,
  originalPriceMinor,
  offeredPriceMinor,
  customerAccepted = false,
  withinSupplierControl = true,
}) {
  const sameOrHigher =
    String(originalClass) === String(offeredClass) ||
    rank(offeredClass) >= rank(originalClass);
  const samePrice = Number(offeredPriceMinor) === Number(originalPriceMinor);
  const priceIncreased = Number(offeredPriceMinor) > Number(originalPriceMinor);
  const lawfulOffer = sameOrHigher && samePrice && !priceIncreased;

  if (!customerAccepted) {
    return {
      allowed: false,
      bookingCancelled: true,
      bookingFeeRefund: "full",
      supplierReimbursesBookingFee: Boolean(withinSupplierControl),
      automaticFullRentalPenalty: false,
      reason: lawfulOffer ? "customer_rejected" : "change_not_agreed",
    };
  }

  if (!lawfulOffer) {
    return {
      allowed: false,
      bookingCancelled: true,
      bookingFeeRefund: "full",
      supplierReimbursesBookingFee: Boolean(withinSupplierControl),
      automaticFullRentalPenalty: false,
      reason: priceIncreased ? "price_increase" : "lower_class",
    };
  }

  return {
    allowed: true,
    bookingCancelled: false,
    bookingFeeRefund: "none",
    supplierReimbursesBookingFee: false,
    automaticFullRentalPenalty: false,
    reason: "customer_agreed",
  };
}
