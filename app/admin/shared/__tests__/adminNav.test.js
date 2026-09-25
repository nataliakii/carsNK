import {
  ADMIN_PATHS,
  getAdminNavItems,
  getCompanyHubTabIds,
  isAdminCalendarSection,
  isAdminCarsSection,
  isAdminCompanySection,
  isAdminLegalSection,
  isAdminOrdersSection,
  isAdminSettingsSection,
  resolveCompanyHubTab,
} from "../adminNav";

describe("adminNav IA", () => {
  it("keeps Calendar and Cars as separate top-level sections", () => {
    expect(isAdminCalendarSection("/admin/orders-calendar")).toBe(true);
    expect(isAdminCalendarSection("/admin/cars")).toBe(false);
    expect(isAdminCalendarSection("/admin/orders")).toBe(false);
    expect(isAdminCarsSection("/admin/cars")).toBe(true);
    expect(isAdminCarsSection("/admin/cars/123")).toBe(true);
    expect(isAdminCarsSection("/admin/orders-calendar")).toBe(false);
  });

  it("keeps orders and former tools under the right sections", () => {
    expect(isAdminOrdersSection("/admin/orders")).toBe(true);
    expect(isAdminOrdersSection("/admin/transfers")).toBe(true);
    expect(isAdminCompanySection("/admin/company?tab=vouchers")).toBe(true);
    expect(isAdminCompanySection("/admin/delivery-zones")).toBe(true);
    expect(isAdminCompanySection("/admin/vouchers")).toBe(true);
    expect(isAdminCompanySection("/admin/settings")).toBe(false);
    expect(isAdminSettingsSection("/admin/settings")).toBe(true);
    expect(isAdminSettingsSection("/admin/settings?tab=pricing")).toBe(true);
    expect(isAdminLegalSection("/admin/legal-profile?tab=agreement")).toBe(true);
    expect(isAdminLegalSection("/admin/settings?tab=legal")).toBe(true);
    expect(isAdminLegalSection("/admin/legal")).toBe(true);
    expect(isAdminLegalSection("/admin/owners")).toBe(false);
  });

  it("puts Vouchers last in Company hub tabs", () => {
    expect(
      getCompanyHubTabIds({
        hasCompanyContext: false,
        showSuperAdminTabs: true,
      })
    ).toEqual([]);
    expect(
      getCompanyHubTabIds({
        hasCompanyContext: true,
        showSuperAdminTabs: false,
      })
    ).toEqual([
      "storefront",
      "offices",
      "people",
      "delivery",
      "pricing",
      "transfer",
      "vouchers",
    ]);
  });

  it("does not put platform Settings tabs on the company hub", () => {
    expect(
      getCompanyHubTabIds({
        hasCompanyContext: false,
        showSuperAdminTabs: true,
      })
    ).not.toContain("people");
    expect(
      getCompanyHubTabIds({
        hasCompanyContext: false,
        showSuperAdminTabs: true,
      })
    ).not.toContain("storefront");
    expect(
      getCompanyHubTabIds({
        hasCompanyContext: true,
        showSuperAdminTabs: false,
      })
    ).not.toContain("legal");
    expect(
      getCompanyHubTabIds({
        hasCompanyContext: true,
        showSuperAdminTabs: false,
      })
    ).not.toContain("platform");
  });

  it("maps old contacts and delivery-zones query tabs", () => {
    const companyTabs = getCompanyHubTabIds({
      hasCompanyContext: true,
      showSuperAdminTabs: false,
    });
    expect(resolveCompanyHubTab("contacts", companyTabs)).toBe("people");
    expect(resolveCompanyHubTab("delivery-zones", companyTabs)).toBe(
      "delivery"
    );
    expect(resolveCompanyHubTab("delivery", companyTabs)).toBe("delivery");
    expect(resolveCompanyHubTab("storefront", companyTabs)).toBe("storefront");
  });

  it("exposes partner top-level items without Tools or Delivery", () => {
    const t = (key) => key;
    const items = getAdminNavItems({
      t,
      showSuperAdminChrome: false,
      showCompanyNav: true,
      showLegalNav: true,
    });
    expect(items.map((item) => item.id)).toEqual([
      "calendar",
      "cars",
      "orders",
      "company",
      "legal",
    ]);
    expect(items.find((item) => item.id === "legal").href).toBe(
      ADMIN_PATHS.legal
    );
  });

  it("superadmin nav: Partners, Settings, Emails", () => {
    const t = (key, opts) => opts?.defaultValue || key;
    const items = getAdminNavItems({
      t,
      showSuperAdminChrome: true,
      showCompanyNav: true,
      showLegalNav: true,
      legalHref: ADMIN_PATHS.legal,
      legalPendingCount: 3,
    });
    expect(items.map((item) => item.id)).toEqual([
      "calendar",
      "cars",
      "orders",
      "partners",
      "settings",
      "emails",
      "visits",
    ]);
    expect(items.find((item) => item.id === "partners").href).toBe(
      ADMIN_PATHS.partners
    );
    expect(items.find((item) => item.id === "partners").badge).toBe(3);
    expect(items.some((item) => item.label === "Partner reviews")).toBe(false);
    expect(items.some((item) => item.label === "Platform settings")).toBe(false);
    expect(items.find((item) => item.id === "settings").href).toBe(
      ADMIN_PATHS.settings
    );
    expect(ADMIN_PATHS.settings).toBe("/admin/settings");
    expect(ADMIN_PATHS.legalHub).toBe("/admin/settings?tab=legal");
  });

  it("hides superadmin Partners and Settings in company context", () => {
    const t = (key, opts) => opts?.defaultValue || key;
    const items = getAdminNavItems({
      t,
      showSuperAdminChrome: false,
      showCompanyNav: true,
      showLegalNav: true,
      legalHref: ADMIN_PATHS.legal,
    });
    expect(items.map((item) => item.id)).toEqual([
      "calendar",
      "cars",
      "orders",
      "company",
      "legal",
    ]);
    expect(items.some((item) => item.id === "partners")).toBe(false);
    expect(items.some((item) => item.id === "settings")).toBe(false);
    expect(items.find((item) => item.id === "legal").href).toBe(
      ADMIN_PATHS.legal
    );
  });
});
