import mongoose from "mongoose";

const platformCitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    country: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["city", "airport", "region"],
      default: "city",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    requiresAddressDetail: {
      type: Boolean,
      default: false,
    },
    searchText: {
      type: String,
      default: "",
      trim: true,
    },
    sort: {
      type: Number,
      default: 100,
    },
    /** IANA timezone for this city (e.g. Atlantic/Canary). Empty = country default. */
    timezone: {
      type: String,
      default: "",
      trim: true,
    },
    /** Optional center point — used with Company.orderRadiusKm */
    coords: {
      lat: { type: String, default: "" },
      lon: { type: String, default: "" },
    },
  },
  { timestamps: true, collection: "platform_cities" }
);

platformCitySchema.index({ country: 1, slug: 1 }, { unique: true });
platformCitySchema.index({ country: 1, isActive: 1, sort: 1 });

const PlatformCity =
  mongoose.models?.PlatformCity ||
  mongoose.model("PlatformCity", platformCitySchema);

if (PlatformCity?.schema && !PlatformCity.schema.path("timezone")) {
  PlatformCity.schema.add({
    timezone: { type: String, default: "", trim: true },
  });
}

if (PlatformCity?.schema && !PlatformCity.schema.path("coords")) {
  PlatformCity.schema.add({
    coords: {
      lat: { type: String, default: "" },
      lon: { type: String, default: "" },
    },
  });
}

export default PlatformCity;
