/**
 * Ban model: IP and/or fingerprint bans for order creation.
 * Used by orderGuard to block abusive clients without touching order business logic.
 *
 * Schema matches requirements:
 * - ip (optional), fingerprint (optional)
 * - reason, type: "manual" | "auto"
 * - expiresAt (nullable) — null = permanent until manually removed
 * - createdAt
 */

const mongoose = require("mongoose");

const BanSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      default: null,
      trim: true,
    },
    fingerprint: {
      type: String,
      default: null,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["manual", "auto"],
      required: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    collection: "bans",
    // Index for fast lookup: at least one of ip/fingerprint must be set
    // Compound index for "find active ban by ip or fingerprint"
    // TTL-like cleanup: we query { $or: [{ ip }, { fingerprint }], $and: [expiresAt null or > now] }
  }
);

// At least one of ip or fingerprint should be set for a meaningful ban
BanSchema.index({ ip: 1, expiresAt: 1 });
BanSchema.index({ fingerprint: 1, expiresAt: 1 });
BanSchema.index({ createdAt: 1 }, { expireAfterSeconds: 0 });
// TTL: Mongo auto-deletes docs where expiresAt is in the past (only docs with non-null expiresAt)
BanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Ban = mongoose.models?.Ban || mongoose.model("Ban", BanSchema);

module.exports = { Ban, BanSchema };
