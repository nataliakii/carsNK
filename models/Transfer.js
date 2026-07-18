import mongoose from "mongoose";

export const TRANSFER_STATUS = {
  NEW: "new",
  SEEN: "seen",
  DONE: "done",
  CANCELLED: "cancelled",
};

const TransferSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    passengers: { type: Number, required: true, min: 1, max: 50 },
    datetime: { type: Date, required: true, index: true },
    notes: { type: String, default: "", trim: true },
    customerName: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: Object.values(TRANSFER_STATUS),
      default: TRANSFER_STATUS.NEW,
      index: true,
    },
    locale: { type: String, default: "" },
  },
  { timestamps: true }
);

TransferSchema.index({ createdAt: -1 });

export default mongoose.models.Transfer ||
  mongoose.model("Transfer", TransferSchema);
