import fs from "fs";
import path from "path";

import { PARTNER_VERIFICATION_STATUS as S } from "../partnerVerification";
import {
  companySetupReadiness,
  legacySetupRedirect,
} from "../companySetupReadiness";
import { evaluateMarketplaceOperatingState } from "../partnerOperatingPolicy";

function profile(status, extra = {}) {
  return { legalName: "Test SL", verificationStatus: status, ...extra };
}

function readiness(overrides) {
  return companySetupReadiness({
    profile: profile(S.DRAFT),
    completeness: { ready: true, missingFields: [], missingDocuments: [] },
    termsPublication: "NOT_PUBLISHED",
    listedOnMarketplace: true,
    ...overrides,
  });
}

describe("company setup readiness", () => {
  it("1. Trading card renders at most one action", () => {
    const card = fs.readFileSync(
      path.join(process.cwd(), "app/admin/shared/components/PartnerComplianceCard.js"),
      "utf8"
    );
    expect(card.match(/<Button/g) || []).toHaveLength(1);
    expect(card).not.toContain("openProfile");
    expect(card).not.toContain("openAgreement");
    expect(card).not.toContain("PartnerComplianceGate");
  });

  it("2. Terms unpublished renders no agreement action", () => {
    const result = readiness({
      profile: profile(S.VERIFIED),
      termsPublication: "NOT_PUBLISHED",
    });
    expect(result.state).toBe("TERMS_NOT_PUBLISHED");
    expect(result.nextAction).toBeNull();
    expect(result.canCreateDraftCars).toBe(true);
    expect(result.canReceiveBookings).toBe(false);
  });

  it("3. Details incomplete opens the details step", () => {
    const result = readiness({
      profile: { verificationStatus: S.DRAFT },
      completeness: { ready: false, missingFields: ["legalName"], missingDocuments: [] },
    });
    expect(result.state).toBe("COMPANY_DETAILS_INCOMPLETE");
    expect(result.nextAction.href).toBe("/admin/company/setup?step=details");
  });

  it("4. Missing documents opens the documents step", () => {
    const result = readiness({
      completeness: {
        ready: false,
        missingFields: [],
        missingDocuments: ["company_registration"],
      },
    });
    expect(result.state).toBe("DOCUMENTS_MISSING");
    expect(result.nextAction.href).toBe("/admin/company/setup?step=documents");
  });

  it("5. Terms ready opens the terms step", () => {
    const result = readiness({
      profile: profile(S.VERIFIED),
      termsPublication: "READY_TO_ACCEPT",
    });
    expect(result.nextAction.href).toBe("/admin/company/setup?step=terms");
    expect(result.nextAction.labelKey).toBe("reviewTerms");
  });

  it("6. Ready company has no setup action", () => {
    const result = readiness({
      profile: profile(S.VERIFIED),
      termsPublication: "ACCEPTED",
      agreementAccepted: true,
    });
    expect(result.state).toBe("READY_TO_TRADE");
    expect(result.nextAction).toBeNull();
    expect(result.canPublishCars).toBe(true);
    expect(result.canReceiveBookings).toBe(true);
  });

  it("7. No company-facing render contains Master Partner Agreement", () => {
    const files = [
      "app/admin/shared/components/PartnerComplianceCard.js",
      "app/admin/company/legal/CompanyTermsPanel.js",
      "app/admin/company/legal/CompanyLegalSection.js",
    ];
    for (const file of files) {
      expect(fs.readFileSync(path.join(process.cwd(), file), "utf8")).not.toContain(
        "Master Partner Agreement"
      );
    }
  });

  it("8. No company-facing render contains separate Legal profile and Partner Agreement buttons", () => {
    const card = fs.readFileSync(
      path.join(process.cwd(), "app/admin/shared/components/PartnerComplianceCard.js"),
      "utf8"
    );
    expect(card).not.toContain("Legal profile");
    expect(card).not.toContain("Partner Agreement");
    expect(card).not.toContain("Open agreement");
  });

  it("9. Legacy URLs redirect to the appropriate setup step", () => {
    expect(legacySetupRedirect("/admin/legal-profile")).toBe(
      "/admin/company/setup?step=details"
    );
    expect(legacySetupRedirect("/admin/legal-profile/agreement")).toBe(
      "/admin/company/setup?step=terms"
    );
    expect(legacySetupRedirect("/admin/company/legal", { tab: "documents" })).toBe(
      "/admin/company/setup?step=documents"
    );
    expect(legacySetupRedirect("/admin/company/legal", { tab: "terms" })).toBe(
      "/admin/company/setup?step=terms"
    );
  });

  it("10. The same readiness state drives UI and server operating gates", () => {
    const company = {
      _id: "64b7f2c3a1b2c3d4e5f60711",
      country: "ES",
      listedOnMarketplace: true,
    };
    const verified = profile(S.VERIFIED);
    const ui = readiness({ profile: verified, termsPublication: "NOT_PUBLISHED" });
    const gate = evaluateMarketplaceOperatingState({
      company,
      profile: verified,
      currentPackageChecksum: "",
    });
    expect(gate.readiness.state).toBe(ui.state);
    expect(gate.allowed).toBe(ui.canReceiveBookings);
    expect(gate.partnerMessage).not.toMatch(/Partner Agreement/);
  });
});
