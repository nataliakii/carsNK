import mongoose from "mongoose";
import { connectToDB } from "@lib/database";
import MailLog from "@models/MailLog";
import { MAIL_STATUS, MAIL_TYPE } from "./mailTypes";

const MAX_HTML = 400_000;
const MAX_TEXT = 80_000;
const MAX_ERROR = 1000;
const MAX_SUBJECT = 500;

function clip(value, max) {
  const text = value == null ? "" : String(value);
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function asEmailList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

function asObjectId(value) {
  if (!value) return null;
  const raw = String(value);
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return raw;
}

function jsonSafe(value, depth = 0) {
  if (depth > 8) return null;
  if (value == null) return value;
  if (typeof value === "string") return clip(value, 8000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value._bsontype === "ObjectId") {
    return String(value);
  }
  if (typeof value.toJSON === "function" && value !== Object.prototype) {
    try {
      const json = value.toJSON();
      if (json !== value) return jsonSafe(json, depth + 1);
    } catch {
      /* ignore */
    }
  }
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => jsonSafe(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    const keys = Object.keys(value).slice(0, 50);
    for (const key of keys) {
      if (key === "__v" || key === "password" || key === "resetPasswordTokenHash") {
        continue;
      }
      out[key] = jsonSafe(value[key], depth + 1);
    }
    return out;
  }
  return undefined;
}

export function buildMailLogDocument({
  to = [],
  cc = [],
  from = "",
  replyTo = "",
  subject = "",
  html = "",
  text = "",
  status = MAIL_STATUS.SENT,
  error = "",
  messageId = "",
  attachmentNames = [],
  meta = {},
} = {}) {
  const type =
    typeof meta.type === "string" && meta.type.trim()
      ? meta.type.trim()
      : MAIL_TYPE.GENERIC;
  const idempotencyKey =
    typeof meta.idempotencyKey === "string" && meta.idempotencyKey.trim()
      ? clip(meta.idempotencyKey.trim(), 300)
      : null;

  return {
    to: asEmailList(to),
    cc: asEmailList(cc),
    from: clip(from, 200),
    replyTo: clip(replyTo, 200),
    subject: clip(subject, MAX_SUBJECT),
    type,
    orderId: asObjectId(meta.orderId),
    companyId: asObjectId(meta.companyId),
    sentAt: new Date(),
    status:
      status === MAIL_STATUS.FAILED
        ? MAIL_STATUS.FAILED
        : status === MAIL_STATUS.SKIPPED
          ? MAIL_STATUS.SKIPPED
          : MAIL_STATUS.SENT,
    error: clip(error, MAX_ERROR),
    html: clip(html, MAX_HTML),
    text: clip(text, MAX_TEXT),
    renderKey: typeof meta.renderKey === "string" ? meta.renderKey.trim() : "",
    payload: meta.payload != null ? jsonSafe(meta.payload) : null,
    messageId: clip(messageId, 200),
    resentFromId: asObjectId(meta.resentFromId),
    idempotencyKey,
    attachmentNames: Array.isArray(attachmentNames)
      ? attachmentNames.map((name) => clip(name, 180)).filter(Boolean).slice(0, 8)
      : [],
  };
}

/**
 * Persist an outbound mail row. Never throws — send must not fail because of logging.
 */
export async function recordOutboundMail(entry) {
  try {
    await connectToDB();
    await MailLog.create(buildMailLogDocument(entry));
  } catch (err) {
    console.warn("[mailLog] record failed:", err?.message || err);
  }
}
