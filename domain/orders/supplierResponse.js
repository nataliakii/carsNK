/**
 * Company (supplier) operational response for CLIENT rental orders.
 * Distinct from platform final confirmation (`order.confirmed`).
 *
 * Reuses existing fields:
 *   companyEmailDecision / companyEmailDecisionAt
 *   partnerConfirmedAt / partnerConfirmedByEmail / partnerConfirmMeta
 *   declineReason / declinedAt / declinedByEmail / declineMeta
 */

import { Car } from "@models/car";
import { Order } from "@models/order";
import Company from "@models/company";
import AuditLog from "@models/auditLog";
import { ROLE } from "@models/user";
import { getEffectiveOwnerId, normalizeOwnerId } from "@/domain/owners/ownerScope";
import { isPlatformAdminUser } from "@/domain/admin/adminViewMode";
import {
  AVAILABILITY_PURPOSE,
  evaluateRentalAvailability,
} from "@/domain/booking/availabilityEngine";
import { analyzeConfirmationConflicts } from "@/domain/booking/analyzeConfirmationConflicts";
import {
  isMarketplaceRequestMode,
  resolveBookingMode,
} from "@/domain/booking/bookingMode";
import { startMarketplacePaymentAfterAvailability } from "@/domain/orders/startMarketplacePaymentAfterAvailability";
import { LEGACY_FALLBACK_TZ } from "@/domain/time/resolveBusinessTimezone";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import { orderMessages } from "@/domain/messages";
import {
  SUPPLIER_RESPONSE,
  SUPPLIER_RESPONSE_PAYLOAD,
  getSupplierResponseStatus,
  isSupplierResponseLocked,
  buildSupplierResponsePublicFields,
} from "@/domain/orders/supplierResponseStatus";

export {
  SUPPLIER_RESPONSE,
  SUPPLIER_RESPONSE_PAYLOAD,
  PLATFORM_BOOKING_STATUS,
  getSupplierResponseStatus,
  getPlatformBookingStatus,
  isSupplierResponseLocked,
  canPlatformConfirmBooking,
  validateSupplierResponsePayload,
  buildSupplierResponsePublicFields,
} from "@/domain/orders/supplierResponseStatus";

const TASK_ACCEPTED = "Supplier confirmed vehicle availability";
const TASK_DECLINED = "Supplier cannot provide vehicle — platform review";

function actorFromUser(user) {
  return {
    id: user?.id || user?._id || "",
    name: String(user?.name || "").trim(),
    email: String(user?.email || "").trim(),
  };
}

function idsMatch(a, b) {
  const left = normalizeOwnerId(a);
  const right = normalizeOwnerId(b);
  return Boolean(left && right && left === right);
}

function carIdOf(order) {
  const car = order?.car;
  if (!car) return null;
  if (typeof car === "object") return car._id || car.id || null;
  return car;
}

export function companyOwnsClientOrder(companyId, order, car) {
  if (!companyId || !order) return false;
  const orderOwner = normalizeOwnerId(order.ownerId) || normalizeOwnerId(car?.ownerId);
  const carOwner = normalizeOwnerId(car?.ownerId);
  if (!orderOwner || !idsMatch(companyId, orderOwner)) return false;
  if (carOwner && !idsMatch(companyId, carOwner)) return false;
  return true;
}

async function writeAudit({ user, order, kind, metadata }) {
  try {
    await AuditLog.create({
      action:
        kind === "accepted"
          ? "BOOKING_PARTNER_CONFIRMED"
          : "BOOKING_PARTNER_DECLINED",
      userRole: user?.role === ROLE.SUPERADMIN ? "superadmin" : "admin",
      userEmail: typeof user?.email === "string" ? user.email : undefined,
      orderData: {
        orderId: order._id,
        orderNumber: order.orderNumber ? String(order.orderNumber) : undefined,
      },
      metadata: {
        kind: "ADMIN_SUPPLIER_RESPONSE",
        ...metadata,
      },
      severity: "medium",
      result: "success",
    });
  } catch (err) {
    console.error("[supplier-response] audit failed:", err?.message);
  }
}

