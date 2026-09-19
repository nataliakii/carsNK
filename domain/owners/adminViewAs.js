import mongoose from "mongoose";
import { cookies } from "next/headers";
import { normalizeOwnerId, isSuperAdminUser } from "@/domain/owners/ownerScope";
import {
  ADMIN_VIEW_AS_COOKIE,
  ADMIN_VIEW_AS_MAX_AGE,
} from "@/domain/owners/adminViewAsShared";

export {
  ADMIN_VIEW_AS_COOKIE,
  ADMIN_VIEW_AS_EVENT,
  ADMIN_VIEW_AS_MAX_AGE,
} from "@/domain/owners/adminViewAsShared";

export function parseViewAsCompanyId(raw) {
  return normalizeOwnerId(raw);
}

/**
 * Attach viewAsCompanyId onto session.user for filter helpers.
 * Does not change role — superadmin stays superadmin for RBAC write power,
 * but list filters scope to the company.
 */
export function withAdminViewAs(session, companyId) {
  if (!session?.user) return session;
  const id = parseViewAsCompanyId(companyId);
  if (!id || !isSuperAdminUser(session.user)) {
    const next = { ...session, user: { ...session.user } };
    delete next.user.viewAsCompanyId;
    return next;
  }
  return {
    ...session,
    user: {
      ...session.user,
      viewAsCompanyId: id,
    },
  };
}

/** Read view-as company id from Next.js cookies() (Server Components / Route Handlers). */
export async function readAdminViewAsCompanyIdFromCookies() {
  try {
    const jar = await cookies();
    return parseViewAsCompanyId(jar.get(ADMIN_VIEW_AS_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function applyAdminViewAsFromCookies(session) {
  if (!isSuperAdminUser(session?.user)) return session;
  const id = await readAdminViewAsCompanyIdFromCookies();
  return withAdminViewAs(session, id);
}

/** Cookie options for Set-Cookie / NextResponse.cookies.set */
export function adminViewAsCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_VIEW_AS_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}

export function isValidCompanyObjectId(id) {
  return Boolean(id && mongoose.Types.ObjectId.isValid(String(id)));
}
