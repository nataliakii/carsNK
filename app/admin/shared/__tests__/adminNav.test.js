import {
  getAdminNavItems,
  getCompanyHubTabIds,
  isAdminCalendarSection,
  isAdminCarsSection,
  isAdminCompanySection,
  isAdminLegalSection,
  isAdminOrdersSection,
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
    expect(isAdminLegalSection("/admin/legal-profile?tab=agreement")).toBe(true);
  });

  it("puts Vouchers last in Company hub tabs", () => {
    expect(
      getCompanyHubTabIds({
        hasCompanyContext: false,
        showSuperAdminTabs: true,
      })
    ).toEqual([
      "access-links",
      "platform",
      "delivery",
      "pricing",
      "vouchers",
    ]);
    expect(
      getCompanyHubTabIds({
        hasCompanyContext: true,
        showSuperAdminTabs: false,
      })
    ).toEqual([
      "storefront",
      "people",
      "delivery",
      "pricing",
      "transfer",
      "vouchers",
    ]);
  });

  it("does not put People on the empty superadmin hub", () => {
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
  });
});
