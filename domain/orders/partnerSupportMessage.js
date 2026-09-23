/**
 * Partner → Rovaro support message about a specific booking.
 * Recipient is server-locked. Telegram failure never fails the request.
 */

import crypto from "crypto";
import { Order } from "@models/order";
import Company from "@models/company";
import OrderSupportMessage, {
  SUPPORT_DELIVERY_STATUS,
  SUPPORT_MESSAGE_REASONS,
} from "@models/OrderSupportMessage";
import { connectToDB } from "@lib/database";
import { ROVARO_MAILBOX } from "@config/email";
import { ROVARO_CANONICAL_URL } from "@config/domain";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { MAIL_TYPE } from "@/domain/mail/mailTypes";
import { ROLE } from "@models/user";
import { canAccessOwnedDoc, isSuperAdminUser, normalizeOwnerId } from "@/domain/owners/ownerScope";
import { verifyCompanyEmailActionToken } from "./companyEmailActionToken";
import {
  getPartnerSupportCopy,
  supportReasonLabel,
} from "./partnerSupportCopy";
import {
  partnerSupportEmailSubject,
  partnerSupportEmailText,
  renderPartnerSupportMessageEmail,
} from "@/app/ui/email/templates/partnerSupportMessage";

export const MIN_SUPPORT_MESSAGE_LENGTH = 2;
export const MAX_SUPPORT_MESSAGE_LENGTH = 4000;
const RECENT_DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

export function getRovaroSupportMailbox() {
  return ROVARO_MAILBOX;
}

export function superadminOrderStaffUrl(orderId) {
  const id = String(orderId || "").trim();
  const path = `/admin/emails?orderId=${encodeURIComponent(id)}`;
  return `${ROVARO_CANONICAL_URL}${path}`;
}

export function partnerBookingsPath() {
  return "/admin/orders";
}

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return `${new Date(value).toISOString().replace("T", " ").slice(0, 16)} UTC`;
  } catch {
    return "—";
  }
}

function bookingStatusLabel(order) {
  const parts = [
    order?.confirmed ? "confirmed" : "pending",
    order?.companyEmailDecision
      ? `partner_${order.companyEmailDecision}`
      : null,
    order?.status || null,
  ].filter(Boolean);
  return parts.join("/");
}

function bookingReference(order) {
  return (
    (order?.orderNumber != null && String(order.orderNumber).trim()) ||
    order?._id?.toString?.() ||
    ""
  );
}

function bookingDetailLines(order) {
  const car =
    order?.carModel ||
    (typeof order?.car === "object" && order.car?.model) ||
    "—";
  return [
    { label: "Car", value: car },
    {
      label: "Pickup",
      value: `${formatDateTime(order?.rentalStartDate || order?.timeIn)} — ${order?.placeIn || "—"}`,
    },
    {
      label: "Return",
      value: `${formatDateTime(order?.rentalEndDate || order?.timeOut)} — ${order?.placeOut || "—"}`,
    },
    { label: "Status", value: bookingStatusLabel(order) },
  ];
}

export function validateSupportMessage({ message, reason } = {}) {
  const text = String(message || "").trim();
  if (!text || text.length < MIN_SUPPORT_MESSAGE_LENGTH) {
    return { ok: false, message: "Message is required", status: 400 };
  }
  if (text.length > MAX_SUPPORT_MESSAGE_LENGTH) {
    return { ok: false, message: "Message too long", status: 400 };
  }
  const rawReason = String(reason || "").trim();
  const normalizedReason = SUPPORT_MESSAGE_REASONS.includes(rawReason)
    ? rawReason
    : rawReason
      ? null
      : "other";
  if (!normalizedReason) {
    return { ok: false, message: "Invalid reason", status: 400 };
  }
  return { ok: true, message: text, reason: normalizedReason };
}

export function supportContentHash({ orderId, reason, message, actorKey }) {
  return crypto
    .createHash("sha256")
    .update(
      `${String(orderId)}|${String(reason)}|${String(message).trim()}|${String(actorKey || "")}`
    )
    .digest("hex");
}

function sanitizeTelegramText(text) {
  return String(text || "")
    .replace(/https?:\/\/\S*(cloudinary|licence|license|driving[-_]?licen)\S*/gi, "[link omitted]")
    .slice(0, 2000);
}

function isDuplicateKeyError(err) {
  return Boolean(err && (err.code === 11000 || err.code === "11000"));
}

