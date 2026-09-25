/**
 * Admin top-nav IA
 *
 * Partner: Calendar | Cars | Orders | Company | Legal
 * Superadmin: Calendar | Cars | Orders | Partners | Settings | Emails | Visits
 */

import {
  PLATFORM_SETTINGS_PATH,
  isPlatformSettingsPath,
} from "@/domain/admin/platformSettingsNav";

export const ADMIN_PATHS = {
  calendar: "/admin/orders-calendar",
  cars: "/admin/cars",
  orders: "/admin/orders",
  company: "/admin/company",
  /** Superadmin platform Settings hub. */
  settings: PLATFORM_SETTINGS_PATH,
  /** Partner company legal page: details, documents, terms. */
  legal: "/admin/company/setup?step=details",
  /** Superadmin platform legal documents (Settings → Legal documents). */
  legalHub: `${PLATFORM_SETTINGS_PATH}?tab=legal`,
  partners: "/admin/partners",
  owners: "/admin/owners",
  visits: "/admin/website-visits",
  emails: "/admin/emails",
};

export function isAdminCalendarSection(pathname) {
  return pathname?.startsWith("/admin/orders-calendar");
}

export function isAdminCarsSection(pathname) {
  return pathname?.startsWith("/admin/cars");
}

export function isAdminOrdersSection(pathname) {
  return pathname === "/admin/orders" || pathname?.startsWith("/admin/transfers");
}

export function isAdminCompanySection(pathname) {
  if (
    !pathname ||
    pathname.startsWith("/admin/company/legal") ||
    pathname.startsWith("/admin/company/setup")
  ) {
    return false;
  }
  if (isPlatformSettingsPath(pathname)) return false;
  return (
    pathname.startsWith("/admin/company") ||
    pathname.startsWith("/admin/delivery-zones") ||
    pathname.startsWith("/admin/vouchers") ||
    pathname.startsWith("/admin/access-tokens") ||
    pathname.startsWith("/admin/platform")
  );
}

export function isAdminSettingsSection(pathname) {
  if (!pathname) return false;
  if (isPlatformSettingsPath(pathname)) return true;
  const path = pathname.split("?")[0];
  // Legacy bookmarks that redirect into Settings still highlight Settings.
  return (
    path === "/admin/legal" ||
    path.startsWith("/admin/legal/") ||
    path === "/admin/platform" ||
    path.startsWith("/admin/platform/") ||
    path === "/admin/access-tokens" ||
    path.startsWith("/admin/access-tokens/")
  );
}

export function isAdminLegalSection(pathname) {
  if (!pathname) return false;
  const path = pathname.split("?")[0];
  if (isPlatformSettingsPath(pathname)) {
    return /(?:\?|&)tab=legal(?:&|$)/.test(pathname);
  }
  return (
    path === "/admin/legal" ||
    path.startsWith("/admin/legal/") ||
    path.startsWith("/admin/legal-profile") ||
    path.startsWith("/admin/company/legal") ||
    path.startsWith("/admin/company/setup")
  );
}

export function isAdminPartnersSection(pathname) {
  if (!pathname) return false;
  const path = pathname.split("?")[0];
  return path === ADMIN_PATHS.partners || path.startsWith("/admin/owners");
}

export function isAdminOwnersSection(pathname) {
  return isAdminPartnersSection(pathname);
}

export function isAdminVisitsSection(pathname) {
  return pathname?.startsWith("/admin/website-visits");
}

export function isAdminEmailsSection(pathname) {
  return pathname?.startsWith("/admin/emails");
}

/**
 * In-page Company hub tabs (company admins and superadmin company view).
 * Platform Settings live on /admin/settings — not here.
 */
export const COMPANY_HUB_TAB_ALIASES = {
  contacts: "people",
  "delivery-zones": "delivery",
};

export function resolveCompanyHubTab(requested, tabIds) {
  if (!requested) return null;
  const mapped = COMPANY_HUB_TAB_ALIASES[requested] || requested;
  return tabIds.includes(mapped) ? mapped : null;
}

export function getCompanyHubTabIds({
  hasCompanyContext,
  showSuperAdminTabs: _showSuperAdminTabs,
}) {
  if (hasCompanyContext) {
    return [
      "storefront",
      "offices",
      "people",
      "delivery",
      "pricing",
      "transfer",
      "vouchers",
    ];
  }
  // Bare platform hub moved to /admin/settings; keep empty for safety.
  return [];
}

/**
 * @param {object} opts
 * @param {(key: string, opts?: object) => string} opts.t
 * @param {boolean} opts.showSuperAdminChrome
 * @param {boolean} opts.showCompanyNav
 * @param {boolean} opts.showLegalNav
 * @param {string} [opts.legalHref]
 * @param {number} [opts.pendingCount]
 * @param {number} [opts.legalPendingCount]
 */
export function getAdminNavItems({
  t,
  showSuperAdminChrome,
  showCompanyNav,
  showLegalNav,
  legalHref = ADMIN_PATHS.legal,
  pendingCount = 0,
  legalPendingCount = 0,
}) {
  const items = [
    {
      id: "calendar",
      href: ADMIN_PATHS.calendar,
      label: t("header.calendar"),
      match: isAdminCalendarSection,
    },
    {
      id: "cars",
      href: ADMIN_PATHS.cars,
      label: t("header.cars"),
      match: isAdminCarsSection,
    },
    {
      id: "orders",
      href: ADMIN_PATHS.orders,
      label: t("header.orders", { defaultValue: t("header.table") }),
      match: isAdminOrdersSection,
      badge: pendingCount,
    },
  ];

  if (showSuperAdminChrome) {
    items.push({
      id: "partners",
      href: ADMIN_PATHS.partners,
      label: t("header.partners", { defaultValue: "Partners" }),
      match: isAdminPartnersSection,
      badge: legalPendingCount,
    });
    items.push({
      id: "settings",
      href: ADMIN_PATHS.settings,
      label: t("header.settings", { defaultValue: "Settings" }),
      match: isAdminSettingsSection,
    });
    items.push({
      id: "emails",
      href: ADMIN_PATHS.emails,
      label: t("header.emails", { defaultValue: "Emails" }),
      match: isAdminEmailsSection,
    });
    items.push({
      id: "visits",
      href: ADMIN_PATHS.visits,
      label: t("header.websiteVisits"),
      match: isAdminVisitsSection,
    });
    return items;
  }

  if (showCompanyNav) {
    items.push({
      id: "company",
      href: ADMIN_PATHS.company,
      label: t("header.companyProfile"),
      match: isAdminCompanySection,
    });
  }

  if (showLegalNav) {
    items.push({
      id: "legal",
      href: legalHref || ADMIN_PATHS.legal,
      label: t("header.legal", { defaultValue: t("header.legalProfile") }),
      match: isAdminLegalSection,
      badge: legalPendingCount,
    });
  }

  return items;
}
