import mongoose from "mongoose";

const DiscountSettingSchema = new mongoose.Schema(
  {
    discount: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    active: {
      type: Boolean,
      default: true,
    },
    appliedOrderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
  },
  { timestamps: true }
);

DiscountSettingSchema.pre("validate", function (next) {
  if (!this.startDate || !this.endDate) {
    return next(new Error("Both startDate and endDate are required"));
  }
  if (this.endDate < this.startDate) {
    return next(new Error("endDate must be greater than or equal to startDate"));
  }
  return next();
});

// Only one active discount at a time.
DiscountSettingSchema.index(
  { active: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
  }
);

export default mongoose.models?.DiscountSetting ||
  mongoose.model("DiscountSetting", DiscountSettingSchema);
