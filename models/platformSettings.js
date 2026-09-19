import mongoose from "mongoose";
import { ALL_UI_LOCALE_CODES } from "@/domain/platform/uiLocales";

const platformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "platform",
      unique: true,
      index: true,
    },
    enabledLocales: {
      type: [String],
      default: () => ["en"],
      validate: {
        validator(value) {
          if (!Array.isArray(value) || value.length === 0) return false;
          return value.every((code) => ALL_UI_LOCALE_CODES.includes(code));
        },
        message: "enabledLocales must be a non-empty list of known UI locales",
      },
    },
    defaultBookingMode: {
      type: String,
      enum: ["OPS_CALENDAR", "MARKETPLACE_REQUEST"],
      default: null,
    },
    defaultTimezone: { type: String, default: "", trim: true },
    prepaymentPercent: { type: Number, default: null, min: 0, max: 100 },
  },
  { timestamps: true, collection: "platform_settings" }
);

const PlatformSettings =
  mongoose.models?.PlatformSettings ||
  mongoose.model("PlatformSettings", platformSettingsSchema);

export default PlatformSettings;
