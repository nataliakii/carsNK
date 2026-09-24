/**
 * Company email CTA handlers: accept / reject / message → notify SUPERADMIN.
 * Does NOT flip order.confirmed (still SUPERADMIN-only).
 */

import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { notifySuperadmin, adminCalendarUrl, superadminNotifyFooter } from "@/domain/notifications/notifySuperadmin";
import { verifyCompanyEmailActionToken } from "./companyEmailActionToken";
import AuditLog from "@models/auditLog";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import {
  assertPartnerCanOperate,
  auditPartnerComplianceBlock,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";

/**
 * @param {string} token
 * @returns {Promise<{ ok: true, orderId: string, action: string } | { ok: false, message: string, status?: number }>}
 */
export async function parseCompanyEmailActionToken(token) {
  const verified = verifyCompanyEmailActionToken(token);
  if (!verified.ok) {
    return { ok: false, message: verified.message, status: 400 };
  }
  return {
    ok: true,
    orderId: verified.orderId,
    action: verified.action,
  };
}

async function loadOrder(orderId) {
  await connectToDB();
  const order = await Order.findById(orderId);
  if (!order) return null;
  return order;
}

function orderSummaryLines(order) {
  const id = order.orderNumber || order._id?.toString?.() || "";
  const car =
    order.carModel ||
    (typeof order.car === "object" && order.car?.model) ||
    "—";
  return [
    `Order #${id}`,
    `Car: ${car}`,
    `From: ${order.rentalStartDate || "—"} ${order.timeIn || ""}`.trim(),
    `To: ${order.rentalEndDate || "—"} ${order.timeOut || ""}`.trim(),
    `Pickup: ${order.placeIn || "—"}`,
    `Return: ${order.placeOut || "—"}`,
    `Total: €${order.totalPrice ?? "—"}`,
    `Confirmed: ${order.confirmed ? "yes" : "no"}`,
    `Admin link: ${adminCalendarUrl()}`,
  ];
}

function partnerFacingDecisionMessage(decision) {
  return decision === "accepted"
    ? "Accepted. Rovaro support has been notified."
    : "Rejected. Rovaro support has been notified.";
}

async function notifySuperadmins({ title, bodyLines, telegramText }) {
  await notifySuperadmin({
    title,
    bodyLines,
    telegramText:
      telegramText ||
      `${title}\n\n${bodyLines.join("\n")}\n\n${superadminNotifyFooter()}`,
  });
}

/**
 * Accept or reject from company email link.
 * @param {{ token: string, decision: 'accepted'|'rejected' }} params
 */
export async function applyCompanyEmailDecision({ token, decision }) {
  const parsed = await parseCompanyEmailActionToken(token);
  if (!parsed.ok) return parsed;

  const expectedAction = decision === "accepted" ? "accept" : "reject";
  if (parsed.action !== expectedAction) {
    return { ok: false, message: "Token action mismatch", status: 400 };
  }

  const order = await loadOrder(parsed.orderId);
  if (!order) return { ok: false, message: "Order not found", status: 404 };

  if (decision === "accepted" && isMarketplaceRequestMode(order.bookingMode)) {
    const emailGate = await assertPartnerCanOperate(order.ownerId, {
      purpose: PARTNER_OPERATION_PURPOSE.EMAIL_ACCEPT,
    });
    if (!emailGate.allowed) {
      await auditPartnerComplianceBlock({
        purpose: PARTNER_OPERATION_PURPOSE.EMAIL_ACCEPT,
        result: emailGate,
        actorRole: "system",
        orderId: order._id,
      });
      return {
        ok: false,
        status: 403,
        error: emailGate.error,
        code: emailGate.code,
        message: emailGate.partnerMessage,
      };
    }
  }

  const prev = order.companyEmailDecision
    ? String(order.companyEmailDecision)
    : null;

  if (prev === decision) {
    return {
      ok: true,
      already: true,
      decision,
      orderId: String(order._id),
      message: `Already marked as ${decision}`,
    };
  }

  if (prev && prev !== decision) {
    return {
      ok: false,
      message: `Order was already ${prev}. Contact Rovaro support to change.`,
      status: 409,
      decision: prev,
    };
  }

  order.companyEmailDecision = decision;
  order.companyEmailDecisionAt = new Date();
  await order.save();

  try {
    await AuditLog.create({
      action: "CHANGE_ORDER_STATUS",
      userRole: "system",
      orderData: {
        orderId: order._id,
        orderNumber: order.orderNumber ? String(order.orderNumber) : undefined,
      },
      metadata: {
        source: "company_email_action",
        decision,
      },
      reason: `company_email_${decision}`,
      severity: "low",
      result: "success",
    });
  } catch (err) {
    console.error(
      "[companyEmailAction] audit persist failed:",
      err?.message || err
    );
  }

  const title =
    decision === "accepted"
      ? `✅ Company ACCEPTED order #${order.orderNumber || order._id}`
      : `⛔ Company REJECTED order #${order.orderNumber || order._id}`;

  const lines = [
    decision === "accepted"
      ? "The partner company accepted this booking request from the notification email."
      : "The partner company rejected this booking request from the notification email.",
    "",
    ...orderSummaryLines(order),
    "",
    "Note: order.confirmed is unchanged — only SUPERADMIN can confirm in admin.",
  ];

  try {
    const {
      notifyBookingAccepted,
      notifyBookingDeclined,
    } = await import("@/domain/mail/notificationPolicy");
    if (decision === "accepted") {
      await notifyBookingAccepted({
        orderId: String(order._id),
        companyId: order.ownerId ? String(order.ownerId) : "",
        orderNumber: order.orderNumber,
        actorEmail: "company-email-action",
        status: "accepted",
        timestamp: new Date(),
      });
    } else {
      await notifyBookingDeclined({
        orderId: String(order._id),
        companyId: order.ownerId ? String(order.ownerId) : "",
        orderNumber: order.orderNumber,
        customerName: order.customerName || "",
        actorEmail: "company-email-action",
        reasonCode: "other",
        explanation: "Declined via company email action link",
        feePaid: false,
        status: "declined",
        timestamp: new Date(),
      });
    }
  } catch (err) {
    console.error(
      "[companyEmailAction] matrix notify failed, falling back:",
      err?.message || err
    );
    await notifySuperadmins({
      title,
      bodyLines: lines,
      telegramText: `${title}\n\n${lines.join("\n")}\n\n${superadminNotifyFooter()}`,
    });
  }

  return {
    ok: true,
    already: false,
    decision,
    orderId: String(order._id),
    message: partnerFacingDecisionMessage(decision),
  };
}

/**
 * Free-text message from company → Rovaro support (token flow).
 * @param {{ token: string, message: string, reason?: string, idempotencyKey?: string, ipAddress?: string, userAgent?: string, locale?: string }} params
 */
export async function sendCompanyEmailMessageToSuperadmin({
  token,
  message,
  reason,
  idempotencyKey,
  ipAddress,
  userAgent,
  locale,
}) {
  const { sendPartnerSupportMessage, resolvePartnerSupportAccess } =
    await import("./partnerSupportMessage");

  const access = await resolvePartnerSupportAccess({ token });
  if (!access.ok) return access;

  const order = await loadOrder(access.orderId);
  if (!order) return { ok: false, message: "Order not found", status: 404 };

  return sendPartnerSupportMessage({
    order,
    message,
    reason,
    locale,
    actor: {
      source: "email_token",
      idempotencyKey,
      ipAddress,
      userAgent,
    },
  });
}
