import mongoose from "mongoose";
import { locationSnapshotSchemaDefinition } from "@/domain/transfers/locationSnapshot";

export const PRICING_RULE_KINDS = {
  FIXED_ROUTE: "FIXED_ROUTE",
  ZONE_PAIR: "ZONE_PAIR",
  CITY_FORMULA: "CITY_FORMULA",
};

export const PRICING_METHODS = {
  FIXED_ROUTE: "FIXED_ROUTE",
  ZONE_PAIR: "ZONE_PAIR",
  DISTANCE_FORMULA: "DISTANCE_FORMULA",
  MANUAL: "MANUAL",
};

const LocationRefSchema = new mongoose.Schema(
  {
    ...locationSnapshotSchemaDefinition,
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransferZone",
      default: null,
    },
  },
  { _id: false }
);

const TransferPricingRuleSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: Object.values(PRICING_RULE_KINDS),
      required: true,
      index: true,
    },
    name: { type: String, default: "", trim: true },
    country: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    currency: { type: String, default: "EUR", uppercase: true },
    vehicleCategory: { type: String, default: "STANDARD", uppercase: true },
    /** one_way | return | both */
    direction: {
      type: String,
      enum: ["one_way", "return", "both"],
      default: "both",
    },
    /** For FIXED_ROUTE */
    origin: { type: LocationRefSchema, default: undefined },
    destination: { type: LocationRefSchema, default: undefined },
    /** For ZONE_PAIR */
    originZoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransferZone",
      default: null,
      index: true,
    },
    destinationZoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransferZone",
      default: null,
      index: true,
    },
    /** For CITY_FORMULA */
    city: { type: String, default: "", trim: true },
    serviceRadiusKm: { type: Number, default: null, min: 0 },

    customerPriceMinor: { type: Number, default: null, min: 0 },
    supplierPayoutMinor: { type: Number, default: null, min: 0 },

    baseFareMinor: { type: Number, default: 0, min: 0 },
    minimumFareMinor: { type: Number, default: 0, min: 0 },
    includedDistanceKm: { type: Number, default: 0, min: 0 },
    pricePerKmMinor: { type: Number, default: 0, min: 0 },
    includedDurationMinutes: { type: Number, default: 0, min: 0 },
    pricePerMinuteMinor: { type: Number, default: 0, min: 0 },
    roundingIncrementMinor: { type: Number, default: 1, min: 1 },
    vehicleCategoryMultiplier: { type: Number, default: 1, min: 0 },
    vehicleCategoryFixedAdjustmentMinor: { type: Number, default: 0 },
    airportPickupFeeMinor: { type: Number, default: 0, min: 0 },
    airportDropoffFeeMinor: { type: Number, default: 0, min: 0 },
    portFeeMinor: { type: Number, default: 0, min: 0 },
    railwayStationFeeMinor: { type: Number, default: 0, min: 0 },
    nightStartTime: { type: String, default: "22:00" },
    nightEndTime: { type: String, default: "06:00" },
    nightSurchargeType: {
      type: String,
      enum: ["fixed", "percent"],
      default: "fixed",
    },
    nightSurchargeValue: { type: Number, default: 0, min: 0 },
    holidaySurchargeMinor: { type: Number, default: 0, min: 0 },
    weekendSurchargeMinor: { type: Number, default: 0, min: 0 },
    additionalStopFeeMinor: { type: Number, default: 0, min: 0 },
    includedWaitingMinutes: { type: Number, default: 0, min: 0 },
    waitingPricePerMinuteMinor: { type: Number, default: 0, min: 0 },
    flightDelayWaitingPolicy: { type: String, default: "", trim: true },
    childSeatFeeMinor: { type: Number, default: 0, min: 0 },
    boosterSeatFeeMinor: { type: Number, default: 0, min: 0 },
    oversizedLuggageFeeMinor: { type: Number, default: 0, min: 0 },
    tollHandling: {
      type: String,
      enum: ["include", "exclude", "pass_through"],
      default: "include",
    },
    maximumAutomaticDistanceKm: { type: Number, default: null, min: 0 },
    manualQuoteThresholdKm: { type: Number, default: null, min: 0 },

    includedPassengers: { type: Number, default: 3, min: 1 },
    includedStandardLuggage: { type: Number, default: 2, min: 0 },
    includedCabinBags: { type: Number, default: 2, min: 0 },
    additionalPassengerFeeMinor: { type: Number, default: 0, min: 0 },

    priority: { type: Number, default: 100, index: true },
    version: { type: Number, default: 1, min: 1 },
    effectiveFrom: { type: Date, default: null },
    effectiveUntil: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    /** Soft-deactivate instead of delete; keep history. */
    deactivatedAt: { type: Date, default: null },
    duplicatedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransferPricingRule",
      default: null,
    },
  },
  { timestamps: true, collection: "transfer_pricing_rules" }
);

TransferPricingRuleSchema.index({
  kind: 1,
  country: 1,
  isActive: 1,
  priority: 1,
});

const TransferPricingRule =
  mongoose.models?.TransferPricingRule ||
  mongoose.model("TransferPricingRule", TransferPricingRuleSchema);

export default TransferPricingRule;
