import mongoose from "mongoose";

/**
 * An alternative vehicle proposed by the supplier when the booked vehicle
 * cannot be provided.
 *
 * The offer is a proposal only. Nothing about the booking changes until the
 * customer explicitly accepts, which is enforced by
 * `domain/booking/alternativeVehicle.js` rather than by convention.
 *
 * One active (`OFFERED`) row per order is enforced by a partial unique index
 * created only by `scripts/migrateAlternativeOfferIndexes.js` (`--apply`).
 * Runtime and cron must not call syncIndexes().
 */
const alternativeVehicleOfferSchema = new mongoose.Schema(
  {
    offerId: { type: String, required: true, unique: true, index: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    proposedCarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      default: null,
      index: true,
    },
    originalCarId: { type: String, default: "" },

    /** Everything the customer needs to judge the substitution. */
    vehicle: {
      carId: { type: String, default: "" },
      make: { type: String, default: "" },
      model: { type: String, required: true },
      category: { type: String, default: "" },
      transmission: { type: String, default: "" },
      seats: { type: Number, default: null },
      luggage: { type: Number, default: null },
      doors: { type: Number, default: null },
      fuel: { type: String, default: "" },
      /** Exact year, or a model group when the exact year is not fixed. */
      year: { type: Number, default: null },
      modelGroup: { type: String, default: "" },
      photos: { type: [String], default: [] },
      mileagePolicy: { type: String, default: "" },
      fuelPolicy: { type: String, default: "" },
      insuranceExcessMajor: { type: Number, default: null },
      securityDepositMajor: { type: Number, default: null },
    },

    /** Minor units, server-calculated. Must not exceed the original price. */
    priceMinor: { type: Number, required: true },
    currency: { type: String, default: "EUR" },
    originalPriceMinor: { type: Number, required: true },
    depositMinor: { type: Number, default: null },
    insurance: { type: String, default: "" },
    calculatedAlternativeGrossMinor: { type: Number, default: null },
    replacementDiscountMinor: { type: Number, default: 0 },
    offeredGrossMinor: { type: Number, default: null },
    prepaymentMinor: { type: Number, default: null },
    marketplaceBookingFeeBps: { type: Number, default: null },
    balanceMinor: { type: Number, default: null },

    pickup: {
      atUtc: { type: Date, default: null },
      place: { type: String, default: "" },
      detail: { type: String, default: "" },
    },

    originalRequest: { type: mongoose.Schema.Types.Mixed, default: null },
    proposedLocationSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    proposedAuthoritativePrice: { type: mongoose.Schema.Types.Mixed, default: null },
    snapshotChecksum: { type: String, default: "" },
    termsChanged: { type: Boolean, default: false },
    changedTerms: { type: [mongoose.Schema.Types.Mixed], default: [] },
    originalTermsHash: { type: String, default: "" },
    proposedTermsHash: { type: String, default: "" },
    termsConsent: { type: mongoose.Schema.Types.Mixed, default: null },
    availabilityNote: { type: String, default: "" },

    replacementSource: { type: String, default: "" },
    supplierMessage: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    reasonForReplacement: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },

    status: {
      type: String,
      enum: ["OFFERED", "ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN"],
      default: "OFFERED",
      index: true,
    },
    offeredAt: { type: Date, default: Date.now },
    offeredByEmail: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
    decisionIp: { type: String, default: "" },
    decisionUserAgent: { type: String, default: "" },
    declineReason: { type: String, default: "" },
    withdrawnByEmail: { type: String, default: "" },
    acceptedHoldId: { type: String, default: "" },
    stripeSessionId: { type: String, default: "" },
    checkoutUrl: { type: String, default: "" },
    paymentLinkGenerationFailed: { type: Boolean, default: false },

    sessionHistory: {
      type: [
        new mongoose.Schema(
          {
            sessionId: { type: String, default: "" },
            checkoutUrl: { type: String, default: "" },
            status: { type: String, default: "" },
            archivedAt: { type: Date, default: null },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    complianceInvalidateRetry: { type: Boolean, default: false },
    complianceInvalidateRetryAt: { type: Date, default: null },
    complianceInvalidateAttempts: { type: Number, default: 0 },
    lastInvalidateErrorCategory: { type: String, default: "" },
    lastInvalidateAttemptAt: { type: Date, default: null },
    invalidatedReason: { type: String, default: "" },
    invalidatedAt: { type: Date, default: null },

    /** True when the original vehicle was already paid for. P0 automatic flow refuses this. */
    afterPayment: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "alternative_vehicle_offers" }
);

const AlternativeVehicleOffer =
  mongoose.models?.AlternativeVehicleOffer ||
  mongoose.model("AlternativeVehicleOffer", alternativeVehicleOfferSchema);

if (
  AlternativeVehicleOffer?.schema &&
  !AlternativeVehicleOffer.schema.path("marketplaceBookingFeeBps")
) {
  AlternativeVehicleOffer.schema.add({
    marketplaceBookingFeeBps: { type: Number, default: null },
  });
}

export default AlternativeVehicleOffer;
export const ALTERNATIVE_OFFER_ACTIVE_INDEX = "orderId_1_status_offered_unique";
