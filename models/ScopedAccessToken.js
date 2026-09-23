import mongoose from "mongoose";
import { ALL_ACCESS_SCOPES } from "@/domain/auth/accessScopes";

const ScopedAccessTokenSchema = new mongoose.Schema(
  {
    /** SHA-256 of raw token (raw shown once on create). */
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    /** First characters of raw token for admin UI identification. */
    tokenPrefix: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      default: "",
      maxlength: 120,
    },
    /** Partner company this link is bound to. */
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    /** Company admin this login link signs in as (admin.console only). */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    /**
     * Explicit page scopes only — voucher pages or 7-day company login.
     * Values are checked in application code (`isValidAccessScope`) so new
     * scopes can ship without a mongoose enum rebuild.
     */
    scopes: {
      type: [String],
      required: true,
      validate: {
        validator(v) {
          return (
            Array.isArray(v) &&
            v.length > 0 &&
            v.every((scope) => ALL_ACCESS_SCOPES.includes(String(scope)))
          );
        },
        message: "At least one valid scope is required",
      },
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdByAdminId: {
      type: String,
      default: null,
    },
    createdByEmail: {
      type: String,
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const ScopedAccessToken =
  mongoose.models?.ScopedAccessToken ||
  mongoose.model("ScopedAccessToken", ScopedAccessTokenSchema);

if (ScopedAccessToken?.schema && !ScopedAccessToken.schema.path("userId")) {
  ScopedAccessToken.schema.add({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  });
}
