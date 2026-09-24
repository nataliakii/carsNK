import mongoose from "mongoose";
import { MAIL_STATUSES, MAIL_STATUS } from "@/domain/mail/mailTypes";

const mailLogSchema = new mongoose.Schema(
  {
    to: { type: [String], default: [], index: true },
    cc: { type: [String], default: [] },
    from: { type: String, default: "" },
    replyTo: { type: String, default: "" },
    subject: { type: String, default: "", index: true },
    type: { type: String, default: "generic", index: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
      default: null,
    },
    sentAt: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: MAIL_STATUSES,
      default: MAIL_STATUS.SENT,
      index: true,
    },
    error: { type: String, default: "" },
    html: { type: String, default: "" },
    text: { type: String, default: "" },
    renderKey: { type: String, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    messageId: { type: String, default: "" },
    resentFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MailLog",
      default: null,
      index: true,
    },
    attachmentNames: { type: [String], default: [] },
    /**
     * Stable delivery key (event type + entity id [+ audience]).
     * Unique when set so webhook retries cannot duplicate matrix emails.
     */
    idempotencyKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "mail_logs",
  }
);

mailLogSchema.index({ sentAt: -1 });
mailLogSchema.index({ type: 1, sentAt: -1 });
mailLogSchema.index({ status: 1, sentAt: -1 });
mailLogSchema.index({ orderId: 1, sentAt: -1 });
mailLogSchema.index({ companyId: 1, sentAt: -1 });
mailLogSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

const MailLog =
  mongoose.models?.MailLog || mongoose.model("MailLog", mailLogSchema);

export default MailLog;
