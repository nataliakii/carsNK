import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";

export const BOOKING_PAYMENT_STATE = Object.freeze({
  NONE: "NONE",
  PAID: "PAID",
  PAYMENT_LINK_ACTIVE: "PAYMENT_LINK_ACTIVE",
  PAYMENT_LINK_EXPIRED: "PAYMENT_LINK_EXPIRED",
});

export const PAYMENT_LINK_EXPIRED_LABEL_KEY = "paymentLinkExpired";
export const PAYMENT_LINK_EXPIRED_LABEL = "Payment link expired";

const CANCELLED_OR_DECLINED = new Set([
  BOOKING_STATUS.CUSTOMER_CANCELLED,
  BOOKING_STATUS.SUPPLIER_CANCELLED,
  BOOKING_STATUS.ADMIN_CANCELLED,
  BOOKING_STATUS.SUPPLIER_DECLINED,
  BOOKING_STATUS.NO_AVAILABILITY,
]);

const CONFIRMED_PAID_STATUSES = new Set([
  BOOKING_STATUS.BOOKING_CONFIRMED,
  BOOKING_STATUS.RENTAL_IN_PROGRESS,
  BOOKING_STATUS.COMPLETION_PENDING,
  BOOKING_STATUS.COMPLETED,
]);

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function upper(value) {
  return text(value).toUpperCase();
}

function hasExplicitPlatformSource(order) {
  const source = upper(order?.source);
  if (source) return source === "PLATFORM";
  return order?.my_order === true;
}

export function supplierAvailabilityConfirmed(order) {
  if (order?.partnerConfirmedAt) return true;
  if (lower(order?.companyEmailDecision) === "accepted") return true;
  const rental = resolveRentalState(order);
  return (
    rental === RENTAL_STATE.PARTNER_CONFIRMED ||
    rental === RENTAL_STATE.PAYMENT_PENDING ||
    rental === RENTAL_STATE.PAYMENT_EXPIRED
  );
}

export function bookingPaymentSucceeded(order) {
  const paymentStatus = lower(order?.payment?.status || order?.paymentStatus);
  if (paymentStatus === "paid" || paymentStatus === "succeeded") return true;
  if (upper(order?.bookingFeePaymentStatus) === "PAID") return true;
  if (upper(order?.customerConfirmation) === "CONFIRMED_BY_PAYMENT") return true;
  return CONFIRMED_PAID_STATUSES.has(text(order?.bookingStatus));
}

function isTerminalBeforePayment(order) {
  const status = text(order?.bookingStatus);
  const rental = resolveRentalState(order);
  return (
    CANCELLED_OR_DECLINED.has(status) ||
    rental === RENTAL_STATE.CANCELLED ||
    rental === RENTAL_STATE.DECLINED
  );
}

function hasCurrentStripeSession(order) {
  const pay = order?.payment || {};
  return lower(pay.provider) === "stripe" && Boolean(text(pay.providerPaymentId));
}

export function stripePaymentLinkIsActive(order, now = new Date()) {
  const pay = order?.payment || {};
  if (!hasCurrentStripeSession(order)) return false;
  if (!text(pay.checkoutUrl)) return false;
  if (lower(pay.status) === "paid" || lower(pay.status) === "expired") return false;
  if (pay.expiresAt && new Date(pay.expiresAt) <= now) return false;
  return true;
}

export function stripePaymentLinkIsExpired(order, now = new Date()) {
  const pay = order?.payment || {};
  if (!hasCurrentStripeSession(order)) return false;
  if (lower(pay.status) === "expired") return true;
  if (pay.expiresAt && new Date(pay.expiresAt) <= now) return true;
  return false;
}

export function resolveBookingPaymentState(order, { now = new Date() } = {}) {
  if (!order || !hasExplicitPlatformSource(order)) {
    return { state: BOOKING_PAYMENT_STATE.NONE };
  }

  if (bookingPaymentSucceeded(order)) {
    return { state: BOOKING_PAYMENT_STATE.PAID };
  }

  if (!supplierAvailabilityConfirmed(order) || isTerminalBeforePayment(order)) {
    return { state: BOOKING_PAYMENT_STATE.NONE };
  }

  if (stripePaymentLinkIsExpired(order, now)) {
    return {
      state: BOOKING_PAYMENT_STATE.PAYMENT_LINK_EXPIRED,
      label: PAYMENT_LINK_EXPIRED_LABEL,
      labelKey: PAYMENT_LINK_EXPIRED_LABEL_KEY,
      tone: "paymentExpired",
    };
  }

  if (stripePaymentLinkIsActive(order, now)) {
    return { state: BOOKING_PAYMENT_STATE.PAYMENT_LINK_ACTIVE };
  }

  return { state: BOOKING_PAYMENT_STATE.NONE };
}

export function isPaymentLinkExpired(order, opts = {}) {
  return (
    resolveBookingPaymentState(order, opts).state ===
    BOOKING_PAYMENT_STATE.PAYMENT_LINK_EXPIRED
  );
}

export function paymentStatusChipForOrder(order, opts = {}) {
  const status = resolveBookingPaymentState(order, opts);
  if (status.state !== BOOKING_PAYMENT_STATE.PAYMENT_LINK_EXPIRED) return null;
  return {
    id: "payment-link-expired",
    state: status.state,
    tone: status.tone,
    label: status.label,
    labelKey: status.labelKey,
  };
}
