import mongoose from "mongoose";

/**
 * Immutable record of what both sides agreed to, written once the customer's
 * booking prepayment has been received.
 *
 * This is the document a dispute is resolved against: it pins the price, the
 * vehicle, the partner confirmation and the exact legal document versions in
 * force at that moment. It is deliberately not editable — not by an admin and
 * not by a superadmin. A later change means a new snapshot with a reason.
 */
const confirmedBookingSnapshotSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderNumber: { type: String, default: "" },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    /** Sequence number for this order; 1 is the original confirmation. */
    sequence: { type: Number, required: true, default: 1 },
    /** Why a later snapshot was created (e.g. accepted alternative vehicle). */
    reason: { type: String, default: "initial_confirmation" },

    vehicle: {
      carId: { type: String, default: "" },
      model: { type: String, default: "" },
      regNumber: { type: String, default: "" },
      category: { type: String, default: "" },
      transmission: { type: String, default: "" },
      seats: { type: Number, default: null },
      photos: { type: [String], default: [] },
    },

    schedule: {
      pickupAtUtc: { type: Date, default: null },
      returnAtUtc: { type: Date, default: null },
      timezone: { type: String, default: "" },
      placeIn: { type: String, default: "" },
      placeOut: { type: String, default: "" },
    },

    /** Server-calculated money only. Minor units. */
    financials: {
      currency: { type: String, default: "EUR" },
      grossMinor: { type: Number, default: 0 },
      prepaymentPercent: { type: Number, default: 0 },
      prepaymentMinor: { type: Number, default: 0 },
      balanceMinor: { type: Number, default: 0 },
      depositMinor: { type: Number, default: null },
      insurance: { type: String, default: "" },
      extras: { type: mongoose.Schema.Types.Mixed, default: null },
      lines: { type: mongoose.Schema.Types.Mixed, default: null },
      commissionPercent: { type: Number, default: null },
      minimumCommissionAmount: { type: Number, default: null },
      paymentFeeBearer: { type: String, default: "" },
      vatTreatment: { type: String, default: "" },
    },

    /** How the customer paid the prepayment. */
    payment: {
      provider: { type: String, default: "" },
      providerPaymentId: { type: String, default: "" },
      paidAt: { type: Date, default: null },
      amountMinor: { type: Number, default: 0 },
      currency: { type: String, default: "EUR" },
    },

    /** The partner's binding availability confirmation. */
    partnerConfirmation: {
      confirmedAt: { type: Date, default: null },
      confirmedByEmail: { type: String, default: "" },
      confirmationTokenJti: { type: String, default: "" },
      ipAddress: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      statementAccepted: { type: String, default: "" },
    },

    /** Legal versions in force at snapshot time. */
    legalRefs: {
      agreementId: { type: String, default: "" },
      agreementPackageChecksum: { type: String, default: "" },
      customerBookingTerms: { type: mongoose.Schema.Types.Mixed, default: null },
      partnerDocuments: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    cancellationRulesText: { type: String, default: "" },
    /** sha256 over the whole snapshot payload. */
    checksum: { type: String, required: true, index: true },
  },
  { timestamps: true, collection: "confirmed_booking_snapshots" }
);

confirmedBookingSnapshotSchema.index({ orderId: 1, sequence: 1 }, { unique: true });

function refuseMutation(next) {
  next(
    new Error(
      "ConfirmedBookingSnapshot is immutable. Create a new snapshot with a reason instead."
    )
  );
}

confirmedBookingSnapshotSchema.pre("findOneAndUpdate", refuseMutation);
confirmedBookingSnapshotSchema.pre("updateOne", refuseMutation);
confirmedBookingSnapshotSchema.pre("updateMany", refuseMutation);
confirmedBookingSnapshotSchema.pre("save", function guard(next) {
  if (this.isNew) return next();
  return refuseMutation(next);
});

const ConfirmedBookingSnapshot =
  mongoose.models?.ConfirmedBookingSnapshot ||
  mongoose.model("ConfirmedBookingSnapshot", confirmedBookingSnapshotSchema);

export default ConfirmedBookingSnapshot;
