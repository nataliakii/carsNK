const fs = require("fs");
const path = require("path");

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("company legal shared layout", () => {
  const section = read("app/admin/company/legal/CompanyLegalSection.js");
  const terms = read("app/admin/company/legal/CompanyTermsPanel.js");
  const rental = read("app/admin/company/legal/CompanyRentalTermsPanel.js");
  const profile = read("app/admin/legal-profile/PartnerLegalProfileSection.js");
  const layout = read("app/admin/company/CompanySettingsLayout.js");

  it("Company details, Documents and Terms use CompanySettingsLayout", () => {
    expect(section).toContain("CompanySettingsLayout");
    expect(section).toContain('panel="documents"');
    expect(section).toContain('panel="details"');
    expect(section).toContain("<CompanyTermsPanel");
    expect(section).toContain("data-testid=\"company-legal-terms\"");
    expect(layout).toContain("COMPANY_SETTINGS_SHELL");
    expect(layout).toContain("data-testid=\"company-settings-page\"");
    expect(layout).toContain("data-testid=\"company-settings-tabs\"");
    expect(layout).toContain("data-testid=\"company-settings-tab-content\"");
  });

  it("Terms does not render a competing outer container", () => {
    expect(section).not.toContain("adminSectionTabsSx");
    expect(section).not.toContain("maxWidth: 720");
    expect(section).not.toContain("maxWidth: 1100");
    expect(section).toContain("COMPANY_SETTINGS_FORM_MAX_WIDTH");
    expect(section).toContain("company-legal-terms-form");
    expect(terms).not.toContain("maxWidth: 720");
    expect(terms).not.toContain("px: { xs: 1, md: 2 }");
    expect(rental).not.toContain("maxWidth: 720");
    expect(profile).toContain("companyView");
    expect(profile).toContain('maxWidth: "100%"');
  });

  it("does not set a fixed page height or overflow hidden on Terms", () => {
    expect(section).not.toContain("overflow: \"hidden\"");
    expect(section).not.toContain("overflowX: \"hidden\"");
    expect(section).not.toContain("100vh");
    expect(terms).not.toContain("overflow: \"hidden\"");
    expect(rental).not.toContain("overflow: \"hidden\"");
  });

  it("keeps document actions accessible as outlined rows", () => {
    expect(terms).toContain("View document");
    expect(terms).toContain("OpenInNewIcon");
    expect(terms).toContain("company-terms-doc-");
    expect(terms).toContain("variant=\"outlined\"");
  });

  it("renders rental terms and booking fee in the same Terms flow", () => {
    expect(section).toContain("CompanyRentalTermsPanel");
    expect(section).toContain("BookingFeeOutcomesTable");
    expect(section).toContain("compact");
    expect(section).toContain("Divider");
    expect(rental).toContain("Add your own rental terms");
    expect(rental).toContain("data-testid=\"company-rental-terms\"");
    expect(rental).toContain("constrainHeight={false}");
    expect(rental).toContain("width: \"100%\"");
    expect(read("app/admin/legal/LegalRichTextEditor.js")).toContain(
      "constrainHeight = true"
    );
  });

  it("keeps title, tabs and card on the shared company shell", () => {
    expect(section).toMatch(/<CompanySettingsLayout[\s\S]*tabs=\{tabs\}/);
    expect(section).not.toContain("<main");
    expect(section).not.toContain("position: \"absolute\"");
    expect(section).not.toContain("100vw");
    expect(section).not.toContain("marginLeft: -");
    expect(layout).not.toMatch(/overflow:\s*"hidden"/);
    expect(layout).toContain("overflow: \"visible\"");
  });
});
