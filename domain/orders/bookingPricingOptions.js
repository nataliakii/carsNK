import { canonicalizeCustomerBookingLocation } from "./halkidikiBookingLocations";

export function normalizeDeliveryPricingLocation(value) {
  return (
    canonicalizeCustomerBookingLocation(value) ||
    String(value || "").trim() ||
    undefined
  );
}
