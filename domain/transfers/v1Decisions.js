/**
 * Locked v1 decisions for standalone transfer bookings (section 9 of audit).
 *
 * Payment timing: quote → submit → claim → Stripe Checkout → webhook → CONFIRMED
 * Markets: both GR and ES (country-scoped rules).
 * Pricing: platform-managed (customerPrice / supplierPayout / platformMargin).
 * Rental bundling: later (linkedOrderId reserved).
 * Cancellation: free cancel before claim; after claim admin-controlled.
 */

export const TRANSFER_V1_DECISIONS = {
  paymentSequence: "after_claim",
  paymentImplemented: true,
  paymentProvider: "stripe",
  markets: ["GR", "ES"],
  pricingModel: "platform_managed",
  rentalBundling: "later",
  freeCancelBeforeClaim: true,
};

export default TRANSFER_V1_DECISIONS;
