/**
 * Who may open one order in the contractor admin.
 * Another company gets the same Not found response as a missing order.
 */

import {
  getEffectiveOwnerId,
  isAnyAdminUser,
  isSuperAdminUser,
  normalizeOwnerId,
} from "@/domain/owners/ownerScope";

export function supplierCanReadOrder(user, order) {
  if (!isAnyAdminUser(user)) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  if (!order) {
    return { ok: false, status: 404, message: "Not found" };
  }
  if (isSuperAdminUser(user) && !normalizeOwnerId(user.viewAsCompanyId)) {
    return { ok: true };
  }
  const companyId = getEffectiveOwnerId(user);
  const orderOwner = normalizeOwnerId(order.ownerId);
  if (!companyId || !orderOwner || companyId !== orderOwner) {
    return { ok: false, status: 404, message: "Not found" };
  }
  return { ok: true };
}
