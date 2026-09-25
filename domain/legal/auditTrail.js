/**
 * Audit helper for the legal / compliance workstream.
 *
 * Audit writes must never break the business operation they describe. Every
 * helper here swallows its own errors and reports them on the console, so a
 * failing AuditLog insert can never roll back a booking, a payment or an
 * agreement acceptance.
 */

import AuditLog from "@models/auditLog";
import { connectToDB } from "@lib/database";

/**
 * Extract request context for the audit trail.
 * @param {Request} request
 */
export function extractAuditContext(request) {
  const headers = request?.headers;
  const get = (name) => {
    try {
      return headers?.get?.(name) || "";
    } catch {
      return "";
    }
  };
  const forwarded = get("x-forwarded-for");
  const ipAddress =
    (forwarded ? forwarded.split(",")[0] : "").trim() ||
    get("x-real-ip") ||
    get("cf-connecting-ip") ||
    "";
  return { ipAddress, userAgent: get("user-agent") };
}

/**
 * Write an audit entry. Never throws.
 *
 * @param {{
 *   action: string,
 *   userRole?: "admin"|"superadmin"|"system",
 *   userId?: string|null,
 *   userEmail?: string,
 *   severity?: "low"|"medium"|"high"|"critical",
 *   result?: "success"|"failure"|"partial",
 *   reason?: string,
 *   ipAddress?: string,
 *   userAgent?: string,
 *   orderData?: object,
 *   metadata?: object,
 *   errorMessage?: string,
 * }} entry
 * @returns {Promise<boolean>} true when persisted
 */
export async function recordAuditEvent(entry) {
  try {
    await connectToDB();
    await AuditLog.create({
      action: entry.action,
      userRole: entry.userRole || "system",
      userId: entry.userId || undefined,
      userEmail: entry.userEmail || "",
      severity: entry.severity || "medium",
      result: entry.result || "success",
      reason: entry.reason ? String(entry.reason).slice(0, 1000) : undefined,
      ipAddress: entry.ipAddress || "",
      userAgent: entry.userAgent || "",
      orderData: entry.orderData,
      metadata: entry.metadata,
      errorMessage: entry.errorMessage,
    });
    return true;
  } catch (err) {
    console.error("[audit] failed to record", entry?.action, err?.message || err);
    return false;
  }
}

/**
 * Chronological legal trail for one order — feeds the superadmin
 * Booking legal audit view.
 *
 * @param {string} orderId
 */
export async function getOrderAuditTrail(orderId) {
  try {
    await connectToDB();
    return await AuditLog.find({ "orderData.orderId": orderId })
      .sort({ createdAt: 1 })
      .lean();
  } catch (err) {
    console.error("[audit] trail lookup failed", err?.message || err);
    return [];
  }
}

/**
 * Every access to a customer driving licence image is logged, including who
 * looked and from where.
 *
 * @param {{ orderId: string, userId?: string, userEmail?: string,
 *           userRole?: string, ipAddress?: string, userAgent?: string,
 *           mode: "view"|"download", assetRef?: string }} params
 */
export function recordDrivingLicenceAccess({
  orderId,
  userId,
  userEmail,
  userRole = "admin",
  ipAddress,
  userAgent,
  mode,
  assetRef = "",
  result = "success",
  reason,
}) {
  return recordAuditEvent({
    action: "DRIVING_LICENCE_ACCESSED",
    userRole,
    userId,
    userEmail,
    severity: "high",
    result,
    reason,
    ipAddress,
    userAgent,
    orderData: { orderId },
    // assetRef is a storage reference. Signed URLs, download grants and
    // document bytes must never reach the audit trail.
    metadata: { mode, assetRef },
  });
}

/**
 * A refused attempt to reach a driving licence.
 *
 * Logged with the same care as a success: security review needs to see who
 * tried, on which booking and why it was refused — including the case where the
 * caller was told "not found" because they belong to another company.
 *
 * @param {{ orderId: string, userId?: string, userEmail?: string,
 *           userRole?: string, ipAddress?: string, userAgent?: string,
 *           mode?: "view"|"download", reason?: string }} params
 */
export function recordDrivingLicenceAccessDenied({
  orderId,
  userId,
  userEmail,
  userRole = "admin",
  ipAddress,
  userAgent,
  mode = "view",
  reason = "denied",
}) {
  return recordAuditEvent({
    action: "DRIVING_LICENCE_ACCESS_DENIED",
    userRole,
    userId,
    userEmail,
    severity: "high",
    result: "failure",
    reason,
    ipAddress,
    userAgent,
    orderData: { orderId },
    metadata: { mode },
  });
}

/**
 * Automatic retention deletion of a customer's driving licence images.
 *
 * Erasure is as auditable as access: the trail has to show that the documents
 * were removed by the retention policy rather than quietly disappearing, and
 * a failed attempt has to be visible so it can be chased.
 *
 * @param {{ orderId: string, assetRefs?: string[], retentionDays: number,
 *           rentalEndedAt?: Date|string|null, result?: "success"|"failure",
 *           reason?: string, errorMessage?: string,
 *           userEmail?: string }} params
 */
export function recordDrivingLicenceDeletion({
  orderId,
  assetRefs = [],
  retentionDays,
  rentalEndedAt = null,
  result = "success",
  reason,
  errorMessage,
  userEmail = "",
}) {
  const failed = result === "failure";
  return recordAuditEvent({
    action: failed
      ? "DRIVING_LICENCE_DELETION_FAILED"
      : "DRIVING_LICENCE_DELETED",
    userRole: "system",
    userEmail,
    severity: failed ? "high" : "medium",
    result,
    reason,
    errorMessage,
    orderData: { orderId },
    metadata: {
      assetRefs,
      assetCount: assetRefs.length,
      retentionDays,
      rentalEndedAt: rentalEndedAt ? new Date(rentalEndedAt).toISOString() : null,
    },
  });
}
