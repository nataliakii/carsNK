import mongoose from "mongoose";

/**
 * An alternative vehicle proposed by the supplier when the booked vehicle
 * cannot be provided.
 *
 * The offer is a proposal only. Nothing about the booking changes until the
 * customer explicitly accepts, which is enforced by
 * `domain/booking/alternativeVehicle.js` rather than by convention.
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

    /** Everything the customer needs to judge the substitution. */
    vehicle: {
      carId: { type: String, default: "" },
      make: { type: String, default: "" },
      model: { type: String, required: true },
      category: { type: String, default: "" },
      transmission: { type: String, default: "" },
      seats: { type: Number, default: null },
      luggage: { type: Number, default: null },
      /** Exact year, or a model group when the exact year is not fixed. */
      year: { type: Number, default: null },
      modelGroup: { type: String, default: "" },
      photos: { type: [String], default: [] },
      mileagePolicy: { type: String, default: "" },
    },

    /** Minor units, server-calculated. Must not exceed the original price. */
    priceMinor: { type: Number, required: true },
    currency: { type: String, default: "EUR" },
    originalPriceMinor: { type: Number, required: true },
    depositMinor: { type: Number, default: null },
    insurance: { type: String, default: "" },

    pickup: {
      atUtc: { type: Date, default: null },
      place: { type: String, default: "" },
      detail: { type: String, default: "" },
    },

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

    /** True when the original vehicle was already paid for. */
    afterPayment: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "alternative_vehicle_offers" }
);

const AlternativeVehicleOffer =
  mongoose.models?.AlternativeVehicleOffer ||
  mongoose.model("AlternativeVehicleOffer", alternativeVehicleOfferSchema);

export default AlternativeVehicleOffer;
