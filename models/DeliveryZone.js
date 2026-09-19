import mongoose from "mongoose";

/**
 * DeliveryZone — named pickup/dropoff points with distance-based pricing.
 *
 * Scoped per company via ownerId (Company._id). Legacy rows may omit ownerId
 * and are treated as belonging to the site default company.
 *
 * Usage in orders:
 *   order.placeIn  → lookup DeliveryZone → deliveryPriceIn
 *   order.placeOut → lookup DeliveryZone → deliveryPriceOut
 *   deliveryTotal  = deliveryPriceIn + deliveryPriceOut
 *
 * With company.deliveryPricing (radius-split), named zones act as overrides /
 * outside-area exceptions when the place name matches.
 */

const DeliveryZoneSchema = new mongoose.Schema(
  {
    /** Company._id — partner that owns this zone list */
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    distanceKm: {
      type: Number,
      required: true,
      min: 0,
    },
    /** If set, overrides pricePerKm × distanceKm */
    fixedPrice: {
      type: Number,
      default: null,
    },
    isFreeDelivery: {
      type: Boolean,
      default: false,
    },
    /** GPS coordinates for future map integration */
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

DeliveryZoneSchema.index({ ownerId: 1, slug: 1 }, { unique: true });

const DeliveryZone =
  mongoose.models?.DeliveryZone ||
  mongoose.model("DeliveryZone", DeliveryZoneSchema);

export { DeliveryZone, DeliveryZoneSchema };
