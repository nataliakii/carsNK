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
  },
  { timestamps: true }
);

export const User = mongoose.models?.User || mongoose.model("User", userSchema);
