import fs from "fs";
import path from "path";

import { ROLE } from "@models/user";
import { assertOnlyLifecycleFields } from "@models/PartnerAgreementAcceptance";
import { partnerLegalEn, partnerLegalEs } from "@/locales/partnerLegal";
import { evaluatePartnerOperatingGate } from "@/domain/legal/partnerGate";
import { PARTNER_VERIFICATION_STATUS as S } from "@/domain/legal/partnerVerification";
import {
  COMPANY_LEGAL_PATH,
  COMPANY_TERMS_PATH,
  SUPERADMIN_LEGAL_PATH,
  acceptanceOutdated,
  buildTermsAcceptance,
  companyLegalStatusKey,
  companyMayOperate,
  companyLegalPageAccess,
  explicitSignerRole,
  legalAreaDecision,
  legalNavHref,
  legacyLegalProfileRedirect,
  ownCompanyScope,
  selectedCompanyForLegalPage,
  presentPartnerTerms,
  republishLeavesOrder,
  standardPackageNeedsPublish,
  superadminMayAcceptTerms,
  withCustomAgreement,
} from "@/domain/legal/companyLegalPage";

const OWN = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439022";

const published = [
  {
    documentType: "partner-agreement",
    language: "en",
    jurisdiction: "ES",
    version: 1,
    checksum: "a",
    source: "published",
    renderedTitle: "Partner Agreement",
    renderedSections: [{ heading: "Fees", text: "Standard fees" }],
  },
  {
    documentType: "partner-operating-rules",
    language: "en",
    jurisdiction: "ES",
    version: 1,
    checksum: "b",
    source: "published",
    renderedTitle: "Rules",
    renderedSections: [],
  },
  {
    documentType: "data-protection-schedule",
    language: "en",
    jurisdiction: "ES",
    version: 1,
    checksum: "c",
    source: "published",
    renderedTitle: "Data",
    renderedSections: [],
  },
];

const standardPkg = {
  documents: published,
  packageChecksum: "standard-checksum",
  anyDraft: false,
};

function adminSession() {
  return { user: { role: ROLE.ADMIN, isAdmin: true, ownerId: OWN, email: "ada@fleet.test" } };
}

