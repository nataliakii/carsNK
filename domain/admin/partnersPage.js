import {
  isAdminViewAsActive,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";

export const PARTNERS_PATH = "/admin/partners";

export function partnersTabHref(tab = "all", extra = {}) {
  const params = new URLSearchParams();
  params.set("tab", tab === "review" ? "review" : "all");
  if (extra.filter) params.set("filter", String(extra.filter));
  if (extra.companyId) params.set("companyId", String(extra.companyId));
  return `${PARTNERS_PATH}?${params.toString()}`;
}

/** Old Partner reviews URLs. Other legal tabs stay on /admin/legal. */
export function legacyLegalPartnersRedirect(search = {}) {
  if (String(search.tab || "") !== "partners") return null;
  return partnersTabHref("review", {
    filter: search.filter,
    companyId: search.companyId,
  });
}

/**
 * Partner list and review are superadmin-only and hidden in company context.
 */
export function partnersPageAccess(user) {
  if (!isSuperAdminUser(user)) {
    return { allow: false, redirectTo: "/admin/cars" };
  }
  if (isAdminViewAsActive(user)) {
    return { allow: false, redirectTo: "/admin/orders-calendar" };
  }
  return { allow: true, redirectTo: null };
}
