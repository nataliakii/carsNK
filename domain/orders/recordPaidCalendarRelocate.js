/**
 * Side effects after a successful calendar relocate of a paid platform booking.
 */

import AuditLog from "@models/auditLog";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import { ROLE } from "@/domain/orders/admin-rbac";

/**
 * @param {{
 *   order: object,
 *   previous: object,
 *   user: object,
 *   kind: "car"|"dates"|"car+dates",
 *   ipAddress?: string,
 *   userAgent?: string,
 * }} params
 */
export async function recordPaidCalendarRelocate({
  order,
  previous,
  user,
  kind,
  ipAddress = "",
  userAgent = "",
}) {
  const orderId = String(order?._id || previous?._id || "");
  const orderNumber =
    order?.orderNumber || previous?.orderNumber || orderId.slice(-8);
  const actor =
    user?.email || user?.name || user?.id || user?._id || "company admin";
  const isSuper = user?.role === ROLE.SUPERADMIN;

  const beforeCar = previous?.carNumber || previous?.carModel || "";
  const afterCar = order?.carNumber || order?.carModel || "";
  const beforeStart = previous?.rentalStartDate;
  const beforeEnd = previous?.rentalEndDate;
  const afterStart = order?.rentalStartDate;
  const afterEnd = order?.rentalEndDate;

  try {
    await recordAuditEvent({
      action: "ORDER_CALENDAR_RELOCATED",
      userRole: isSuper ? "superadmin" : "admin",
      userId: user?.id || user?._id || null,
      userEmail: user?.email || "",
      severity: "high",
      result: "success",
      reason: "Paid platform booking relocated on calendar with customer acknowledgement",
      ipAddress,
      userAgent,
      orderData: {
        orderId,
        orderNumber,
        before: {
          carNumber: beforeCar,
          rentalStartDate: beforeStart,
          rentalEndDate: beforeEnd,
          timeIn: previous?.timeIn,
          timeOut: previous?.timeOut,
        },
        after: {
          carNumber: afterCar,
          rentalStartDate: afterStart,
          rentalEndDate: afterEnd,
          timeIn: order?.timeIn,
          timeOut: order?.timeOut,
        },
      },
      metadata: { kind, customerAck: true },
    });
  } catch (err) {
    console.warn(
      "[calendarRelocate] audit failed:",
      err?.message || err
    );
  }

  // Superadmin already sees their own action in the log; still notify ops inbox
  // when a company admin moves a paid booking.
  if (isSuper) return;

  const bodyLines = [
    `Order: ${orderNumber}`,
    `By: ${actor}`,
    `Kind: ${kind}`,
    beforeCar || afterCar
      ? `Car: ${beforeCar || "—"} → ${afterCar || "—"}`
      : null,
    beforeStart || afterStart
      ? `Dates: ${formatDay(beforeStart)} → ${formatDay(beforeEnd)}  ⇒  ${formatDay(afterStart)} → ${formatDay(afterEnd)}`
      : null,
    "Customer acknowledgement recorded on the calendar move confirm.",
  ].filter(Boolean);

  try {
    await notifySuperadmin({
      title: `Paid booking relocated — ${orderNumber}`,
      bodyLines,
      meta: { orderId, orderNumber, kind },
    });
  } catch (err) {
    console.warn(
      "[calendarRelocate] notifySuperadmin failed:",
      err?.message || err
    );
  }
}

function formatDay(value) {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return String(value);
  }
}

// Ensure AuditLog model is loaded for enum registration side effects.
void AuditLog;