describe("company legal access", () => {
  const admin = { role: ROLE.ADMIN, ownerId: OWN };
  const superadmin = { role: ROLE.SUPERADMIN };
  const impersonating = { role: ROLE.SUPERADMIN, viewAsCompanyId: OWN };

  it("1. ADMIN Legal nav href is /admin/company/legal", () => {
    expect(legalNavHref({ role: ROLE.ADMIN, companyContextActive: false })).toBe(
      "/admin/company/legal?tab=terms"
    );
  });

  it("2. SUPERADMIN without company context Legal nav href is /admin/legal", () => {
    expect(
      legalNavHref({ role: ROLE.SUPERADMIN, companyContextActive: false })
    ).toBe("/admin/legal");
  });

  it("3. SUPERADMIN with active company context Legal nav href is /admin/company/legal", () => {
    expect(legalNavHref({ role: ROLE.SUPERADMIN, companyContextActive: true })).toBe(
      COMPANY_TERMS_PATH
    );
    const navbar = fs.readFileSync(
      path.join(process.cwd(), "app/components/Navbar.js"),
      "utf8"
    );
    expect(navbar).toContain("legalNavHref");
    expect(navbar).toContain("companyContextActive: viewAsActive");
  });

  it("4. ADMIN requesting /admin/legal is redirected", () => {
    const decision = legalAreaDecision(admin);
    expect(decision.allow).toBe(false);
    expect(decision.redirectTo).toBe(COMPANY_TERMS_PATH);
  });

  it("5. SUPERADMIN in company context requesting /admin/legal is redirected", () => {
    const decision = legalAreaDecision(impersonating);
    expect(decision.allow).toBe(false);
    expect(decision.redirectTo).toBe(COMPANY_TERMS_PATH);
  });

  it("6. SUPERADMIN outside company context may access /admin/legal", () => {
    expect(legalAreaDecision(superadmin)).toEqual({
      allow: true,
      redirectTo: null,
      status: 200,
    });
  });

  it("7. Exiting company restores the superadmin Legal destination", () => {
    expect(legalNavHref({ role: ROLE.SUPERADMIN, companyContextActive: true })).toBe(
      COMPANY_TERMS_PATH
    );
    expect(legalNavHref({ role: ROLE.SUPERADMIN, companyContextActive: false })).toBe(
      "/admin/legal"
    );
  });

  it("8. A direct URL to /admin/legal cannot expose Partner reviews while company context is active", () => {
    const hub = fs.readFileSync(
      path.join(process.cwd(), "app/admin/legal/page.js"),
      "utf8"
    );
    expect(hub).toContain("legalAreaDecision");
    expect(legalAreaDecision(impersonating).allow).toBe(false);
    expect(companyLegalPageAccess(impersonating).allow).toBe(true);
  });

  it("9. Company legal page loads the selected company for an impersonating SUPERADMIN", () => {
    expect(selectedCompanyForLegalPage(impersonating)).toBe(OWN);
    expect(selectedCompanyForLegalPage(impersonating, OTHER)).toBe("");
    expect(ownCompanyScope({ user: impersonating }, OTHER).forbidden).toBe(true);
    const page = fs.readFileSync(
      path.join(process.cwd(), "app/admin/company/legal/page.js"),
      "utf8"
    );
    expect(page).toContain("selectedCompanyForLegalPage(session.user)");
    expect(page).not.toContain("searchParams");
    expect(page).toContain("companyLegalPageAccess");
  });

  it("10. No redirect loop occurs", () => {
    expect(legalAreaDecision(impersonating).redirectTo).toBe(COMPANY_TERMS_PATH);
    expect(companyLegalPageAccess(impersonating).redirectTo).toBeNull();
    expect(companyLegalPageAccess(superadmin).redirectTo).toBe(SUPERADMIN_LEGAL_PATH);
    expect(legalAreaDecision(superadmin).redirectTo).toBeNull();
    expect(legalAreaDecision(admin).redirectTo).toBe(COMPANY_TERMS_PATH);
    expect(companyLegalPageAccess(admin).redirectTo).toBeNull();
  });

  it("refuses /admin/legal to a company ADMIN and sends them to the company page", () => {
    const decision = legalAreaDecision(ROLE.ADMIN);
    expect(decision.allow).toBe(false);
    expect(decision.status).toBe(403);
    expect(decision.redirectTo).toBe(COMPANY_TERMS_PATH);
    expect(decision.redirectTo).not.toBe(SUPERADMIN_LEGAL_PATH);

    const page = fs.readFileSync(
      path.join(process.cwd(), "app/admin/legal/page.js"),
      "utf8"
    );
    expect(page).toContain("legalAreaDecision");
    expect(page).toContain("redirect(access.redirectTo)");
  });

  it("keeps the superadmin hub for SUPERADMIN", () => {
    expect(legalAreaDecision(ROLE.SUPERADMIN)).toEqual({
      allow: true,
      redirectTo: null,
      status: 200,
    });
    for (const file of [
      "app/api/admin/legal/documents/route.js",
      "app/api/admin/legal/config/route.js",
      "app/api/admin/legal/partners/route.js",
      "app/api/admin/legal/booking-audit/[orderId]/route.js",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src).toContain("requireSuperAdmin");
    }
  });

  it("shows a company ADMIN only its own profile and documents", () => {
    expect(ownCompanyScope(adminSession(), OWN)).toEqual({
      companyId: OWN,
      forbidden: false,
    });
    expect(ownCompanyScope(adminSession(), OTHER)).toEqual({
      companyId: "",
      forbidden: true,
    });
  });
});