export function serializeSupportMessage(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    orderId: doc.orderId ? String(doc.orderId) : "",
    orderNumber: doc.orderNumber || "",
    companyId: doc.companyId ? String(doc.companyId) : "",
    companyName: doc.companyName || "",
    partnerUserId: doc.partnerUserId ? String(doc.partnerUserId) : "",
    partnerUserEmail: doc.partnerUserEmail || "",
    source: doc.source || "",
    car: doc.carModel || "",
    rentalStartDate: doc.rentalStartDate || null,
    rentalEndDate: doc.rentalEndDate || null,
    placeIn: doc.placeIn || "",
    placeOut: doc.placeOut || "",
    bookingStatus: doc.bookingStatus || "",
    reason: doc.reason || "other",
    message: doc.message || "",
    createdAt: doc.createdAt || null,
    emailStatus: doc.emailStatus || SUPPORT_DELIVERY_STATUS.PENDING,
    telegramStatus: doc.telegramStatus || SUPPORT_DELIVERY_STATUS.SKIPPED,
  };
}

export async function listSupportMessagesForOrder(orderId) {
  const id = String(orderId || "").trim();
  if (!id) return [];
  await connectToDB();
  const rows = await OrderSupportMessage.find({ orderId: id })
    .sort({ createdAt: 1 })
    .lean();
  return rows.map(serializeSupportMessage);
}

export async function loadOrderForSupport(orderId) {
  await connectToDB();
  const order = await Order.findById(orderId);
  return order || null;
}

/**
 * Token for that order, or a session partner who owns the booking.
 * Client to / recipient / companyId are ignored.
 */
export async function resolvePartnerSupportAccess({
  token,
  orderId,
  sessionUser,
} = {}) {
  const rawToken = String(token || "").trim();
  if (rawToken) {
    const parsed = verifyCompanyEmailActionToken(rawToken);
    if (!parsed.ok) {
      return { ok: false, message: parsed.message, status: 400 };
    }
    if (parsed.action !== "message") {
      return { ok: false, message: "Token action mismatch", status: 400 };
    }
    return {
      ok: true,
      source: "email_token",
      orderId: parsed.orderId,
      user: null,
    };
  }

  if (!sessionUser) {
    return { ok: false, message: "Unauthorized", status: 401 };
  }
  if (isSuperAdminUser(sessionUser)) {
    return {
      ok: false,
      message: "Only the partner company can send this message",
      status: 403,
    };
  }
  if (Number(sessionUser.role) !== ROLE.ADMIN && !sessionUser.isAdmin) {
    return { ok: false, message: "Unauthorized", status: 401 };
  }

  const id = String(orderId || "").trim();
  if (!id) {
    return { ok: false, message: "orderId is required", status: 400 };
  }
  if (!normalizeOwnerId(sessionUser.ownerId)) {
    return { ok: false, message: "Forbidden", status: 403 };
  }

  return {
    ok: true,
    source: "session",
    orderId: id,
    user: sessionUser,
  };
}

export async function assertPartnerOwnsOrder(user, order) {
  if (!order) return { ok: false, message: "Order not found", status: 404 };
  if (!user) return { ok: true };
  if (!canAccessOwnedDoc(user, order)) {
    return { ok: false, message: "Forbidden", status: 403 };
  }
  return { ok: true };
}

async function findRecentDuplicate({ orderId, contentHash, idempotencyKey }) {
  if (idempotencyKey) {
    const byKey = await OrderSupportMessage.findOne({ idempotencyKey }).lean();
    if (byKey) return byKey;
  }
  if (!contentHash) return null;
  const since = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS);
  return OrderSupportMessage.findOne({
    orderId,
    contentHash,
    createdAt: { $gte: since },
  }).lean();
}

