/**
 * Pure supplier / platform booking status helpers.
 * Safe for client components — no mongoose or notify imports.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

/** Stored supplier decision. ACCEPTED and CONFIRMED are the same value. */
export const SUPPLIER_RESPONSE = Object.freeze({
  AWAITING: "AWAITING_SUPPLIER_RESPONSE",
  ACCEPTED: "CONFIRMED",
  CONFIRMED: "CONFIRMED",
  DECLINED: "SUPPLIER_DECLINED",
});

export const SUPPLIER_AVAILABILITY_STATEMENT =
  "We confirm that the requested vehicle is available for the shown dates, pickup and return locations, and confirmed price.";

export const CUSTOMER_CONFIRMATION = Object.freeze({
  NOT_REQUESTED: "NOT_REQUESTED",
  AWAITING_ACCEPTANCE: "AWAITING_ACCEPTANCE",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  CONFIRMED_BY_PAYMENT: "CONFIRMED_BY_PAYMENT",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",
});

export function resolveCustomerConfirmation(order) {
  const stored = String(order?.customerConfirmation || "");
  const paid =
    stored === CUSTOMER_CONFIRMATION.CONFIRMED_BY_PAYMENT ||
    String(order?.bookingFeePaymentStatus || "").toUpperCase() === "PAID" ||
    String(order?.payment?.status || "").toLowerCase() === "paid";
  if (paid) return CUSTOMER_CONFIRMATION.CONFIRMED_BY_PAYMENT;
  const status = String(order?.bookingStatus || "");
  if (status === "ALTERNATIVE_PROPOSED") {
    return CUSTOMER_CONFIRMATION.AWAITING_ACCEPTANCE;
  }
  if (
    status === "PAYMENT_PROCESSING" ||
    status === "CONFIRMED_AWAITING_PAYMENT" ||
    status === "ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT"
  ) {
    return CUSTOMER_CONFIRMATION.AWAITING_PAYMENT;
  }
  if (status === "PAYMENT_EXPIRED") return CUSTOMER_CONFIRMATION.PAYMENT_EXPIRED;
  return CUSTOMER_CONFIRMATION.NOT_REQUESTED;
}

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
  const stored = String(order?.supplierResponse || "");
  if (stored === SUPPLIER_RESPONSE.DECLINED) return SUPPLIER_RESPONSE.DECLINED;
  const decision = String(order?.companyEmailDecision || "").toLowerCase();
  if (
    stored === SUPPLIER_RESPONSE.CONFIRMED ||
    decision === "accepted" ||
    order?.partnerConfirmedAt
  ) {
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
  const paid =
    String(order?.payment?.status || order?.bookingFeePaymentStatus || "")
      .toLowerCase() === "paid" ||
    order?.customerConfirmation === CUSTOMER_CONFIRMATION.CONFIRMED_BY_PAYMENT;
  if (paid) return true;
  const bookingStatus = String(order?.bookingStatus || "");
  if (
    bookingStatus === "BOOKING_CONFIRMED" ||
    bookingStatus === "COMPLETION_PENDING" ||
    bookingStatus === "COMPLETED" ||
    bookingStatus === "RENTAL_IN_PROGRESS"
  ) {
    return true;
  }
  return getPlatformBookingStatus(order) === PLATFORM_BOOKING_STATUS.CONFIRMED;
}

/** Rovaro does not confirm a booking for either party. Always false. */
export function canPlatformConfirmBooking() {
  return false;
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