describe("partner terms package", () => {
  it("shows a neutral waiting state and no superadmin link while unpublished", () => {
    const view = presentPartnerTerms({
      documents: published.map((doc) => ({ ...doc, source: "draft" })),
      containsDrafts: true,
      currentChecksum: "draft",
    });
    expect(view.state).toBe("preparing");
    expect(view.canAccept).toBe(false);
    expect(view.links).toEqual([]);
    expect(JSON.stringify(view)).not.toContain("/admin/legal");
    expect(partnerLegalEn.companyPage.preparing).toBe(
      "Rovaro is preparing the terms. No action is required from you yet."
    );

    const panel = fs.readFileSync(
      path.join(process.cwd(), "app/admin/company/legal/CompanyTermsPanel.js"),
      "utf8"
    );
    expect(panel).not.toContain("/admin/legal");
    expect(standardPackageNeedsPublish([])).toBe(true);
  });

  it("accepts a published standard package in one action and records the signer", () => {
    const view = presentPartnerTerms({
      documents: published,
      containsDrafts: false,
      activeChecksum: "",
      currentChecksum: standardPkg.packageChecksum,
    });
    expect(view.state).toBe("ready");
    expect(view.canAccept).toBe(true);
    expect(view.standardApplies).toBe(true);
    expect(view.label).toBe("standard");
    expect(view.links.every((link) => !link.href.startsWith("/admin"))).toBe(
      true
    );

    const record = buildTermsAcceptance({
      accepted: true,
      signerName: "Ada Fleet",
      signerRole: "Director",
      sessionEmail: "ada@fleet.test",
      companyId: OWN,
      userId: "user-1",
      acceptedAt: "2026-09-23T17:00:00.000Z",
      ipAddress: "203.0.113.8",
      userAgent: "Jest",
      documents: published,
      packageChecksum: standardPkg.packageChecksum,
    });
    expect(record.acceptedCheckbox).toBe(true);
    expect(record.confirmationOfAuthority).toBe(true);
    expect(record.signerEmail).toBe("ada@fleet.test");
    expect(record.companyId).toBe(OWN);
    expect(record.authenticatedUserId).toBe("user-1");
    expect(record.documents.map((doc) => doc.version)).toEqual([1, 1, 1]);
    expect(record.packageChecksum).toBe(standardPkg.packageChecksum);
    expect(record.ipAddress).toBe("203.0.113.8");
  });

  it("refuses to edit a signed acceptance", () => {
    expect(() =>
      assertOnlyLifecycleFields({ $set: { signerName: "Someone else" } })
    ).toThrow(/immutable/);
  });

  it("uses standard terms when no custom agreement is assigned", () => {
    const next = withCustomAgreement(standardPkg, null);
    expect(next).toBe(standardPkg);
    expect(next.packageChecksum).toBe("standard-checksum");
    expect(
      presentPartnerTerms({
        documents: next.documents,
        currentChecksum: next.packageChecksum,
      }).label
    ).toBe("standard");
  });

  it("includes an assigned custom agreement in the same package", () => {
    const next = withCustomAgreement(standardPkg, {
      documentId: "custom-1",
      version: 3,
      title: "Harbour addendum",
      checksum: "custom-hash",
      overrides: [
        { documentType: "partner-agreement", heading: "Fees", text: "Custom fees" },
      ],
    });
    expect(next.hasCustomAgreement).toBe(true);
    expect(next.documents.at(-1).documentType).toBe("custom-agreement");
    expect(next.documents.at(-1).version).toBe(3);
    expect(next.documents[0].renderedSections[0].text).toBe("Custom fees");
    expect(next.packageChecksum).not.toBe(standardPkg.packageChecksum);
    expect(
      presentPartnerTerms({
        documents: next.documents,
        customAgreement: { documentId: "custom-1", version: 3 },
        currentChecksum: next.packageChecksum,
      }).label
    ).toBe("custom");
  });

  it("marks an older acceptance outdated without touching confirmed bookings", () => {
    const next = withCustomAgreement(standardPkg, {
      documentId: "custom-2",
      version: 4,
      checksum: "next",
    });
    expect(acceptanceOutdated(standardPkg.packageChecksum, next.packageChecksum)).toBe(
      true
    );
    expect(
      presentPartnerTerms({
        documents: published,
        activeChecksum: "old",
        currentChecksum: "new",
      }).state
    ).toBe("updated");
    expect(
      republishLeavesOrder({ bookingStatus: "BOOKING_CONFIRMED", paid: true })
    ).toBe(true);
    const publisher = fs.readFileSync(
      path.join(process.cwd(), "domain/legal/documentService.js"),
      "utf8"
    );
    expect(publisher).not.toContain("BOOKING_CONFIRMED");
  });

  it("lets the operating gate pass a current standard acceptance when listing is on", () => {
    const gate = evaluatePartnerOperatingGate({
      profile: { verificationStatus: S.VERIFIED },
      completeness: { ready: true },
      activeAgreement: { packageChecksum: "standard-checksum" },
      currentPackageChecksum: "standard-checksum",
    });
    expect(companyMayOperate({ gate, listedOnMarketplace: true })).toBe(true);
    expect(companyMayOperate({ gate, listedOnMarketplace: false })).toBe(false);
    expect(superadminMayAcceptTerms(ROLE.SUPERADMIN)).toBe(false);
    expect(superadminMayAcceptTerms(ROLE.ADMIN)).toBe(true);
  });
});

