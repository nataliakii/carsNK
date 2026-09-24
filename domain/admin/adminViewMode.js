import { ROLE } from "@models/user";
import { isAdminViewAsActive, isSuperAdminUser } from "@/domain/owners/ownerScope";

/** Server-resolved admin surface. Company context wins over role. */
export const ADMIN_VIEW_MODE = Object.freeze({
  PLATFORM_ADMIN: "PLATFORM_ADMIN_MODE",
  COMPANY: "COMPANY_MODE",
});

export function resolveAdminViewMode(user) {
  if (!user) return null;
  const admin =
    user.isAdmin ||
    Number(user.role) === ROLE.ADMIN ||
    Number(user.role) === ROLE.SUPERADMIN;
  if (!admin) return null;
  if (isSuperAdminUser(user) && !isAdminViewAsActive(user)) {
    return ADMIN_VIEW_MODE.PLATFORM_ADMIN;
  }
  return ADMIN_VIEW_MODE.COMPANY;
}

/** Verification, rejection and suspension. Role alone is not enough. */
export function platformReviewMutationAllowed(user) {
  return resolveAdminViewMode(user) === ADMIN_VIEW_MODE.PLATFORM_ADMIN;
}
