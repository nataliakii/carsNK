/**
 * Idempotent notification delivery via MailLog.idempotencyKey.
 * Stable key = event type + entity id (+ audience). Retries collide.
 */

import { connectToDB } from "@lib/database";
import MailLog from "@models/MailLog";
import { MAIL_STATUS } from "@/domain/mail/mailTypes";
import { buildNotificationIdempotencyKey } from "@/domain/mail/notificationEvents";

/**
 * @returns {Promise<boolean>} true when a successful/skipped delivery already exists
 */
export async function hasNotificationBeenDelivered({
  eventType,
  entityId,
  audience = "",
}) {
  const key = buildNotificationIdempotencyKey(eventType, entityId, audience);
  if (!key) return false;
  try {
    await connectToDB();
    const row = await MailLog.findOne({
      idempotencyKey: key,
      status: { $in: [MAIL_STATUS.SENT, MAIL_STATUS.SKIPPED] },
    })
      .select("_id")
      .lean();
    return Boolean(row);
  } catch (err) {
    // Missing DB / buffering in unit tests must not block sends or hang callers.
    console.warn(
      "[notificationIdempotency] check skipped:",
      err?.message || err
    );
    return false;
  }
}

/**
 * Record a failed attempt without marking the key as delivered,
 * so a later retry may succeed. Omits sensitive content.
 */
export async function recordNotificationFailure({
  eventType,
  entityId,
  audience = "",
  error = "",
  meta = {},
}) {
  const key = buildNotificationIdempotencyKey(eventType, entityId, audience);
  if (!key) return;
  await connectToDB();
  try {
    await MailLog.create({
      idempotencyKey: `${key}:fail:${Date.now()}`,
      type: String(meta.type || eventType || "notification"),
      subject: String(meta.subject || "").slice(0, 500),
      to: [],
      status: MAIL_STATUS.FAILED,
      error: String(error || "").slice(0, 1000),
      orderId: meta.orderId || null,
      companyId: meta.companyId || null,
      payload: {
        eventType,
        entityId: String(entityId || ""),
        audience: String(audience || ""),
        phase: "failed",
      },
      text: "",
      html: "",
      sentAt: new Date(),
    });
  } catch (err) {
    console.warn("[notificationIdempotency] failure log:", err?.message || err);
  }
}

export { buildNotificationIdempotencyKey };