describe("company legal copy", () => {
  it("renders the short EN and ES states", () => {
    expect(partnerLegalEn.companyPage.standardApply).toBe(
      "Standard Rovaro Terms apply"
    );
    expect(partnerLegalEn.companyPage.termsReady).toBe("Terms ready to accept");
    expect(partnerLegalEn.companyPage.acceptTerms).toBe("Accept terms");
    expect(partnerLegalEn.companyPage.termsAccepted).toBe("Terms accepted");
    expect(partnerLegalEn.companyPage.termsUpdated).toBe(
      "Updated terms require acceptance"
    );
    expect(partnerLegalEs.companyPage.acceptTerms).toBe("Aceptar condiciones");
    expect(partnerLegalEs.companyPage.preparing).not.toBe(
      partnerLegalEn.companyPage.preparing
    );
    expect(partnerLegalEs.companyPage.standardApply).toMatch(/Rovaro/);
    expect(companyLegalStatusKey({ verificationStatus: "DRAFT" })).toBe("draft");
    expect(
      companyLegalStatusKey({ verificationStatus: "PENDING_VERIFICATION" })
    ).toBe("underReview");
    expect(companyLegalStatusKey({ submittedAt: "2026-09-23" })).toBe("submitted");
    expect(legacyLegalProfileRedirect("agreement")).toBe(
      "/admin/company/legal?tab=terms"
    );
    expect(legacyLegalProfileRedirect("profile")).toBe(COMPANY_TERMS_PATH);
  });
});

