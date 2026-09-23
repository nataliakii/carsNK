import fs from "fs";
import path from "path";

import { ROLE } from "@models/user";
import { assertOnlyLifecycleFields } from "@models/PartnerAgreementAcceptance";
import { partnerLegalEn, partnerLegalEs } from "@/locales/partnerLegal";
import { evaluatePartnerOperatingGate } from "@/domain/legal/partnerGate";
import { PARTNER_VERIFICATION_STATUS as S } from "@/domain/legal/partnerVerification";
import {
  COMPANY_LEGAL_PATH,
  SUPERADMIN_LEGAL_PATH,
  acceptanceOutdated,
  buildTermsAcceptance,
  companyLegalStatusKey,
  companyMayOperate,
  legalAreaDecision,
  legacyLegalProfileRedirect,
  ownCompanyScope,
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
  it("refuses /admin/legal to a company ADMIN and sends them to the company page", () => {
    const decision = legalAreaDecision(ROLE.ADMIN);
    expect(decision.allow).toBe(false);
    expect(decision.status).toBe(403);
    expect(decision.redirectTo).toBe(COMPANY_LEGAL_PATH);
    expect(decision.redirectTo).not.toBe(SUPERADMIN_LEGAL_PATH);

    const page = fs.readFileSync(
      path.join(process.cwd(), "app/admin/legal/page.js"),
      "utf8"
    );
    expect(page).toContain('redirect("/admin/company/legal")');
    expect(page).not.toMatch(/redirect\("\/admin"\)/);
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
  });
});