export async function sendPartnerSupportMessage({
  order,
  message,
  reason,
  actor = {},
  locale = "en",
} = {}) {
  const validated = validateSupportMessage({ message, reason });
  if (!validated.ok) return validated;
  if (!order) return { ok: false, message: "Order not found", status: 404 };

  const copy = getPartnerSupportCopy(locale);
  const actorKey =
    actor.user?.id ||
    actor.user?._id ||
    actor.idempotencyKey ||
    actor.source ||
    "email_token";
  const contentHash = supportContentHash({
    orderId: order._id,
    reason: validated.reason,
    message: validated.message,
    actorKey,
  });
  const idempotencyKey = clip(actor.idempotencyKey, 80);

  await connectToDB();

  const existing = await findRecentDuplicate({
    orderId: order._id,
    contentHash,
    idempotencyKey,
  });
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      orderId: String(order._id),
      messageId: String(existing._id),
      message: copy.success,
    };
  }

  let companyName = "";
  if (order.ownerId) {
    try {
      const company = await Company.findById(order.ownerId).select("name").lean();
      companyName = company?.name || "";
    } catch (err) {
      console.warn("[partnerSupport] company lookup failed:", err?.message || err);
    }
  }

  const sender = actor.user?.email
    ? String(actor.user.email)
    : "Partner (email link)";
  const ref = bookingReference(order);
  const bookingLines = bookingDetailLines(order);

  let saved;
  try {
    saved = await OrderSupportMessage.create({
      orderId: order._id,
      orderNumber: ref,
      companyId: order.ownerId || null,
      companyName,
      partnerUserId: actor.user?.id || actor.user?._id || null,
      partnerUserEmail: actor.user?.email || "",
      source: actor.source || "email_token",
      carModel: order.carModel || "",
      carNumber: order.carNumber || "",
      rentalStartDate: order.rentalStartDate || null,
      rentalEndDate: order.rentalEndDate || null,
      placeIn: order.placeIn || "",
      placeOut: order.placeOut || "",
      bookingStatus: bookingStatusLabel(order),
      reason: validated.reason,
      message: validated.message,
      ipAddress: clip(actor.ipAddress, 120),
      userAgent: clip(actor.userAgent, 400),
      emailStatus: SUPPORT_DELIVERY_STATUS.PENDING,
      telegramStatus: SUPPORT_DELIVERY_STATUS.PENDING,
      idempotencyKey: idempotencyKey || undefined,
      contentHash,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const again = await findRecentDuplicate({
        orderId: order._id,
        contentHash,
        idempotencyKey,
      });
      if (again) {
        return {
          ok: true,
          duplicate: true,
          orderId: String(order._id),
          messageId: String(again._id),
          message: copy.success,
        };
      }
    }
    console.error("[partnerSupport] persist failed:", err?.message || err);
    return { ok: false, message: "Could not save message", status: 500 };
  }

  const staffUrl = superadminOrderStaffUrl(order._id);
  const reasonLabel = supportReasonLabel(validated.reason, "en");
  const emailPayload = {
    bookingReference: ref,
    companyName,
    sender,
    reasonLabel,
    message: validated.message,
    bookingLines,
    staffOrderUrl: staffUrl,
  };
  const subject = partnerSupportEmailSubject(ref);
  const html = renderPartnerSupportMessageEmail(emailPayload);
  const text = partnerSupportEmailText(emailPayload);

  let emailStatus = SUPPORT_DELIVERY_STATUS.FAILED;
  let emailError = "";
  try {
    await sendEmailDirect({
      title: subject,
      message: text,
      html,
      to: [getRovaroSupportMailbox()],
      cc: [],
      meta: {
        type: MAIL_TYPE.ORDER_PARTNER_SUPPORT,
        orderId: String(order._id),
        companyId: order.ownerId ? String(order.ownerId) : undefined,
        payload: {
          reason: validated.reason,
          supportMessageId: String(saved._id),
        },
      },
    });
    emailStatus = SUPPORT_DELIVERY_STATUS.SENT;
  } catch (err) {
    emailError = clip(err?.message, 500);
    console.error("[partnerSupport] email failed:", emailError);
  }

  let telegramStatus = SUPPORT_DELIVERY_STATUS.SKIPPED;
  let telegramError = "";
  try {
    const telegramText = [
      `💬 Partner message about booking ${ref}`,
      `Company: ${companyName || "—"}`,
      `Reason: ${reasonLabel}`,
      "",
      sanitizeTelegramText(validated.message),
      "",
      ...bookingLines.map((line) => `${line.label}: ${line.value}`),
      "",
      staffUrl,
    ].join("\n");
    const sent = await sendTelegramDirect(telegramText);
    telegramStatus = sent
      ? SUPPORT_DELIVERY_STATUS.SENT
      : SUPPORT_DELIVERY_STATUS.SKIPPED;
  } catch (err) {
    telegramStatus = SUPPORT_DELIVERY_STATUS.FAILED;
    telegramError = clip(err?.message, 500);
    console.warn("[partnerSupport] telegram failed:", telegramError);
  }

  try {
    saved.emailStatus = emailStatus;
    saved.emailError = emailError;
    saved.telegramStatus = telegramStatus;
    saved.telegramError = telegramError;
    await saved.save();
  } catch (err) {
    console.error("[partnerSupport] status update failed:", err?.message || err);
  }

  await recordAuditEvent({
    action: "PARTNER_SUPPORT_MESSAGE_SENT",
    userRole: actor.user ? "admin" : "system",
    userId: actor.user?.id || actor.user?._id || undefined,
    userEmail: actor.user?.email || "",
    severity: "low",
    result:
      emailStatus === SUPPORT_DELIVERY_STATUS.SENT ? "success" : "partial",
    reason: validated.reason,
    ipAddress: actor.ipAddress || "",
    userAgent: actor.userAgent || "",
    orderData: {
      orderId: order._id,
      orderNumber: ref || undefined,
      carModel: order.carModel,
    },
    metadata: {
      supportMessageId: String(saved._id),
      emailStatus,
      telegramStatus,
      source: actor.source || "email_token",
    },
    errorMessage: emailError || undefined,
  });

  return {
    ok: true,
    duplicate: false,
    orderId: String(order._id),
    messageId: String(saved._id),
    emailStatus,
    telegramStatus,
    message: copy.success,
  };
}