describe("company terms screen", () => {
  const companyFiles = [
    "app/admin/company/legal/CompanyTermsPanel.js",
    "app/admin/legal-profile/agreement/PartnerAgreementSection.js",
    "app/admin/legal-profile/LegalProfileHubSection.js",
    "app/admin/legal-profile/_components/PartnerComplianceGate.js",
  ];

  function read(file) {
    return fs.readFileSync(path.join(process.cwd(), file), "utf8");
  }

  it("1. No company-facing render contains Open Legal documents", () => {
    for (const file of companyFiles) {
      expect(read(file)).not.toContain("Open Legal documents");
    }
  });

  it("2. No company-facing render links to /admin/legal", () => {
    for (const file of companyFiles) {
      expect(read(file)).not.toContain('"/admin/legal');
    }
  });

  it("3. No company-facing render tells the partner to publish drafts", () => {
    const panel = read("app/admin/company/legal/CompanyTermsPanel.js");
    const legacy = read("app/admin/legal-profile/agreement/PartnerAgreementSection.js");
    expect(panel).not.toContain("publish");
    expect(legacy).not.toContain("publish");
    expect(partnerLegalEn.companyPage.preparing).not.toMatch(/publish/i);
  });

  it("4. Draft package hides signer fields and acceptance controls", () => {
    const view = presentPartnerTerms({ containsDrafts: true, documents: published });
    expect(view.state).toBe("preparing");
    expect(view.canAccept).toBe(false);
    const panel = read("app/admin/company/legal/CompanyTermsPanel.js");
    expect(panel).toContain('view.state === "preparing"');
    expect(panel.indexOf("partnerLegal.companyPage.preparing")).toBeLessThan(
      panel.indexOf("partnerLegal.companyPage.signerName")
    );
  });

  it("5. Draft package shows only the neutral waiting message", () => {
    expect(partnerLegalEn.companyPage.preparing).toBe(
      "Rovaro is preparing the terms. No action is required from you yet."
    );
    const panel = read("app/admin/company/legal/CompanyTermsPanel.js");
    expect(panel).toContain("partnerLegal.companyPage.terms");
    expect(panel).toContain("partnerLegal.companyPage.preparing");
  });

  it("6. Published package shows the simplified acceptance UI", () => {
    const view = presentPartnerTerms({
      documents: published,
      containsDrafts: false,
      currentChecksum: "new",
    });
    expect(view.state).toBe("ready");
    expect(view.canAccept).toBe(true);
    expect(view.links.map((link) => link.documentType)).toEqual([
      "partner-agreement",
      "partner-operating-rules",
      "data-protection-schedule",
    ]);
    const panel = read("app/admin/company/legal/CompanyTermsPanel.js");
    expect(panel).toContain("partnerLegal.companyPage.standardApply");
    expect(panel).toContain("partnerLegal.companyPage.authority");
    expect(panel).toContain("partnerLegal.companyPage.acceptTerms");
    expect(panel.match(/<FormControlLabel/g)).toHaveLength(1);
  });

  it("7. Ask our waiters and unrelated company fields cannot populate signer role", () => {
    expect(explicitSignerRole({ signatoryRole: "Ask our waiters" })).toBe("");
    expect(
      explicitSignerRole({
        slogan: "Ask our waiters",
        description: "Ask our waiters tonight",
        notification: "Ask our waiters",
      })
    ).toBe("");
    expect(explicitSignerRole({ signatoryRole: "Director" })).toBe("Director");
    expect(explicitSignerRole({ legalRole: "Owner" })).toBe("Owner");
    expect(explicitSignerRole({ signerRole: "Authorised representative" })).toBe(
      "Authorised representative"
    );
  });

  it("8. Technical audit details are not displayed", () => {
    const panel = read("app/admin/company/legal/CompanyTermsPanel.js");
    const legacy = read("app/admin/legal-profile/agreement/PartnerAgreementSection.js");
    for (const src of [panel, legacy]) {
      expect(src).not.toContain("What is recorded");
      expect(src).not.toContain("checksum");
      expect(src).not.toContain("user agent");
      expect(src).not.toContain("userAgent");
    }
  });

  it("9. Legacy URLs redirect to /admin/company/legal?tab=terms", () => {
    expect(legacyLegalProfileRedirect()).toBe(COMPANY_TERMS_PATH);
    expect(read("app/admin/legal-profile/page.js")).toContain(
      "legacyLegalProfileRedirect()"
    );
    expect(read("app/admin/legal-profile/agreement/page.js")).toContain(
      "?tab=terms"
    );
    expect(read("app/admin/legal-profile/agreement/PartnerAgreementSection.js")).toContain(
      "COMPANY_TERMS_PATH"
    );
  });

  it("10. SUPERADMIN in company context receives the same company Terms page", () => {
    const impersonating = { role: ROLE.SUPERADMIN, viewAsCompanyId: OWN };
    expect(legalNavHref({ role: ROLE.SUPERADMIN, companyContextActive: true })).toBe(
      COMPANY_TERMS_PATH
    );
    expect(legalAreaDecision(impersonating).redirectTo).toBe(COMPANY_TERMS_PATH);
    expect(companyLegalPageAccess(impersonating).allow).toBe(true);
  });

  it("11. SUPERADMIN outside company context retains the platform legal hub", () => {
    expect(legalNavHref({ role: ROLE.SUPERADMIN, companyContextActive: false })).toBe(
      SUPERADMIN_LEGAL_PATH
    );
    expect(legalAreaDecision({ role: ROLE.SUPERADMIN }).allow).toBe(true);
  });
});
