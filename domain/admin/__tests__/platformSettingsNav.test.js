import fs from "fs";
import path from "path";

import { ROLE } from "@models/user";
import {
  LEGACY_COMPANY_HUB_TAB_REDIRECTS,
  PLATFORM_SETTINGS_PATH,
  PLATFORM_SETTINGS_TABS,
  SETTINGS_NAVBAR_HEIGHT_PX,
  SETTINGS_TAB_BAR,
  isPlatformSettingsPath,
  legacyCompanySettingsRedirect,
  platformSettingsAccess,
  platformSettingsHref,
  resolvePlatformSettingsTab,
} from "../platformSettingsNav";

const OWN = "507f1f77bcf86cd799439011";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("platform Settings IA", () => {
  it("exposes the required top-level tabs in order", () => {
    expect(PLATFORM_SETTINGS_TABS.map((tab) => tab.id)).toEqual([
      "general",
      "locations",
      "pricing",
      "delivery",
      "vouchers",
      "legal",
      "access",
    ]);
    expect(PLATFORM_SETTINGS_TABS.map((tab) => tab.label)).toEqual([
      "General",
      "Locations & coverage",
      "Pricing",
      "Delivery",
      "Vouchers",
      "Legal documents",
      "Access",
    ]);
  });

  it("resolves URL tabs, unknown values, and legacy aliases", () => {
    expect(resolvePlatformSettingsTab("pricing")).toBe("pricing");
    expect(resolvePlatformSettingsTab("legal")).toBe("legal");
    expect(resolvePlatformSettingsTab("")).toBe("general");
    expect(resolvePlatformSettingsTab("nope")).toBe("general");
    expect(resolvePlatformSettingsTab("platform")).toBe("general");
    expect(resolvePlatformSettingsTab("catalogue")).toBe("general");
    expect(resolvePlatformSettingsTab("access-links")).toBe("access");
    expect(resolvePlatformSettingsTab("booking-fee")).toBe("pricing");
    expect(resolvePlatformSettingsTab("discounts")).toBe("vouchers");
    expect(platformSettingsHref("legal")).toBe(
      `${PLATFORM_SETTINGS_PATH}?tab=legal`
    );
    expect(platformSettingsHref("legal", { section: "audit" })).toBe(
      `${PLATFORM_SETTINGS_PATH}?tab=legal&section=audit`
    );
  });

  it("maps old company-hub links onto the new Settings tabs", () => {
    expect(LEGACY_COMPANY_HUB_TAB_REDIRECTS.pricing).toBe("delivery");
    expect(legacyCompanySettingsRedirect("pricing")).toBe(
      `${PLATFORM_SETTINGS_PATH}?tab=delivery`
    );
    expect(legacyCompanySettingsRedirect("platform")).toBe(
      `${PLATFORM_SETTINGS_PATH}?tab=general`
    );
    expect(legacyCompanySettingsRedirect("access-links")).toBe(
      `${PLATFORM_SETTINGS_PATH}?tab=access`
    );
    expect(legacyCompanySettingsRedirect("legal")).toBe(
      `${PLATFORM_SETTINGS_PATH}?tab=legal`
    );
    expect(read("app/admin/company/page.js")).toContain(
      "legacyCompanySettingsRedirect"
    );
    expect(read("app/admin/platform/page.js")).toContain(
      'platformSettingsHref("general")'
    );
    expect(read("app/admin/delivery-zones/page.js")).toContain(
      'platformSettingsHref("delivery")'
    );
    expect(read("app/admin/access-tokens/page.js")).toContain(
      'platformSettingsHref("access")'
    );
    expect(read("app/admin/legal/page.js")).toMatch(
      /platformSettingsHref\(\s*"legal"/
    );
  });

  it("renders tabs immediately below the Settings header with no cards above", () => {
    const src = read("app/admin/settings/PlatformSettingsSection.js");
    const header = src.indexOf('data-testid="platform-settings-header"');
    const tabs = src.indexOf('data-testid="platform-settings-tabs"');
    const content = src.indexOf('data-testid="platform-settings-content"');
    expect(header).toBeGreaterThan(-1);
    expect(tabs).toBeGreaterThan(header);
    expect(content).toBeGreaterThan(tabs);

    // Between header and tabs: title only — no settings panels in the layout.
    const betweenHeaderAndTabs = src.slice(header, tabs);
    expect(betweenHeaderAndTabs).not.toContain("<PlatformMyBusinessCard");
    expect(betweenHeaderAndTabs).not.toContain("<PlatformBookingFeeCard");
    expect(betweenHeaderAndTabs).not.toContain("<LegalHubSection");
    // Old standalone Legal card CTA must not exist anywhere on Settings.
    expect(src).not.toContain("Open legal documents →");
    expect(src).not.toContain('href="/admin/legal?tab=documents"');

    expect(src).toContain("LegalHubSection");
    expect(src).toContain('tab === "legal"');
    expect(src).toContain("router.push(href)");
  });

  it("removes the duplicate Legal card from the company hub", () => {
    const company = read("app/admin/company/CompanyProfileSection.js");
    expect(company).not.toContain("Publish Rovaro agreement, terms and privacy documents");
    expect(company).not.toContain("Open legal documents →");
    expect(company).not.toContain("LegalHubSection");
    expect(company).not.toContain("PlatformMyBusinessCard");
    expect(company).not.toContain("PlatformBookingFeeCard");
  });

  it("keeps sticky desktop tab bar and mobile horizontal scrolling", () => {
    expect(SETTINGS_NAVBAR_HEIGHT_PX).toBe(64);
    expect(SETTINGS_TAB_BAR.desktopPosition).toBe("sticky");
    expect(SETTINGS_TAB_BAR.top).toBe("64px");
    expect(SETTINGS_TAB_BAR.indicatorColor).toBe("#E9004F");
    expect(SETTINGS_TAB_BAR.tabWhiteSpace).toBe("nowrap");
    expect(SETTINGS_TAB_BAR.tabMinHeight).toBe(48);

    const src = read("app/admin/settings/PlatformSettingsSection.js");
    expect(src).toContain("SETTINGS_TAB_BAR");
    expect(src).toContain('variant="scrollable"');
    expect(src).toContain("scrollIntoView");
    expect(src).toContain('textOverflow: "clip"');
    expect(src).toContain("overflowX: \"auto !important\"");
  });

  it("guards unsaved changes when switching tabs", () => {
    const guard = read("app/admin/settings/SettingsDirtyGuard.js");
    const section = read("app/admin/settings/PlatformSettingsSection.js");
    expect(guard).toContain("confirmLeave");
    expect(guard).toContain("beforeunload");
    expect(section).toContain("confirmLeave()");
    expect(read("app/admin/shared/components/PlatformMyBusinessCard.js")).toContain(
      "useRegisterSettingsDirty"
    );
    expect(read("app/admin/shared/components/PlatformBookingFeeCard.js")).toContain(
      "useRegisterSettingsDirty"
    );
  });

  it("blocks company admins and company-view superadmins from platform Settings", () => {
    expect(
      platformSettingsAccess({
        role: ROLE.ADMIN,
        isAdmin: true,
        ownerId: OWN,
      })
    ).toEqual({ allow: false, redirectTo: "/admin/company" });
    expect(
      platformSettingsAccess({
        role: ROLE.SUPERADMIN,
        isAdmin: true,
        viewAsCompanyId: OWN,
      })
    ).toEqual({ allow: false, redirectTo: "/admin/company" });
    expect(
      platformSettingsAccess({ role: ROLE.SUPERADMIN, isAdmin: true })
    ).toEqual({ allow: true, redirectTo: null });
    expect(read("app/admin/settings/page.js")).toContain("platformSettingsAccess");
    expect(isPlatformSettingsPath("/admin/settings?tab=legal")).toBe(true);
  });
});
