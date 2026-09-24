/**
 * Superadmin platform Settings information architecture.
 * Company admins and superadmins in company view stay on /admin/company.
 */

import { ROLE } from "@models/user";
import {
  isAdminViewAsActive,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";

export const PLATFORM_SETTINGS_PATH = "/admin/settings";

/** Navbar AppBar height. Sticky tabs sit immediately under it. */
export const SETTINGS_NAVBAR_HEIGHT_PX = 64;

export const SETTINGS_TAB_BAR = Object.freeze({
  desktopPosition: "sticky",
  top: `${SETTINGS_NAVBAR_HEIGHT_PX}px`,
  zIndex: 20,
  background: "#ffffff",
  borderBottom: "1px solid",
  indicatorColor: "#E9004F",
  mobileOverflowX: "auto",
  tabWhiteSpace: "nowrap",
  tabMinHeight: 48,
});

export const PLATFORM_SETTINGS_TABS = Object.freeze([
  { id: "general", label: "General" },
  { id: "locations", label: "Locations & coverage" },
  { id: "pricing", label: "Pricing" },
  { id: "delivery", label: "Delivery" },
  { id: "vouchers", label: "Vouchers" },
  { id: "legal", label: "Legal documents" },
  { id: "access", label: "Access" },
]);

const TAB_IDS = PLATFORM_SETTINGS_TABS.map((tab) => tab.id);

/**
 * Old query values and bookmarks → the tab that now holds that content.
 * Canonical tab ids are resolved first in resolvePlatformSettingsTab, so
 * aliases only apply to true legacy names (never override `pricing`, etc.).
 */
export const LEGACY_SETTINGS_TAB_ALIASES = Object.freeze({
  platform: "general",
  catalogue: "general",
  catalog: "general",
  "booking-fee": "pricing",
  fees: "pricing",
  "delivery-zones": "delivery",
  coverage: "locations",
  cities: "locations",
  discounts: "vouchers",
  documents: "legal",
  "access-links": "access",
});

/**
 * Old /admin/company?tab=… values when the superadmin hub lived there.
 * Company-hub `pricing` meant delivery charges, not booking fee.
 */
export const LEGACY_COMPANY_HUB_TAB_REDIRECTS = Object.freeze({
  "access-links": "access",
  platform: "general",
  legal: "legal",
  delivery: "delivery",
  pricing: "delivery",
  vouchers: "vouchers",
});

export function resolvePlatformSettingsTab(requested) {
  const raw = String(requested || "").trim();
  if (!raw) return "general";
  if (TAB_IDS.includes(raw)) return raw;
  const mapped = LEGACY_SETTINGS_TAB_ALIASES[raw] || raw;
  return TAB_IDS.includes(mapped) ? mapped : "general";
}

export function platformSettingsHref(tab, extra = {}) {
  const id = resolvePlatformSettingsTab(tab);
  const params = new URLSearchParams();
  params.set("tab", id);
  if (extra.section) params.set("section", String(extra.section));
  return `${PLATFORM_SETTINGS_PATH}?${params.toString()}`;
}

/**
 * Map an old company-hub tab (or settings alias) onto /admin/settings?tab=…
 */
export function legacyCompanySettingsRedirect(tab, extra = {}) {
  const raw = String(tab || "").trim();
  if (!raw) return platformSettingsHref("general", extra);
  if (LEGACY_COMPANY_HUB_TAB_REDIRECTS[raw]) {
    return platformSettingsHref(LEGACY_COMPANY_HUB_TAB_REDIRECTS[raw], extra);
  }
  return platformSettingsHref(raw, extra);
}

export function isPlatformSettingsPath(pathname) {
  const path = String(pathname || "").split("?")[0];
  return (
    path === PLATFORM_SETTINGS_PATH ||
    path.startsWith(`${PLATFORM_SETTINGS_PATH}/`)
  );
}

/**
 * Platform Settings is superadmin-only and closed while company view is on.
 * Existing API guards stay in place; this only decides the page.
 */
export function platformSettingsAccess(user) {
  if (
    !user?.isAdmin &&
    Number(user?.role) !== ROLE.SUPERADMIN &&
    Number(user?.role) !== ROLE.ADMIN
  ) {
    return { allow: false, redirectTo: "/login" };
  }
  if (!user?.isAdmin) {
    return { allow: false, redirectTo: "/login" };
  }
  if (!isSuperAdminUser(user)) {
    return { allow: false, redirectTo: "/admin/company" };
  }
  if (isAdminViewAsActive(user)) {
    return { allow: false, redirectTo: "/admin/company" };
  }
  return { allow: true, redirectTo: null };
}
