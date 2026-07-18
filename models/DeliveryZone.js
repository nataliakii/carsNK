import mongoose from "mongoose";

/**
 * DeliveryZone — defines delivery locations with distance-based pricing.
 *
 * Each zone is a named pickup/dropoff point (e.g. "Airport", "Thessaloniki").
 * Price is calculated as distanceKm × pricePerKm (sourced from Company settings
 * or overridden per zone via fixedPrice).
 *
 * Usage in orders:
 *   order.placeIn  → lookup DeliveryZone → deliveryPriceIn
 *   order.placeOut → lookup DeliveryZone → deliveryPriceOut
 *   deliveryTotal  = deliveryPriceIn + deliveryPriceOut
 */

const DeliveryZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
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

const DeliveryZone =
  mongoose.models?.DeliveryZone ||
  mongoose.model("DeliveryZone", DeliveryZoneSchema);

export { DeliveryZone, DeliveryZoneSchema };
