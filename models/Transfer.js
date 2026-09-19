import mongoose from "mongoose";
import { locationSnapshotSchemaDefinition } from "@/domain/transfers/locationSnapshot";
import {
  TRANSFER_STATUS,
  TRANSFER_OPEN_STATUSES,
  isTransferOpenStatus,
  defaultTransferCommissionPercent,
  defaultOfferTtlHours,
  normalizeTransferStatus,
} from "@/domain/transfers/transferStatus";
import { PRICING_METHODS } from "@models/TransferPricingRule";

export {
  TRANSFER_STATUS,
  TRANSFER_OPEN_STATUSES,
  isTransferOpenStatus,
  defaultTransferCommissionPercent,
  defaultOfferTtlHours,
  normalizeTransferStatus,
};

const LocationSnapshotSchema = new mongoose.Schema(
  locationSnapshotSchemaDefinition,
  { _id: false }
);

const ChildPassengerSchema = new mongoose.Schema(
  {
    age: { type: Number, min: 0, max: 17, required: true },
  },
  { _id: false }
);

const SpecialLuggageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "wheelchair",
        "pushchair",
        "bicycle",
        "skis",
        "golf_bags",
        "oversized",
        "other",
      ],
      required: true,
    },
    quantity: { type: Number, default: 1, min: 1 },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const QuoteSnapshotSchema = new mongoose.Schema(
  {
    customerPriceMinor: { type: Number, required: true, min: 0 },
    supplierPayoutMinor: { type: Number, required: true, min: 0 },
    platformMarginMinor: { type: Number, required: true },
    paymentProcessingAmountMinor: { type: Number, default: 0, min: 0 },
    taxMinor: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "EUR", uppercase: true },
    pricingRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransferPricingRule",
      default: null,
    },
    pricingRuleVersion: { type: Number, default: null },
    pricingMethod: {
      type: String,
      enum: Object.values(PRICING_METHODS),
      required: true,
    },
    pricingExplanation: { type: String, default: "", trim: true },
    distanceKm: { type: Number, default: null },
    durationMinutes: { type: Number, default: null },
    appliedSurcharges: { type: [mongoose.Schema.Types.Mixed], default: [] },
    appliedDiscounts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    vehicleCategory: { type: String, default: "STANDARD" },
    passengerAssumptions: { type: mongoose.Schema.Types.Mixed, default: {} },
    luggageAssumptions: { type: mongoose.Schema.Types.Mixed, default: {} },
    calculatedAt: { type: Date, default: Date.now },
    originSnapshot: { type: LocationSnapshotSchema, default: undefined },
    destinationSnapshot: { type: LocationSnapshotSchema, default: undefined },
    isProvisional: { type: Boolean, default: false },
    adminOverrideReason: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const AssignmentHistorySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    companyName: { type: String, default: "" },
    action: {
      type: String,
      enum: ["claimed", "released", "cancelled", "manual_assign", "reopened"],
      required: true,
    },
    at: { type: Date, default: Date.now },
    byEmail: { type: String, default: "" },
    reason: { type: String, default: "" },
    supplierPayoutMinor: { type: Number, default: null },
  },
  { _id: false }
);

const ClaimAttemptSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    at: { type: Date, default: Date.now },
    result: {
      type: String,
      enum: ["success", "taken", "expired", "ineligible", "idempotent", "failed"],
      required: true,
    },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const StatusEventSchema = new mongoose.Schema(
  {
    from: { type: String, default: "" },
    to: { type: String, required: true },
    at: { type: Date, default: Date.now },
    actor: {
      type: String,
      enum: ["customer", "supplier", "admin", "system"],
      default: "system",
    },
    actorEmail: { type: String, default: "" },
    reason: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const CommunicationSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["email", "telegram", "note"], default: "email" },
    template: { type: String, default: "" },
    to: { type: [String], default: [] },
    subject: { type: String, default: "" },
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "skipped"],
      default: "sent",
    },
    at: { type: Date, default: Date.now },
    errorMessage: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: [
        "online_full",
        "online_partial",
        "pay_supplier",
        "pay_after_claim",
        "cash_driver",
        "card_driver",
        "manual_admin",
        "none",
      ],
      default: "none",
    },
    status: {
      type: String,
      enum: ["not_required", "pending", "paid", "partial", "refunded", "failed"],
      default: "not_required",
    },
    amountMinor: { type: Number, default: 0 },
    currency: { type: String, default: "EUR" },
    provider: { type: String, default: "" },
    providerPaymentId: { type: String, default: "" },
    /** Stripe Checkout Session URL (customer pay link). */
    checkoutUrl: { type: String, default: "", trim: true },
    /**
     * Snapshot of company payment policy at claim time:
     * stripe_full | stripe_platform_only | stripe_company_only | on_site
     */
    collectionMode: { type: String, default: "", trim: true },
    /** Amount still to collect on site (minor units), if any. */
    onSiteAmountMinor: { type: Number, default: 0, min: 0 },
    idempotencyKey: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const AdditionalStopSchema = new mongoose.Schema(
  {
    location: { type: LocationSnapshotSchema, default: undefined },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const TransferSchema = new mongoose.Schema(
  {
    /** Legacy display strings — kept for admin list / emails. */
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    origin: { type: LocationSnapshotSchema, default: undefined },
    destination: { type: LocationSnapshotSchema, default: undefined },

    distanceKm: { type: Number, default: null, min: 0 },
    durationMinutes: { type: Number, default: null, min: 0 },
    routeProvider: { type: String, default: "" },
    routeCalculatedAt: { type: Date, default: null },
    routeCacheKey: { type: String, default: "" },
    routeWarnings: { type: [String], default: [] },
    tollsMinor: { type: Number, default: null },

    baseFromDistanceKm: { type: Number, default: null, min: 0 },
    baseFromDurationMinutes: { type: Number, default: null, min: 0 },
    baseToDistanceKm: { type: Number, default: null, min: 0 },
    baseToDurationMinutes: { type: Number, default: null, min: 0 },

    adults: { type: Number, default: 1, min: 0, max: 50 },
    children: { type: [ChildPassengerSchema], default: [] },
    /** Total passengers (adults + children) — kept for legacy queries. */
    passengers: { type: Number, required: true, min: 1, max: 50 },

    standardSuitcases: { type: Number, default: 0, min: 0 },
    cabinBags: { type: Number, default: 0, min: 0 },
    oversizedLuggage: { type: Number, default: 0, min: 0 },
    specialLuggage: { type: [SpecialLuggageSchema], default: [] },
    childSeats: { type: Number, default: 0, min: 0 },
    boosterSeats: { type: Number, default: 0, min: 0 },

    vehicleCategory: {
      type: String,
      default: "STANDARD",
      uppercase: true,
      trim: true,
    },

    datetime: { type: Date, required: true, index: true },
    returnRequested: { type: Boolean, default: false },
    returnDatetime: { type: Date, default: null },

    flightNumber: { type: String, default: "", trim: true },
    flightArrivalTime: { type: String, default: "", trim: true },
    hotelName: { type: String, default: "", trim: true },
    signText: { type: String, default: "", trim: true },
    additionalStops: { type: [AdditionalStopSchema], default: [] },
    accessibilityRequirements: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },

    customerFirstName: { type: String, default: "", trim: true },
    customerLastName: { type: String, default: "", trim: true },
    customerName: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    phoneCountryCode: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    preferredLanguage: { type: String, default: "", trim: true },

    status: {
      type: String,
      default: TRANSFER_STATUS.OPEN_FOR_CLAIM,
      index: true,
    },
    statusEvents: { type: [StatusEventSchema], default: [] },

    locale: { type: String, default: "" },
    country: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
      default: "GR",
    },

    quoteSnapshot: { type: QuoteSnapshotSchema, default: undefined },

    /** @deprecated prefer quoteSnapshot.supplierPayoutMinor */
    platformCommissionPercent: {
      type: Number,
      default: () => defaultTransferCommissionPercent(),
      min: 0,
      max: 100,
    },

    assignedSupplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    /** Legacy alias — kept in sync with assignedSupplierId. */
    claimedByCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    claimedByEmail: { type: String, default: "", trim: true },
    claimedAt: { type: Date, default: null },

    /**
     * Optional rental-fleet car used for this transfer.
     * When set and the car appears in the rental calendar, the transfer can be overlaid there.
     */
    assignedCarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      default: null,
      index: true,
    },

    eligibleSupplierIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Company" }],
      default: [],
    },
    excludedSupplierIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Company" }],
      default: [],
    },

    offerSentAt: { type: Date, default: null },
    offerExpiresAt: { type: Date, default: null, index: true },
    offerEmails: { type: [String], default: [] },

    assignmentHistory: { type: [AssignmentHistorySchema], default: [] },
    claimAttempts: { type: [ClaimAttemptSchema], default: [] },
    communications: { type: [CommunicationSchema], default: [] },
    payment: { type: PaymentSchema, default: () => ({}) },

    internalNotes: { type: String, default: "", trim: true },
    cancellationReason: { type: String, default: "", trim: true },

    /** Optional link to a rental order (future). */
    linkedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  { timestamps: true }
);

TransferSchema.index({ createdAt: -1 });
TransferSchema.index({ country: 1, status: 1, createdAt: -1 });
TransferSchema.index({ assignedSupplierId: 1, status: 1 });

export default mongoose.models.Transfer ||
  mongoose.model("Transfer", TransferSchema);
