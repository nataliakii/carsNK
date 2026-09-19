import mongoose from "mongoose";

/**
 * Single-purpose hashed claim/offer tokens.
 * Raw token is never stored — only SHA-256 hash.
 */
const TransferOfferSchema = new mongoose.Schema(
  {
    transferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transfer",
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["claim", "view"],
      default: "claim",
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    usedAt: { type: Date, default: null },
    supplierPayoutMinor: { type: Number, default: null },
    currency: { type: String, default: "EUR" },
  },
  { timestamps: true, collection: "transfer_offers" }
);

TransferOfferSchema.index({ transferId: 1, companyId: 1, purpose: 1 });

const TransferOffer =
  mongoose.models?.TransferOffer ||
  mongoose.model("TransferOffer", TransferOfferSchema);

export default TransferOffer;
