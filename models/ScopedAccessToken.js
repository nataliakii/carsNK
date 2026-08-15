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
    /** Explicit page scopes only — never full admin. */
    scopes: {
      type: [
        {
          type: String,
          enum: ALL_ACCESS_SCOPES,
        },
      ],
      required: true,
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "At least one scope is required",
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
