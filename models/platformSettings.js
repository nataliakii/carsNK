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
    /** Spain marketplace default Booking Fee in bps. Null = 1000 (10%). */
    marketplaceBookingFeeBps: { type: Number, default: null, min: 100, max: 3000 },
    /**
     * Commercial + operational parameters referenced by the legal documents
     * and the booking workflow. Mixed so the shape can evolve without a
     * migration; validated by domain/legal/legalSettings.resolveLegalSettings.
     * Commercial amounts stay null until superadmin fills them in — they are
     * never defaulted to an invented number.
     */
    legal: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "platform_settings" }
);

const PlatformSettings =
  mongoose.models?.PlatformSettings ||
  mongoose.model("PlatformSettings", platformSettingsSchema);

// HMR safety for cached model
if (PlatformSettings?.schema && !PlatformSettings.schema.path("legal")) {
  PlatformSettings.schema.add({
    legal: { type: mongoose.Schema.Types.Mixed, default: null },
  });
}
if (PlatformSettings?.schema && !PlatformSettings.schema.path("marketplaceBookingFeeBps")) {
  PlatformSettings.schema.add({
    marketplaceBookingFeeBps: { type: Number, default: null, min: 100, max: 3000 },
  });
}

export default PlatformSettings;
