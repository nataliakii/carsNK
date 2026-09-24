const fs = require("fs");
const path = require("path");

const {
  COMPANY_SETTINGS_SHELL,
  COMPANY_SETTINGS_TAB_BAR,
  COMPANY_SETTINGS_TAB_CONTENT,
  COMPANY_SETTINGS_FORM_GRID,
  COMPANY_SETTINGS_FORM_MAX_WIDTH,
  COMPANY_SETTINGS_NAVBAR_HEIGHT_PX,
} = require("../companySettingsLayout");

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("company settings layout", () => {
  it("defines a shared outer shell (1440 / responsive padding)", () => {
    expect(COMPANY_SETTINGS_SHELL.width).toBe("100%");
    expect(COMPANY_SETTINGS_SHELL.maxWidth).toBe(1440);
    expect(COMPANY_SETTINGS_SHELL.paddingInline).toEqual({
      xs: 2,
      sm: 3,
      md: 4,
    });
  });

  it("defines one TabContentContainer surface", () => {
    expect(COMPANY_SETTINGS_TAB_CONTENT.marginTop).toBe(2);
    expect(COMPANY_SETTINGS_TAB_CONTENT.padding).toEqual({
      xs: 2,
      sm: 3,
      md: 4,
    });
    expect(COMPANY_SETTINGS_TAB_CONTENT.background).toBe("#ffffff");
  });

  it("styles the tab bar: magenta indicator, no wrap, content-width tabs", () => {
    expect(COMPANY_SETTINGS_NAVBAR_HEIGHT_PX).toBe(64);
    expect(COMPANY_SETTINGS_TAB_BAR.indicatorColor).toBe("#E9004F");
    expect(COMPANY_SETTINGS_TAB_BAR.gap).toBe(1.5);
    expect(COMPANY_SETTINGS_TAB_BAR.paddingInline).toBe(0);
    expect(COMPANY_SETTINGS_TAB_BAR.tabWhiteSpace).toBe("nowrap");
    expect(COMPANY_SETTINGS_TAB_BAR.tabMinWidth).toBe("auto");
  });

  it("uses a shared form grid (2-col desktop, 1-col tablet/mobile)", () => {
    expect(COMPANY_SETTINGS_FORM_GRID.gridTemplateColumns).toEqual({
      xs: "1fr",
      md: "1fr 1fr",
    });
    expect(COMPANY_SETTINGS_FORM_GRID.gap).toEqual({ xs: 2.5, md: 3 });
    expect(COMPANY_SETTINGS_FORM_MAX_WIDTH).toBe(1100);
  });

  it("wires CompanySettingsLayout into the company hub shell", () => {
    const layout = read("app/admin/company/CompanySettingsLayout.js");
    const hub = read("app/admin/company/CompanyProfileSection.js");

    expect(layout).toContain("data-testid=\"company-settings-page\"");
    expect(layout).toContain("data-testid=\"company-settings-header\"");
    expect(layout).toContain("data-testid=\"company-settings-setup-status\"");
    expect(layout).toContain("data-testid=\"company-settings-tabs\"");
    expect(layout).toContain("data-testid=\"company-settings-tab-content\"");
    expect(layout).toContain("COMPANY_SETTINGS_SHELL");
    expect(layout).toContain("scrollIntoView");
    expect(layout).toContain('scrollbarWidth: "none"');
    expect(layout).toContain("COMPANY_SETTINGS_TAB_BAR.indicatorColor");

    expect(hub).toContain("CompanySettingsLayout");
    expect(hub).toContain("PartnerComplianceCard");
    expect(hub).not.toContain("wideTab");
    expect(hub).not.toContain("maxWidth: wideTab");
    expect(hub).not.toContain("maxWidth: { xs: \"100%\", md: 960 }");
    expect(hub).not.toContain("maxWidth: { xs: \"100%\", md: 1200 }");

    // Header / setup / tabs stay outside ActiveTabContent.
    const layoutCall = hub.indexOf("<CompanySettingsLayout");
    const setupProp = hub.indexOf("setupStatus=");
    const childrenClose = hub.indexOf("</CompanySettingsLayout>");
    expect(layoutCall).toBeGreaterThan(-1);
    expect(setupProp).toBeGreaterThan(layoutCall);
    expect(setupProp).toBeLessThan(childrenClose);
  });

  it("passes embedded to every company hub tab so cards skip nested page chrome", () => {
    const hub = read("app/admin/company/CompanyProfileSection.js");
    expect(hub).toMatch(/CompanyStorefrontCard[\s\S]*embedded/);
    expect(hub).toMatch(/CompanyAdminsCard[\s\S]*embedded/);
    expect(hub).toMatch(/CompanyMeetingContactsCard[\s\S]*embedded/);
    expect(hub).toMatch(/CompanyCoverageCard[\s\S]*embedded/);
    expect(hub).toMatch(/CompanyDeliveryPricingCard[\s\S]*embedded/);
    expect(hub).toMatch(/CompanyRentalPaymentsCard[\s\S]*embedded/);
    expect(hub).toMatch(/CompanyTransferServicesCard[\s\S]*embedded/);
    expect(hub).toMatch(/TransferVouchersSection[\s\S]*embedded/);
    expect(hub).toMatch(/DeliveryZonesSection[\s\S]*embedded/);
  });

  it("slims TransferVouchersSection when embedded (no own maxWidth wrapper)", () => {
    const src = read("app/admin/vouchers/TransferVouchersSection.js");
    expect(src).toContain("embedded = false");
    expect(src).toContain('embedded\n          ? { width: "100%", maxWidth: "100%", p: 0, m: 0 }');
  });

  it("does not remount header/status/tabs on tab change (only children swap)", () => {
    const hub = read("app/admin/company/CompanyProfileSection.js");
    // Tabs are props on the layout, not recreated inside each tab branch.
    expect(hub).toContain("tabs={tabs}");
    expect(hub).toContain("tabValue={tabValue}");
    // Active content is the sole child of the layout.
    expect(hub).toContain("{activeTabContent}");
  });
});
