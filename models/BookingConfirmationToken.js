import mongoose from "mongoose";

/**
 * One-time token backing the partner booking-confirmation link.
 *
 * The raw token never touches the database — only its SHA-256. A row is
 * created when the link is issued, and `consumedAt` is set by an atomic
 * findOneAndUpdate on POST, which is what makes replay impossible and the
 * confirmation idempotent.
 */
const bookingConfirmationTokenSchema = new mongoose.Schema(
  {
    /** SHA-256 of the raw token. */
    tokenHash: { type: String, required: true, unique: true, index: true },
    /** Unique id embedded in the signed payload. */
    jti: { type: String, required: true, unique: true, index: true },

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
    purpose: {
      type: String,
      enum: ["confirm_availability"],
      default: "confirm_availability",
    },

    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
    /** accepted | declined — the decision the token was spent on. */
    decision: { type: String, enum: ["accepted", "declined"], default: null },

    /** Audit context of the consuming request. */
    consumedIp: { type: String, default: "" },
    consumedUserAgent: { type: String, default: "" },
    /** Rejected replay attempts, for the audit trail. */
    replayAttempts: { type: Number, default: 0 },
    lastReplayAt: { type: Date, default: null },

    issuedByEmail: { type: String, default: "" },
    /** Agreement version in force when the link was issued. */
    agreementRef: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "booking_confirmation_tokens" }
);

const BookingConfirmationToken =
  mongoose.models?.BookingConfirmationToken ||
  mongoose.model("BookingConfirmationToken", bookingConfirmationTokenSchema);

export default BookingConfirmationToken;
