/**
 * Admin top-nav IA: Calendar | Cars | Orders | Company | Legal
 * (+ superadmin Companies / Visits). Discounts stays a nav action, not a section.
 */

export const ADMIN_PATHS = {
  calendar: "/admin/orders-calendar",
  cars: "/admin/cars",
  orders: "/admin/orders",
  company: "/admin/company",
  legal: "/admin/legal-profile",
  owners: "/admin/owners",
  visits: "/admin/website-visits",
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
  return (
    pathname?.startsWith("/admin/company") ||
    pathname?.startsWith("/admin/delivery-zones") ||
    pathname?.startsWith("/admin/vouchers") ||
    pathname?.startsWith("/admin/access-tokens") ||
    pathname?.startsWith("/admin/platform")
  );
}

export function isAdminLegalSection(pathname) {
  return pathname?.startsWith("/admin/legal-profile");
}

export function isAdminOwnersSection(pathname) {
  return pathname?.startsWith("/admin/owners");
}

export function isAdminVisitsSection(pathname) {
  return pathname?.startsWith("/admin/website-visits");
}

/**
 * In-page Company hub tabs.
 * Vouchers stay last — they are optional; storefront/ops come first.
 *
 * Superadmin (no view-as): Access links | Platform | Delivery | Pricing | Vouchers
 * Company / view-as: Storefront | People | Delivery | Pricing | Transfer | Vouchers
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
  showSuperAdminTabs,
}) {
  if (hasCompanyContext) {
    return [
      "storefront",
      "people",
      "delivery",
      "pricing",
      "transfer",
      "vouchers",
    ];
  }
  const ids = [];
  if (showSuperAdminTabs) {
    ids.push("access-links", "platform");
  }
  ids.push("delivery", "pricing", "vouchers");
  return ids;
}

/**
 * @param {object} opts
 * @param {(key: string, opts?: object) => string} opts.t
 * @param {boolean} opts.showSuperAdminChrome
 * @param {boolean} opts.showCompanyNav
 * @param {boolean} opts.showLegalNav
 * @param {number} [opts.pendingCount]
 */
export function getAdminNavItems({
  t,
  showSuperAdminChrome,
  showCompanyNav,
  showLegalNav,
  pendingCount = 0,
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
      href: ADMIN_PATHS.legal,
      label: t("header.legal", { defaultValue: t("header.legalProfile") }),
      match: isAdminLegalSection,
    });
  }

  if (showSuperAdminChrome) {
    items.push({
      id: "owners",
      href: ADMIN_PATHS.owners,
      label: t("header.owners"),
      match: isAdminOwnersSection,
    });
    items.push({
      id: "visits",
      href: ADMIN_PATHS.visits,
      label: t("header.websiteVisits"),
      match: isAdminVisitsSection,
    });
  }

  return items;
}
