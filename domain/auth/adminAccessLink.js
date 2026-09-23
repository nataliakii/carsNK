/**
 * 7-day company-admin login via a superadmin-issued access link.
 */

import { ROLE } from "@models/user";
import { User } from "@models/user";
import { ACCESS_SCOPE } from "@/domain/auth/accessScopes";
import { connectToDB } from "@lib/database";
import { normalizeOwnerId } from "@/domain/owners/ownerScope";

export function assertAdminForCompanyLink(user, ownerId) {
  if (!user || !user.isAdmin) {
    return { ok: false, message: "Admin user not found" };
  }
  if (Number(user.role) === ROLE.SUPERADMIN) {
    return { ok: false, message: "Superadmin accounts cannot use company login links" };
  }
  const userOwner = normalizeOwnerId(user.ownerId);
  const companyId = normalizeOwnerId(ownerId);
  if (!userOwner || !companyId || userOwner !== companyId) {
    return { ok: false, message: "Admin does not belong to this company" };
  }
  return { ok: true };
}

/**
 * Load the company admin bound to an admin.console token.
 * @returns {Promise<null | { user: object }>}
 */
export async function loadAdminUserForAccessLink(tokenDoc) {
  const userId = tokenDoc?.userId;
  if (!userId) return null;
  await connectToDB();
  const user = await User.findById(userId);
  const check = assertAdminForCompanyLink(user, tokenDoc.ownerId);
  if (!check.ok) return null;
  return { user };
}

export function accessPathSuffixForScopes(scopes) {
  if ((scopes || []).includes(ACCESS_SCOPE.ADMIN_CONSOLE)) return "admin";
  return "vouchers";
}
