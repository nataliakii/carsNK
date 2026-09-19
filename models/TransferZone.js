import mongoose from "mongoose";
import { locationSnapshotSchemaDefinition } from "@/domain/transfers/locationSnapshot";

const TransferZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    country: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    city: { type: String, default: "", trim: true },
    /** GeoJSON Polygon or MultiPolygon when available. */
    boundary: { type: mongoose.Schema.Types.Mixed, default: null },
    coveredPlaceIds: { type: [String], default: [] },
    coveredPostcodes: { type: [String], default: [] },
    memberAirports: { type: [String], default: [] },
    memberHotels: { type: [String], default: [] },
    memberDistricts: { type: [String], default: [] },
    /** Optional center for radius membership checks. */
    center: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    radiusKm: { type: Number, default: null, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "transfer_zones" }
);

TransferZoneSchema.index({ country: 1, slug: 1 }, { unique: true });

const TransferZone =
  mongoose.models?.TransferZone ||
  mongoose.model("TransferZone", TransferZoneSchema);

export default TransferZone;
export { locationSnapshotSchemaDefinition };
