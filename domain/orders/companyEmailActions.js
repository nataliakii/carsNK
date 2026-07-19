/**
 * Company email CTA handlers: accept / reject / message → notify SUPERADMIN.
 * Does NOT flip order.confirmed (still SUPERADMIN-only).
 */

import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { DEVELOPER_EMAIL } from "@config/email";
import { getBaseUrl, absoluteUrl } from "@config/domain";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import { renderAdminOrderNotificationEmail } from "@/app/ui/email/renderEmail";
import { verifyCompanyEmailActionToken } from "./companyEmailActionToken";

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
    `Admin link: ${absoluteUrl(`/admin`)}`,
  ];
}

async function notifySuperadmins({ title, bodyLines, telegramText }) {
  const body = bodyLines.join("\n");
  const html = renderAdminOrderNotificationEmail(title, body);
  await sendEmailDirect({
    title,
    message: body,
    html,
    to: [DEVELOPER_EMAIL],
    cc: [],
  });
  try {
    await sendTelegramDirect(telegramText || `${title}\n\n${body}`);
  } catch (err) {
    console.warn(
      "[companyEmailAction] telegram failed:",
      err?.message || err
    );
  }
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
      message: `Order was already ${prev}. Contact superadmin to change.`,
      status: 409,
      decision: prev,
    };
  }

  order.companyEmailDecision = decision;
  order.companyEmailDecisionAt = new Date();
  await order.save();

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

  await notifySuperadmins({
    title,
    bodyLines: lines,
    telegramText: `${title}\n\n${lines.join("\n")}\n\nCarsNK · ${getBaseUrl()}`,
  });

  return {
    ok: true,
    already: false,
    decision,
    orderId: String(order._id),
    message:
      decision === "accepted"
        ? "Accepted. Superadmins have been notified."
        : "Rejected. Superadmins have been notified.",
  };
}

/**
 * Free-text message from company → superadmins.
 * @param {{ token: string, message: string }} params
 */
export async function sendCompanyEmailMessageToSuperadmin({ token, message }) {
  const parsed = await parseCompanyEmailActionToken(token);
  if (!parsed.ok) return parsed;
  if (parsed.action !== "message") {
    return { ok: false, message: "Token action mismatch", status: 400 };
  }

  const text = String(message || "").trim();
  if (!text || text.length < 2) {
    return { ok: false, message: "Message is required", status: 400 };
  }
  if (text.length > 4000) {
    return { ok: false, message: "Message too long", status: 400 };
  }

  const order = await loadOrder(parsed.orderId);
  if (!order) return { ok: false, message: "Order not found", status: 404 };

  const title = `💬 Company message about order #${order.orderNumber || order._id}`;
  const lines = [
    "Message from partner company (via order notification email):",
    "",
    text,
    "",
    "---",
    ...orderSummaryLines(order),
  ];

  await notifySuperadmins({
    title,
    bodyLines: lines,
    telegramText: `${title}\n\n${text}\n\n${orderSummaryLines(order).join("\n")}`,
  });

  return {
    ok: true,
    orderId: String(order._id),
    message: "Message sent to superadmins.",
  };
}
