import mongoose from "mongoose";

/**
 * Temporary calendar hold for a marketplace booking after the partner
 * confirms availability and before Stripe marks the prepayment paid.
 *
 * Interval uniqueness is enforced in domain/booking/bookingHold.js with a
 * per-car lock (this deployment does not use Mongo transactions).
 *
 * Indexes are applied by `scripts/migrateBookingHoldIndexes.js` only
 * (`--apply`). Runtime, cron, and app startup must not syncIndexes().
 */
const HOLD_STATUS = Object.freeze({
  ACTIVE: "active",
  FINALIZED: "finalized",
  RELEASED: "released",
  RETRY: "retry",
});

const bookingHoldSchema = new mongoose.Schema(
  {
    carId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    pickupAtUtc: { type: Date, required: true },
    returnAtUtc: { type: Date, required: true },
    holdExpiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(HOLD_STATUS),
      default: HOLD_STATUS.ACTIVE,
      index: true,
    },
    stripeSessionId: { type: String, default: "" },
    offerId: { type: String, default: "", index: true },
    releasedAt: { type: Date, default: null },
    finalizedAt: { type: Date, default: null },
    releaseReason: { type: String, default: "" },
  },
  { timestamps: true, collection: "booking_holds" }
);

bookingHoldSchema.index({ carId: 1, status: 1, holdExpiresAt: 1 });
bookingHoldSchema.index({ carId: 1, pickupAtUtc: 1, returnAtUtc: 1 });

const carHoldLockSchema = new mongoose.Schema(
  {
    carId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    lockedByOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    lockedUntil: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: "booking_car_locks" }
);

export const BookingHold =
  mongoose.models?.BookingHold ||
  mongoose.model("BookingHold", bookingHoldSchema);

export const BookingCarLock =
  mongoose.models?.BookingCarLock ||
  mongoose.model("BookingCarLock", carHoldLockSchema);

export { HOLD_STATUS };
export default BookingHold;
