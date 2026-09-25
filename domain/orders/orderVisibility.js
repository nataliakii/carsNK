/**
 * orderVisibility.js
 * 
 * ЧИСТАЯ ЛОГИКА visibility.
 * 
 * ❗ Никаких fetch, session, response, mongoose
 * ❗ Только правила "что скрывать"
 * 
 * Правила:
 * - SUPERADMIN → всё видно
 * - ADMIN + internal order → всё видно
 * - ADMIN + confirmed client order → всё видно
 * - ADMIN + unconfirmed client order → PII скрыты
 * - НЕ-админ → PII скрыты для client orders
 */

import { ROLE } from "./admin-rbac";
import { policyRoleFromUser } from "@/domain/admin/adminViewMode";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  isInternalBooking,
  isMarketplaceBookingFeePaid,
  isPlatformBooking,
} from "@/domain/admin/rovaroContractorAdmin";
import {
  hasDrivingLicenceSnapshot,
  redactDrivingLicenceSnapshot,
} from "@/domain/legal/drivingLicenceSnapshot";

export const CLIENT_PRIVATE_FIELDS = [
  "customerName",
  "phone",
  "email",
  "Viber",
  "Whatsapp",
  "Telegram",
];

const CLIENT_PRIVATE_META_FIELDS = ["confirmationEmailHistory"];

const PERMANENT_DOCUMENT_FIELDS = [
  "drivingLicenceUrls",
  "passportUrls",
  "identityDocumentUrls",
];

/** Licence fields that must never survive serialisation to a company admin. */
const LICENCE_SNAPSHOT_FIELD = "drivingLicenceSnapshot";

/** Same paid stages as bookingCapabilities — reveal contacts once here. */
const PLATFORM_PAID_BOOKING_STATUSES = new Set([
  BOOKING_STATUS.BOOKING_CONFIRMED,
  BOOKING_STATUS.RENTAL_IN_PROGRESS,
  BOOKING_STATUS.COMPLETION_PENDING,
  BOOKING_STATUS.COMPLETED,
]);

export function maskCustomerName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  return parts
    .map((part) => (part.length <= 1 ? `${part}***` : `${part.slice(0, 1)}***`))
    .join(" ");
}

function platformBookingInPaidStage(order) {
  if (isMarketplaceBookingFeePaid(order)) return true;
  if (
    PLATFORM_PAID_BOOKING_STATUSES.has(String(order?.bookingStatus || "").trim())
  ) {
    return true;
  }
  return String(order?.payment?.status || "")
    .trim()
    .toLowerCase() === "paid";
}

/**
 * Same paid unlock used for contacts, calendar name reveal, and driving docs.
 * Prefer this over reading `payment.status` alone — stage can lead the webhook.
 */
export function isPlatformCustomerDataUnlocked(order) {
  return platformBookingInPaidStage(order);
}

/**
 * Company admins see marketplace customer identity only after the Booking
 * Fee / confirmed-paid stage. Internal records stay visible to the company
 * that created them. Uses the same paid signals as Booking Details capabilities.
 */
export function companyMustHideCustomerIdentity(order) {
  if (isInternalBooking(order)) return false;
  if (!isPlatformBooking(order)) return true;
  if (platformBookingInPaidStage(order)) return false;
  if (isMarketplaceRequestMode(order?.bookingMode)) return true;
  return order?.confirmed !== true;
}

function withoutPermanentDocumentUrls(order) {
  const clean = { ...order };
  const hadLicence =
    (Array.isArray(order?.drivingLicenceUrls) &&
      order.drivingLicenceUrls.length > 0) ||
    hasDrivingLicenceSnapshot(order);
  for (const field of PERMANENT_DOCUMENT_FIELDS) delete clean[field];
  if (hadLicence) clean.hasDrivingLicence = true;
  // Metadata is allowed here (the company already passed the access gate), but
  // the storage pointer never is — documents are read only through the
  // authorised download endpoint.
  const licence = redactDrivingLicenceSnapshot(order?.drivingLicenceSnapshot);
  if (licence) clean.drivingLicenceSnapshot = licence;
  else delete clean.drivingLicenceSnapshot;
  return clean;
}

/**
 * Удаляет PII из заказа
 */
function stripPII(order) {
  const clean = { ...order };
  for (const field of CLIENT_PRIVATE_FIELDS) {
    delete clean[field];
  }
  for (const field of CLIENT_PRIVATE_META_FIELDS) {
    delete clean[field];
  }
  for (const field of PERMANENT_DOCUMENT_FIELDS) {
    delete clean[field];
  }
  // Before the verified Booking Fee payment the company may not see the licence
  // at all — not the holder's name, not the number, not even that one exists.
  delete clean[LICENCE_SNAPSHOT_FIELD];
  delete clean.hasDrivingLicence;
  clean.customerName = maskCustomerName(order?.customerName);
  clean._visibility = {
    hideClientContacts: true,
    reason: "Client PII hidden until the Booking Fee is paid",
  };
  return clean;
}

/**
 * Применяет visibility к одному заказу.
 * 
 * @param {Object} order - Plain object
 * @param {Object} user - session.user
 * @returns {Object} Order с примененной visibility
 */
export function applyVisibilityToOrder(order, user) {
  if (!order) return order;

  if (user?.isAdmin && policyRoleFromUser(user) === ROLE.SUPERADMIN) {
    // Superadmin sees the licence metadata (support and security review), but
    // the storage pointer is stripped for everyone without exception.
    if (!order.drivingLicenceSnapshot) return order;
    return {
      ...order,
      drivingLicenceSnapshot: redactDrivingLicenceSnapshot(
        order.drivingLicenceSnapshot
      ),
    };
  }

  if (!companyMustHideCustomerIdentity(order)) {
    return withoutPermanentDocumentUrls(order);
  }

  return stripPII(order);
}

/**
 * Применяет visibility к массиву заказов.
 */
export function applyVisibilityToOrders(orders, user) {
  if (!Array.isArray(orders)) return orders;
  return orders.map((o) => applyVisibilityToOrder(o, user));
}

/**
 * Получает информацию о visibility для UI.
 */
export function getOrderVisibility(order, user) {
  if (user?.isAdmin && policyRoleFromUser(user) === ROLE.SUPERADMIN) {
    return { hideClientContacts: false, reason: null };
  }

  if (!companyMustHideCustomerIdentity(order)) {
    return { hideClientContacts: false, reason: null };
  }

  return {
    hideClientContacts: true,
    reason: "Client PII hidden until the Booking Fee is paid",
  };
}
