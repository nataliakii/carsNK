import mongoose from "mongoose";

export const SUPPORT_MESSAGE_REASONS = [
  "booking_question",
  "vehicle_unavailable",
  "customer_details",
  "payment_issue",
  "pickup_return_issue",
  "other",
];

export const SUPPORT_DELIVERY_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
};

const deliveryEnum = Object.values(SUPPORT_DELIVERY_STATUS);

const orderSupportMessageSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderNumber: { type: String, default: "" },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    companyName: { type: String, default: "" },
    partnerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    partnerUserEmail: { type: String, default: "" },
    source: {
      type: String,
      enum: ["email_token", "session"],
      default: "email_token",
    },
    carModel: { type: String, default: "" },
    carNumber: { type: String, default: "" },
    rentalStartDate: { type: Date, default: null },
    rentalEndDate: { type: Date, default: null },
    placeIn: { type: String, default: "" },
    placeOut: { type: String, default: "" },
    bookingStatus: { type: String, default: "" },
    reason: {
      type: String,
      enum: SUPPORT_MESSAGE_REASONS,
      default: "other",
    },
    message: { type: String, required: true, maxlength: 4000 },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    emailStatus: {
      type: String,
      enum: deliveryEnum,
      default: SUPPORT_DELIVERY_STATUS.PENDING,
      index: true,
    },
    telegramStatus: {
      type: String,
      enum: deliveryEnum,
      default: SUPPORT_DELIVERY_STATUS.SKIPPED,
    },
    emailError: { type: String, default: "" },
    telegramError: { type: String, default: "" },
    idempotencyKey: {
      type: String,
      default: "",
      index: { unique: true, sparse: true },
    },
    contentHash: { type: String, default: "", index: true },
  },
  {
    timestamps: true,
    collection: "order_support_messages",
  }
);

orderSupportMessageSchema.index({ orderId: 1, createdAt: -1 });
orderSupportMessageSchema.index({ companyId: 1, createdAt: -1 });
orderSupportMessageSchema.index({
  orderId: 1,
  contentHash: 1,
  createdAt: -1,
});

const OrderSupportMessage =
  mongoose.models?.OrderSupportMessage ||
  mongoose.model("OrderSupportMessage", orderSupportMessageSchema);

export default OrderSupportMessage;
