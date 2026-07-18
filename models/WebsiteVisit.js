import { Schema, model, models } from "mongoose";

/**
 * Logged website visits (human engagement tracker).
 * Used by admin "Visits" study page; Telegram notify remains a side effect.
 */
const WebsiteVisitSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    path: { type: String, default: "", trim: true, index: true },
    host: { type: String, default: "", trim: true, index: true },
    ip: { type: String, default: "", trim: true, index: true },
    language: { type: String, default: "unknown", trim: true, index: true },
    country: { type: String, default: "", trim: true, index: true },
    region: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    sessionId: { type: String, default: "", trim: true, index: true },
    proof: { type: String, default: "", trim: true },
    userAgent: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

WebsiteVisitSchema.index({ createdAt: -1 });
WebsiteVisitSchema.index({ country: 1, createdAt: -1 });

const WebsiteVisit =
  (typeof models !== "undefined" && models.WebsiteVisit) ||
  model("WebsiteVisit", WebsiteVisitSchema);

export default WebsiteVisit;
