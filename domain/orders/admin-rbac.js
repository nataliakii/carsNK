  /**
   * admin-rbac.js
   *
   * ════════════════════════════════════════════════════════════════
   * ⚠️ DEPRECATED: BACKWARD COMPATIBILITY SHIM — REDUCED TO MINIMAL
   * ════════════════════════════════════════════════════════════════
   *
   * 🔥 ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ ДЛЯ ПРАВ: orderAccessPolicy.js
   * 🔥 ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ ДЛЯ ВРЕМЕНИ: athensTime.js (getTimeBucket)
   *
   * Этот файл содержит ТОЛЬКО:
   * - ROLE re-export
   * - Pure role helpers (isAdmin, isSuperAdmin)
   * - Pure order type/ownership helpers (isClientOrder, isAdminCreatedOrder, getOrderCreatorId, isOwnOrder)
   * - getOrderAccess re-export (so callers can use policy directly)
   *
   * REMOVED (logic moved to orderRbacShim.js; re-exported via domain/orders/index.js):
   * - getOrderTimeBucket, isPastOrder, isFutureOrder, isCurrentOrder (use athensTime.getTimeBucket or orderRbacShim)
   * - canViewOrder, canConfirmOrder, canDeleteOrder, canEditOrder, canEditPricing, canEditOrderField (use getOrderAccess(ctx) or orderRbacShim)
   * - ADMIN_POLICY, getPermissionDeniedMessage (use orderRbacShim or index)
   *
   * Для WRITE routes используй напрямую:
   *   import { getOrderAccess, createOrderContext } from "@/domain/orders/orderAccessPolicy";
   *   import { getTimeBucket } from "@/domain/time/athensTime";
   *   import { checkFieldAccess } from "@/middleware/withOrderAccess";
   *
   * ════════════════════════════════════════════════════════════════
   */
  import { ROLE } from "@models/user";

  // ════════════════════════════════════════════════════════════════
  // RE-EXPORTS
  // ════════════════════════════════════════════════════════════════

  export { ROLE };
  export { getOrderAccess } from "./orderAccessPolicy";

  // ════════════════════════════════════════════════════════════════
  // ROLE CHECKS (pure helpers)
  // ════════════════════════════════════════════════════════════════

  export function isSuperAdmin(user) {
    return user?.isAdmin === true && user.role === ROLE.SUPERADMIN;
  }

  export function isAdmin(user) {
    return user?.isAdmin === true && user.role === ROLE.ADMIN;
  }

  // ════════════════════════════════════════════════════════════════
  // ORDER TYPE HELPERS (pure helpers)
  // ════════════════════════════════════════════════════════════════

  export function isClientOrder(order) {
    return order?.my_order === true;
  }

  export function isAdminCreatedOrder(order) {
    return order?.my_order === false;
  }

  // ════════════════════════════════════════════════════════════════
  // OWNERSHIP HELPERS (pure helpers)
  // ════════════════════════════════════════════════════════════════

  export function getOrderCreatorId(order) {
    if (!order) return null;
    if (order.createdByAdminId) return String(order.createdByAdminId);
    if (order.createdById) return String(order.createdById);
    if (order.createdBy?.id) return String(order.createdBy.id);
    if (order.createdByUserId) return String(order.createdByUserId);
    return null;
  }

  export function isOwnOrder(order, user) {
    if (!order || !user?.id) return false;
    const creatorId = getOrderCreatorId(order);
    return creatorId ? String(creatorId) === String(user.id) : false;
  }
