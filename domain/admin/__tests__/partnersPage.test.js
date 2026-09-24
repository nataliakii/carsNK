import fs from "fs";
import path from "path";

import { ROLE } from "@models/user";
import {
  legacyLegalPartnersRedirect,
  partnersPageAccess,
  partnersTabHref,
} from "@/domain/admin/partnersPage";

const OWN = "507f1f77bcf86cd799439011";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("partners page", () => {
  it("4. Partners page renders All partners and Needs review tabs", () => {
    const src = read("app/admin/partners/PartnersSection.js");
    expect(src).toContain("All partners");
    expect(src).toContain("Needs review");
    expect(src).toContain("OwnersSection");
    expect(src).toContain("PartnerReviewQueue");
  });

  it("5. Pending count appears beside Partners", () => {
    const nav = read("app/admin/shared/adminNav.js");
    expect(nav).toContain("badge: legalPendingCount");
    const partners = nav.slice(nav.indexOf('id: "partners"'));
    expect(partners.indexOf("badge: legalPendingCount")).toBeGreaterThan(-1);
    expect(partners.indexOf("badge: legalPendingCount")).toBeLessThan(
      partners.indexOf('id: "settings"')
    );
  });

  it("6. Needs review tab renders PartnerReviewQueue", () => {
    const src = read("app/admin/partners/PartnersSection.js");
    expect(src).toMatch(
      /tab === "review" \? \(\s*<PartnerReviewQueue viewMode=\{viewMode\} \/>/
    );
  });

  it("7. Review actions still use the secured existing API", () => {
    const sticky = read(
      "app/admin/legal-profile/_components/PartnerLegalReview/StickyReviewActions.js"
    );
    const actions = read(
      "app/admin/legal-profile/_components/PartnerReviewActions.js"
    );
    const route = read("app/api/admin/legal/partners/[companyId]/route.js");
    expect(sticky).toContain("/api/admin/legal/partners/");
    expect(actions).toContain("/api/admin/legal/partners/");
    expect(route).toContain("requirePlatformAdmin");
    expect(route).toContain("action === \"approve\"");
    expect(route).toContain("action === \"request_changes\"");
    expect(read("lib/adminAuth.js")).toMatch(
      /export async function requirePlatformAdmin[\s\S]*requireSuperAdmin/
    );
  });

  it("7b. Sticky review actions are platform-admin only", () => {
    const sticky = read(
      "app/admin/legal-profile/_components/PartnerLegalReview/StickyReviewActions.js"
    );
    expect(sticky).toContain("ADMIN_VIEW_MODE.PLATFORM_ADMIN");
    expect(sticky).toContain("Approve company");
  });

  it("8. Old partner-review URLs redirect to /admin/partners?tab=review", () => {
    expect(
      legacyLegalPartnersRedirect({
        tab: "partners",
        filter: "pending",
        companyId: OWN,
      })
    ).toBe(`/admin/partners?tab=review&filter=pending&companyId=${OWN}`);
    expect(legacyLegalPartnersRedirect({ tab: "documents" })).toBeNull();
    expect(read("app/admin/legal/page.js")).toContain(
      "legacyLegalPartnersRedirect"
    );
    expect(read("app/admin/owners/page.js")).toContain('redirect(PARTNERS_PATH)');
  });

  it("9. Selected workspace country is respected", () => {
    const hook = read("app/hooks/usePendingPartnerReviews.js");
    const section = read("app/admin/partners/PartnersSection.js");
    expect(hook).toContain('params.set("country", country)');
    expect(section).toContain("useAdminCountryFilter");
    expect(section).toContain("country");
  });

  it("10. Company ADMIN cannot access /admin/partners", () => {
    expect(partnersPageAccess({ role: ROLE.ADMIN, ownerId: OWN })).toEqual({
      allow: false,
      redirectTo: "/admin/cars",
    });
    expect(read("app/admin/partners/page.js")).toContain("partnersPageAccess");
  });

  it("11. SUPERADMIN in company context does not see superadmin Partners/Settings", () => {
    expect(
      partnersPageAccess({ role: ROLE.SUPERADMIN, viewAsCompanyId: OWN })
    ).toEqual({
      allow: false,
      redirectTo: "/admin/orders-calendar",
    });
    expect(partnersPageAccess({ role: ROLE.SUPERADMIN }).allow).toBe(true);
  });

  it("12. Mobile/narrow navbar remains usable", () => {
    const navbar = read("app/components/Navbar.js");
    expect(navbar).toContain('display: { xs: "none", md: "flex" }');
    expect(navbar.match(/items=\{adminNavItems\}/g).length).toBeGreaterThanOrEqual(
      2
    );
    expect(partnersTabHref("all")).toBe("/admin/partners?tab=all");
    expect(partnersTabHref("review")).toBe("/admin/partners?tab=review");
  });
});
