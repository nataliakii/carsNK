import mongoose from "mongoose";

const DailyRateSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    date: { type: String, required: true },
    season: { type: String, required: true },
    targetDays: { type: Number, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountActive: { type: Boolean, default: false },
    finalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const PriceBreakdownSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    totalPrice: { type: Number, required: true },
    baseRentalTotal: { type: Number, required: true },
    kaskoTotal: { type: Number, default: 0 },
    childSeatsTotal: { type: Number, default: 0 },
    secondDriverTotal: { type: Number, default: 0 },
    insurance: { type: String, default: "TPL" },
    childSeatsCount: { type: Number, default: 0 },
    secondDriverEnabled: { type: Boolean, default: false },
    secondDriverPricePerDay: { type: Number, default: 0 },
    kaskoPerDay: { type: Number, default: 0 },
    childSeatPricePerDay: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountPeriodStart: { type: Date, default: null },
    discountPeriodEnd: { type: Date, default: null },
    frozenAt: { type: Date, default: null },
    deliveryIn: { type: Number, default: 0 },
    deliveryOut: { type: Number, default: 0 },
    deliveryTotal: { type: Number, default: 0 },
    deliveryPricePerKm: { type: Number, default: 0 },
    placeIn: { type: String, default: "" },
    placeOut: { type: String, default: "" },
    dailyRates: [DailyRateSchema],
    source: {
      type: String,
      enum: [
        "client_booking",
        "admin_creation",
        "admin_edit",
        "admin_edit_confirmed",
        "confirmation",
        "unconfirm",
        "system",
      ],
      default: "system",
    },
    history: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { timestamps: true }
);

const PriceBreakdown =
  mongoose.models?.PriceBreakdown ||
  mongoose.model("PriceBreakdown", PriceBreakdownSchema);

export { PriceBreakdown, PriceBreakdownSchema };
