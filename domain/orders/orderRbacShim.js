/**
 * orderRbacShim.js
 *
 * Thin wrappers over orderAccessPolicy + athensTime for legacy can* / time / policy exports.
 * No React, no confirmOrderFlow, no notification dispatcher — so tests can import without heavy deps.
 *
 * Permission authority: orderAccessPolicy.getOrderAccess only.
 */

import { getTimeBucket } from "@/domain/time/athensTime";
import {
  createOrderContext,
  getOrderAccess,
  getDisabledFields,
} from "./orderAccessPolicy";

// --- Time helpers: legacy "completed"|"current"|"future" from getTimeBucket
export function getOrderTimeBucket(order) {
  if (!order || (order.rentalStartDate == null && order.rentalEndDate == null)) return null;
  const t = getTimeBucket(order);
  return t === "PAST" ? "completed" : t === "CURRENT" ? "current" : "future";
}

export function isPastOrder(order) {
  return getOrderTimeBucket(order) === "completed";
}

export function isFutureOrder(order) {
  return getOrderTimeBucket(order) === "future";
}

export function isCurrentOrder(order) {
  return getOrderTimeBucket(order) === "current";
}

// --- Permission shims: getOrderAccess(createOrderContext(...)) only
function createContext(order, user) {
  const timeBucket = getTimeBucket(order);
  return createOrderContext(
    order,
    user,
    (o) => getTimeBucket(o) === "PAST",
    timeBucket
  );
}

function allow() {
  return { allowed: true, reason: null };
}

function deny(reason) {
  return { allowed: false, reason };
}

export function canViewOrder(order, user) {
  if (!user?.isAdmin) return false;
  return true;
}

export function canConfirmOrder(order, user) {
  if (!user?.isAdmin) return deny("Not an admin");
  const access = getOrderAccess(createContext(order, user));
  return access.canConfirm ? allow() : deny("Only superadmin can confirm or unconfirm orders");
}

export function canDeleteOrder(order, user) {
  if (!user?.isAdmin) return deny("Not an admin");
  const access = getOrderAccess(createContext(order, user));
  return access.canDelete ? allow() : deny("Cannot delete this order");
}

export function canEditOrder(order, user) {
  if (!user?.isAdmin) return deny("Not an admin");
  const access = getOrderAccess(createContext(order, user));
  return access.canEdit ? allow() : deny(access.isViewOnly ? "Order is view-only" : "Cannot edit this order");
}

export function canEditPricing(order, user) {
  if (!user?.isAdmin) return deny("Not an admin");
  const access = getOrderAccess(createContext(order, user));
  return access.canEditPricing ? allow() : deny("Cannot edit pricing");
}

export function canEditOrderField(order, user, field) {
  if (!user?.isAdmin) return deny("Not an admin");
  const access = getOrderAccess(createContext(order, user));
  const disabled = getDisabledFields(access);
  return disabled.includes(field) ? deny("Cannot edit this field") : allow();
}

export const ADMIN_POLICY = {
  ADMIN_CAN_DELETE_CLIENT_ORDERS: false,
  ADMIN_CAN_DELETE_PAST_INTERNAL_ORDERS: false,
  ADMIN_CAN_DELETE_CURRENT_INTERNAL_ORDERS: false,
  ADMIN_CAN_EDIT_PAST_INTERNAL_ORDERS: false,
};

export function getPermissionDeniedMessage(reason, locale = "en") {
  const messages = {
    en: {
      "Admin cannot delete client orders": "Admin cannot delete client orders",
      "Admin cannot delete past orders": "Admin cannot delete past orders",
      "Admin cannot delete current orders": "Admin cannot delete current orders",
      "Only superadmin can confirm or unconfirm orders": "Only superadmin can confirm or unconfirm orders",
      "Cannot edit this order": "Cannot edit this order",
      "Order is view-only": "Order is view-only",
    },
    ru: {
      "Admin cannot delete client orders": "Админ не может удалять клиентские заказы",
      "Admin cannot delete past orders": "Админ не может удалять прошлые заказы",
      "Admin cannot delete current orders": "Админ не может удалять текущие заказы",
      "Only superadmin can confirm or unconfirm orders": "Только суперадмин может подтверждать заказы",
      "Cannot edit this order": "Невозможно редактировать заказ",
      "Order is view-only": "Заказ только для просмотра",
    },
  };
  return messages[locale]?.[reason] || reason || "Permission denied";
}