async function notifyPlatform({ companyName, order, kind, reason, actor }) {
  const orderNumber = order.orderNumber || String(order._id);
  const company = companyName || "Company";
  if (kind === "accepted") {
    const title = `${company} confirmed vehicle availability for order ${orderNumber}`;
    await notifySuperadmin({
      title,
      bodyLines: [
        title,
        `Vehicle: ${order.carModel || order.regNumber || ""}`.trim(),
        `Responded by: ${actor.name || actor.email || "company admin"}`,
        TASK_ACCEPTED,
      ],
      telegramText: title,
      meta: { orderId: String(order._id), kind: "supplier_accepted" },
    });
    return;
  }
  const title = `${company} cannot provide the vehicle for order ${orderNumber}`;
  await notifySuperadmin({
    title,
    bodyLines: [
      title,
      `Reason: ${reason}`,
      TASK_DECLINED,
      `Responded by: ${actor.name || actor.email || "company admin"}`,
    ],
    telegramText: `${title}\nReason: ${reason}`,
    meta: { orderId: String(order._id), kind: "supplier_declined" },
  });
}

/**
 * Company-admin supplier response. Does not set order.confirmed.
 */
export async function applySupplierResponse({
  orderId,
  sessionUser,
  response,
  reason = "",
}) {
  if (isPlatformAdminUser(sessionUser)) {
    return {
      status: 403,
      body: {
        success: false,
        message: "Use company view to record a supplier response.",
        code: "company_context_required",
      },
    };
  }

  const companyId = getEffectiveOwnerId(sessionUser);
  if (!companyId) {
    return {
      status: 403,
      body: { success: false, message: "Company context is required." },
    };
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return { status: 404, body: { success: false, message: "Order not found" } };
  }

  if (order.my_order !== true) {
    return {
      status: 400,
      body: {
        success: false,
        message: "Supplier response applies to client rental orders only.",
      },
    };
  }

  const car = await Car.findById(carIdOf(order)).select("_id ownerId model regNumber").lean();
  if (!companyOwnsClientOrder(companyId, order, car)) {
    return {
      status: 403,
      body: { success: false, message: "This order does not belong to your company." },
    };
  }
  if (car && !idsMatch(companyId, car.ownerId)) {
    return {
      status: 403,
      body: { success: false, message: "The selected vehicle does not belong to your company." },
    };
  }

  if (isSupplierResponseLocked(order)) {
    return {
      status: 409,
      body: {
        success: false,
        message: "This booking is already confirmed by Rovaro. The supplier response is locked.",
        code: "SUPPLIER_RESPONSE_LOCKED",
      },
    };
  }

  const current = getSupplierResponseStatus(order);
  const nextStatus =
    response === SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED
      ? SUPPLIER_RESPONSE.ACCEPTED
      : SUPPLIER_RESPONSE.DECLINED;
  const identical =
    current === nextStatus &&
    (response !== SUPPLIER_RESPONSE_PAYLOAD.DECLINED ||
      String(order.declineReason || "").trim() === String(reason || "").trim());

  const meta =
    order.partnerConfirmMeta && typeof order.partnerConfirmMeta === "object"
      ? { ...order.partnerConfirmMeta }
      : {};

  if (identical && meta.notifiedKind === (response === "ACCEPTED" ? "accepted" : "declined")) {
    return {
      status: 200,
      body: {
        success: true,
        idempotent: true,
        message:
          response === SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED
            ? orderMessages.SUPPLIER_ACCEPTED
            : orderMessages.SUPPLIER_DECLINED,
        data: {
          confirmed: order.confirmed === true,
          ...buildSupplierResponsePublicFields(order),
        },
      },
    };
  }

  const actor = actorFromUser(sessionUser);
  const now = new Date();

  if (response === SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED) {
    const allOrdersForCar = await Order.find({ car: order.car });
    const timezone = order.timezone || LEGACY_FALLBACK_TZ;
    const bookingMode = resolveBookingMode({ order });
    const pickupAtUtc = order.pickupAtUtc || order.timeIn;
    const returnAtUtc = order.returnAtUtc || order.timeOut;
    const company = await Company.findById(companyId).select("name bufferTime").lean();
    const bufferHours =
      company?.bufferTime != null ? Number(company.bufferTime) : undefined;

    const availability = evaluateRentalAvailability({
      carId: order.car,
      pickupAtUtc,
      returnAtUtc,
      timezone,
      excludeOrderId: String(order._id),
      existingOrders: allOrdersForCar,
      bufferHours,
      purpose: AVAILABILITY_PURPOSE.CONFIRM,
      bookingMode,
    });
    const conflictAnalysis = analyzeConfirmationConflicts({
      orderToConfirm: order,
      allOrders: allOrdersForCar,
      bufferHours,
    });

    if (availability.hardConflict || !conflictAnalysis.canConfirm) {
      return {
        status: 409,
        body: {
          success: false,
          message:
            conflictAnalysis.message ||
            availability.userSafeReason ||
            "This vehicle is no longer available for the requested dates.",
          level: "block",
          conflicts: conflictAnalysis.blockedByConfirmed ?? [],
        },
      };
    }

    order.companyEmailDecision = "accepted";
    order.companyEmailDecisionAt = now;
    order.partnerConfirmedAt = now;
    order.partnerConfirmedByEmail = actor.email;
    order.declineReason = "";
    order.declinedAt = null;
    order.declinedByEmail = "";
    order.partnerConfirmMeta = {
      ...meta,
      source: "admin_supplier_response",
      actor,
      vehicleId: String(carIdOf(order) || ""),
      snapshot: {
        orderNumber: order.orderNumber || "",
        carId: String(carIdOf(order) || ""),
        carModel: order.carModel || car?.model || "",
        rentalStartDate: order.rentalStartDate,
        rentalEndDate: order.rentalEndDate,
        timeIn: order.timeIn,
        timeOut: order.timeOut,
      },
      taskTitle: TASK_ACCEPTED,
      needsPlatformReview: false,
      acceptedAt: now.toISOString(),
    };
  } else {
    order.companyEmailDecision = "rejected";
    order.companyEmailDecisionAt = now;
    order.declineReason = reason;
    order.declinedAt = now;
    order.declinedByEmail = actor.email;
    order.declineMeta = {
      actor,
      source: "admin_supplier_response",
      declinedAt: now.toISOString(),
    };
    order.partnerConfirmMeta = {
      ...meta,
      source: "admin_supplier_response",
      actor,
      vehicleId: String(carIdOf(order) || ""),
      taskTitle: TASK_DECLINED,
      needsPlatformReview: true,
      declinedAt: now.toISOString(),
      declineReason: reason,
    };
  }

  await order.save();

  const kind = response === SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED ? "accepted" : "declined";
  await writeAudit({
    user: sessionUser,
    order,
    kind,
    metadata: { response, reason: reason || undefined },
  });

  const company = await Company.findById(companyId).select("name").lean();
  try {
    await notifyPlatform({
      companyName: company?.name,
      order,
      kind,
      reason,
      actor,
    });
    order.partnerConfirmMeta = {
      ...(order.partnerConfirmMeta || {}),
      notifiedKind: kind,
      notifiedAt: new Date().toISOString(),
    };
    await order.save();
  } catch (err) {
    console.error("[supplier-response] notify failed:", err?.message);
  }

  let paymentUrl = "";
  if (kind === "accepted" && isMarketplaceRequestMode(order.bookingMode)) {
    const issued = await startMarketplacePaymentAfterAvailability({
      order,
      actorEmail: actor.email,
    });
    if (!issued.ok) {
      return {
        status: issued.status || 502,
        body: {
          success: false,
          message: issued.message,
          code: issued.code,
          data: {
            confirmed: order.confirmed === true,
            ...buildSupplierResponsePublicFields(order),
          },
        },
      };
    }
    paymentUrl = issued.paymentUrl || "";
  }

  return {
    status: 200,
    body: {
      success: true,
      idempotent: false,
      message:
        kind === "accepted"
          ? orderMessages.SUPPLIER_ACCEPTED
          : orderMessages.SUPPLIER_DECLINED,
      data: {
        confirmed: order.confirmed === true,
        paymentUrl,
        ...buildSupplierResponsePublicFields(order),
      },
    },
  };
}
