import mongoose from "mongoose";

/**
 * Cached driving-route calculations. Never use straight-line distance for price.
 */
const TransferRouteCacheSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    originLat: { type: Number, default: null },
    originLng: { type: Number, default: null },
    destinationLat: { type: Number, default: null },
    destinationLng: { type: Number, default: null },
    originLabel: { type: String, default: "", trim: true },
    destinationLabel: { type: String, default: "", trim: true },
    distanceKm: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, default: null, min: 0 },
    provider: { type: String, default: "google_distance_matrix", trim: true },
    tollsMinor: { type: Number, default: null },
    tollCurrency: { type: String, default: "EUR" },
    warnings: { type: [String], default: [] },
    approximate: { type: Boolean, default: false },
    calculatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "transfer_route_cache" }
);

TransferRouteCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TransferRouteCache =
  mongoose.models?.TransferRouteCache ||
  mongoose.model("TransferRouteCache", TransferRouteCacheSchema);

export default TransferRouteCache;

/** Default route cache TTL: 7 days. */
export function defaultRouteCacheTtlMs() {
  const hours = Number(process.env.TRANSFER_ROUTE_CACHE_TTL_HOURS || 168);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 168;
  return h * 60 * 60 * 1000;
}
