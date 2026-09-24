import mongoose from "mongoose";

/**
 * User roles enum — SINGLE SOURCE OF TRUTH
 * 
 * Values stored in database:
 * 1 = ADMIN (regular admin)
 * 2 = SUPERADMIN (can override conflicts, force create orders)
 * 
 * ⚠️ Do NOT change these values — they are stored in the database.
 */
export const ROLE = {
  ADMIN: 1,
  SUPERADMIN: 2,
};

/**
 * Role display names
 */
export const ROLE_NAME = {
  [ROLE.ADMIN]: "admin",
  [ROLE.SUPERADMIN]: "superadmin",
};

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      min: 3,
      max: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      max: 50,
    },
    password: {
      type: String,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    /**
     * User role:
     * 1 = ADMIN (default) - regular admin
     * 2 = SUPERADMIN - can override conflicts, force create orders
     */
    role: {
      type: Number,
      enum: [ROLE.ADMIN, ROLE.SUPERADMIN],
      default: ROLE.ADMIN,
    },
    /**
     * Partner firm (Company._id). Required for ADMIN — scopes cars/orders.
     * SUPERADMIN may leave null (sees all fleets).
     */
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    /** SHA-256 of one-time password-reset token (raw token only in email link). */
    resetPasswordTokenHash: {
      type: String,
      default: null,
      index: true,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    /** Display name shown in the partner Admins tab. Falls back to username. */
    name: {
      type: String,
      default: "",
      trim: true,
      max: 80,
    },
    /** Set when an invitation is sent. Cleared never — see lastLoginAt. */
    invitedAt: {
      type: Date,
      default: null,
    },
    /** Last successful credentials login. Null = invitation still pending. */
    lastLoginAt: {
      type: Date,
      default: null,
    },
    /** Set while access is revoked. A disabled user cannot sign in. */
    disabledAt: {
      type: Date,
      default: null,
    },
    /** UI locale used for invitations and admin notifications. */
    notificationLanguage: {
      type: String,
      default: "en",
      trim: true,
    },
  },
  { timestamps: true }
);

export const User = mongoose.models?.User || mongoose.model("User", userSchema);

// HMR safety for cached model
if (User?.schema && !User.schema.path("resetPasswordTokenHash")) {
  User.schema.add({
    resetPasswordTokenHash: { type: String, default: null, index: true },
    resetPasswordExpires: { type: Date, default: null },
  });
}

if (User?.schema && !User.schema.path("lastLoginAt")) {
  User.schema.add({
    name: { type: String, default: "", trim: true, max: 80 },
    invitedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    disabledAt: { type: Date, default: null },
    notificationLanguage: { type: String, default: "en", trim: true },
  });
}
