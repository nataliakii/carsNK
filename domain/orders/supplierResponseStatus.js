/**
 * Pure supplier / platform booking status helpers.
 * Safe for client components — no mongoose or notify imports.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

export const SUPPLIER_RESPONSE = Object.freeze({
  AWAITING: "AWAITING_SUPPLIER_RESPONSE",
  ACCEPTED: "SUPPLIER_ACCEPTED",
  DECLINED: "SUPPLIER_DECLINED",
});

export const SUPPLIER_RESPONSE_PAYLOAD = Object.freeze({
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
});

export const PLATFORM_BOOKING_STATUS = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
});

export function getSupplierResponseStatus(order) {
  const decision = String(order?.companyEmailDecision || "").toLowerCase();
  if (decision === "accepted" || order?.partnerConfirmedAt) {
    if (decision === "rejected") {
      const acceptedAt = order.partnerConfirmedAt
        ? new Date(order.partnerConfirmedAt).getTime()
        : 0;
      const declinedAt = order.companyEmailDecisionAt || order.declinedAt
        ? new Date(order.companyEmailDecisionAt || order.declinedAt).getTime()
        : 0;
      if (declinedAt > acceptedAt) return SUPPLIER_RESPONSE.DECLINED;
    }
    return SUPPLIER_RESPONSE.ACCEPTED;
  }
  if (decision === "rejected" || order?.declinedAt || order?.declineReason) {
    return SUPPLIER_RESPONSE.DECLINED;
  }
  return SUPPLIER_RESPONSE.AWAITING;
}

export function getPlatformBookingStatus(order) {
  const bookingStatus = String(order?.bookingStatus || "");
  if (
    bookingStatus === BOOKING_STATUS.CUSTOMER_CANCELLED ||
    bookingStatus === BOOKING_STATUS.SUPPLIER_CANCELLED ||
    bookingStatus === BOOKING_STATUS.ADMIN_CANCELLED
  ) {
    return PLATFORM_BOOKING_STATUS.CANCELLED;
  }
  if (order?.confirmed === true) return PLATFORM_BOOKING_STATUS.CONFIRMED;
  return PLATFORM_BOOKING_STATUS.PENDING;
}

export function isSupplierResponseLocked(order) {
  return getPlatformBookingStatus(order) === PLATFORM_BOOKING_STATUS.CONFIRMED;
}

export function canPlatformConfirmBooking(order) {
  if (!order || order.confirmed === true) return false;
  if (order.my_order !== true) return true;
  return getSupplierResponseStatus(order) === SUPPLIER_RESPONSE.ACCEPTED;
}

export function validateSupplierResponsePayload(body) {
  const response = String(body?.response || "").toUpperCase();
  if (
    response !== SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED &&
    response !== SUPPLIER_RESPONSE_PAYLOAD.DECLINED
  ) {
    return { ok: false, status: 400, message: "response must be ACCEPTED or DECLINED" };
  }
  const reason = String(body?.reason || "").trim();
  if (response === SUPPLIER_RESPONSE_PAYLOAD.DECLINED && !reason) {
    return { ok: false, status: 400, message: "A reason is required when you cannot provide the vehicle." };
  }
  return { ok: true, response, reason };
}

export function buildSupplierResponsePublicFields(order) {
  const status = getSupplierResponseStatus(order);
  const meta =
    order?.partnerConfirmMeta && typeof order.partnerConfirmMeta === "object"
      ? order.partnerConfirmMeta
      : {};
  const actor = meta.actor || {};
  return {
    supplierResponse: status,
    supplierRespondedAt:
      order?.companyEmailDecisionAt ||
      order?.partnerConfirmedAt ||
      order?.declinedAt ||
      null,
    supplierRespondedByName: actor.name || "",
    supplierRespondedByEmail:
      order?.partnerConfirmedByEmail || order?.declinedByEmail || actor.email || "",
    supplierDeclineReason: order?.declineReason || "",
    supplierVehicleId: meta.vehicleId || order?.car?._id || order?.car || null,
    platformStatus: getPlatformBookingStatus(order),
    partnerConfirmedAt: order?.partnerConfirmedAt || null,
    companyEmailDecision: order?.companyEmailDecision || null,
  };
}

export function companyOwnsClientOrder(companyId, order, car) {
  if (!companyId || !order) return false;
  const orderOwner = String(order.ownerId || car?.ownerId || "");
  const carOwner = String(car?.ownerId || "");
  const company = String(companyId);
  if (!orderOwner || orderOwner !== company) return false;
  if (carOwner && carOwner !== company) return false;
  return true;
}
