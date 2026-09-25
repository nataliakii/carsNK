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
import {
  isInternalBooking,
  isPlatformBooking,
} from "@/domain/admin/rovaroContractorAdmin";

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

function bookingFeePaid(order) {
  return String(order?.payment?.status || "").toLowerCase() === "paid";
}

/**
 * Company admins see marketplace customer identity only after the Booking
 * Fee webhook. Internal records stay visible to the company that created them.
 */
export function companyMustHideCustomerIdentity(order) {
  if (isInternalBooking(order)) return false;
  if (!isPlatformBooking(order)) return true;
  if (isMarketplaceRequestMode(order?.bookingMode)) return !bookingFeePaid(order);
  return !(order?.confirmed === true || bookingFeePaid(order));
}

function withoutPermanentDocumentUrls(order) {
  const clean = { ...order };
  const hadLicence =
    Array.isArray(order?.drivingLicenceUrls) && order.drivingLicenceUrls.length > 0;
  for (const field of PERMANENT_DOCUMENT_FIELDS) delete clean[field];
  if (hadLicence) clean.hasDrivingLicence = true;
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
    return order;
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
