import mongoose from "mongoose";
import MailLog from "@models/MailLog";
import { MAIL_STATUS, MAIL_STATUSES, MAIL_TYPE } from "./mailTypes";

const LIST_SELECT = [
  "to",
  "cc",
  "from",
  "replyTo",
  "subject",
  "type",
  "orderId",
  "companyId",
  "sentAt",
  "status",
  "error",
  "renderKey",
  "messageId",
  "resentFromId",
  "attachmentNames",
].join(" ");

function asObjectId(value) {
  if (!value) return null;
  const raw = String(value);
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return raw;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMailLogFilter({
  orderId,
  companyId,
  recipient,
  type,
  status,
} = {}) {
  const filter = {};
  const order = asObjectId(orderId);
  if (order) filter.orderId = order;
  const company = asObjectId(companyId);
  if (company) filter.companyId = company;
  if (type && type !== "all") filter.type = String(type).trim();
  if (status && MAIL_STATUSES.includes(status)) filter.status = status;
  const q = String(recipient || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ to: rx }, { cc: rx }, { subject: rx }];
  }
  return filter;
}

export function serializeMailLogListItem(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    to: doc.to || [],
    cc: doc.cc || [],
    from: doc.from || "",
    replyTo: doc.replyTo || "",
    subject: doc.subject || "",
    type: doc.type || MAIL_TYPE.GENERIC,
    orderId: doc.orderId ? String(doc.orderId) : null,
    companyId: doc.companyId ? String(doc.companyId) : null,
    sentAt: doc.sentAt || doc.createdAt || null,
    status: doc.status || MAIL_STATUS.SENT,
    error: doc.error || "",
    renderKey: doc.renderKey || "",
    messageId: doc.messageId || "",
    resentFromId: doc.resentFromId ? String(doc.resentFromId) : null,
    attachmentNames: doc.attachmentNames || [],
    canResend: doc.status === MAIL_STATUS.SENT || Boolean(doc.html || doc.text || doc.renderKey),
  };
}

export function serializeMailLogDetail(doc) {
  const base = serializeMailLogListItem(doc);
  if (!base) return null;
  return {
    ...base,
    html: doc.html || "",
    text: doc.text || "",
    hasPayload: doc.payload != null,
  };
}

export async function listMailLogs({
  orderId,
  companyId,
  recipient,
  type,
  status,
  page = 1,
  limit = 50,
} = {}) {
  const filter = buildMailLogFilter({
    orderId,
    companyId,
    recipient,
    type,
    status,
  });
  const safePage = Math.min(1000, Math.max(1, Number(page) || 1));
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (safePage - 1) * safeLimit;

  const [total, rows] = await Promise.all([
    MailLog.countDocuments(filter),
    MailLog.find(filter)
      .select(LIST_SELECT)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
  ]);

  return {
    items: rows.map(serializeMailLogListItem),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

export async function getMailLogById(id) {
  const objectId = asObjectId(id);
  if (!objectId) return null;
  return MailLog.findById(objectId).lean();
}
