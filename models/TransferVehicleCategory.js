import mongoose from "mongoose";

export const TRANSFER_VEHICLE_CATEGORIES = {
  STANDARD: "STANDARD",
  COMFORT: "COMFORT",
  BUSINESS: "BUSINESS",
  MINIVAN: "MINIVAN",
  MINIBUS: "MINIBUS",
  ACCESSIBLE_VEHICLE: "ACCESSIBLE_VEHICLE",
};

const TransferVehicleCategorySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    maxPassengers: { type: Number, required: true, min: 1, max: 50 },
    standardLuggageCapacity: { type: Number, default: 2, min: 0 },
    cabinLuggageCapacity: { type: Number, default: 2, min: 0 },
    allowedSpecialLuggage: {
      type: [String],
      default: [],
    },
    requiredSupplierCapabilities: {
      type: [String],
      default: [],
    },
    /** Multiplier applied in distance formula (1 = baseline). */
    pricingMultiplier: { type: Number, default: 1, min: 0 },
    /** Fixed minor-unit adjustment added after multiplier. */
    pricingFixedAdjustmentMinor: { type: Number, default: 0 },
    activeCountries: {
      type: [String],
      default: [],
    },
    activeCities: {
      type: [String],
      default: [],
    },
    sort: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "transfer_vehicle_categories" }
);

const TransferVehicleCategory =
  mongoose.models?.TransferVehicleCategory ||
  mongoose.model("TransferVehicleCategory", TransferVehicleCategorySchema);

export default TransferVehicleCategory;

export const DEFAULT_VEHICLE_CATEGORIES = [
  {
    code: "STANDARD",
    title: "Standard",
    description: "Sedan for up to 3 passengers with standard luggage",
    maxPassengers: 3,
    standardLuggageCapacity: 2,
    cabinLuggageCapacity: 2,
    pricingMultiplier: 1,
    sort: 10,
  },
  {
    code: "COMFORT",
    title: "Comfort",
    description: "Higher-spec sedan or crossover",
    maxPassengers: 3,
    standardLuggageCapacity: 2,
    cabinLuggageCapacity: 2,
    pricingMultiplier: 1.2,
    sort: 20,
  },
  {
    code: "BUSINESS",
    title: "Business",
    description: "Premium business vehicle",
    maxPassengers: 3,
    standardLuggageCapacity: 2,
    cabinLuggageCapacity: 2,
    pricingMultiplier: 1.45,
    sort: 30,
  },
  {
    code: "MINIVAN",
    title: "Minivan",
    description: "Up to 6–7 passengers",
    maxPassengers: 7,
    standardLuggageCapacity: 6,
    cabinLuggageCapacity: 4,
    pricingMultiplier: 1.35,
    sort: 40,
  },
  {
    code: "MINIBUS",
    title: "Minibus",
    description: "Group transfers",
    maxPassengers: 16,
    standardLuggageCapacity: 16,
    cabinLuggageCapacity: 8,
    pricingMultiplier: 1.8,
    sort: 50,
  },
  {
    code: "ACCESSIBLE_VEHICLE",
    title: "Accessible vehicle",
    description: "Wheelchair-accessible transfer",
    maxPassengers: 3,
    standardLuggageCapacity: 2,
    cabinLuggageCapacity: 2,
    requiredSupplierCapabilities: ["wheelchair"],
    pricingMultiplier: 1.25,
    sort: 60,
  },
];
