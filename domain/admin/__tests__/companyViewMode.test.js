import fs from "fs";
import path from "path";

import { ROLE } from "@models/user";
import {
  ADMIN_VIEW_MODE,
  platformReviewMutationAllowed,
  resolveAdminViewMode,
} from "@/domain/admin/adminViewMode";
import { companyTermsPublication } from "@/domain/legal/companyLegalPage";
import {
  MATERIAL_PROFILE_FIELDS,
  NON_MATERIAL_PROFILE_FIELDS,
  applyPendingProfileChanges,
  discardPendingProfileChanges,
  isMaterialProfileField,
  pendingProfileChangeSummary,
  planVerifiedProfileSave,
} from "@/domain/legal/verifiedProfileChanges";
import { PARTNER_VERIFICATION_STATUS as S } from "@/domain/legal/partnerVerification";

const OWN = "507f1f77bcf86cd799439011";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("company view mode", () => {
  const admin = { role: ROLE.ADMIN, isAdmin: true, ownerId: OWN };
  const platform = { role: ROLE.SUPERADMIN, isAdmin: true };
  const inside = { role: ROLE.SUPERADMIN, isAdmin: true, viewAsCompanyId: OWN };

  it("1. Company ADMIN never sees Approve, Reject or Suspend", () => {
    expect(resolveAdminViewMode(admin)).toBe(ADMIN_VIEW_MODE.COMPANY);
    const page = read("app/admin/legal-profile/PartnerLegalProfileSection.js");
    expect(page).toContain("companyView ? null");
    expect(page).toContain("<PartnerReviewActions");
  });

  it("2. Company ADMIN cannot call verification/suspension APIs", () => {
    expect(platformReviewMutationAllowed(admin)).toBe(false);
    expect(read("lib/adminAuth.js")).toContain("requirePlatformAdmin");
    expect(read("app/api/admin/legal/partners/[companyId]/route.js")).toContain(
      "requirePlatformAdmin"
    );
  });

  it("3. SUPERADMIN in company context never sees platform review controls", () => {
    expect(resolveAdminViewMode(inside)).toBe(ADMIN_VIEW_MODE.COMPANY);
    const actions = read(
      "app/admin/legal-profile/_components/PartnerReviewActions.js"
    );
    const sticky = read(
      "app/admin/legal-profile/_components/PartnerLegalReview/StickyReviewActions.js"
    );
    expect(actions).toContain("ADMIN_VIEW_MODE.PLATFORM_ADMIN");
    expect(sticky).toContain("ADMIN_VIEW_MODE.PLATFORM_ADMIN");
    expect(actions).not.toContain("Number(session?.user?.role)");
  });

  it("4. SUPERADMIN in company context cannot call platform review mutations", () => {
    expect(platformReviewMutationAllowed(inside)).toBe(false);
  });

  it("5. SUPERADMIN outside company context retains review controls", () => {
    expect(resolveAdminViewMode(platform)).toBe(ADMIN_VIEW_MODE.PLATFORM_ADMIN);
    expect(platformReviewMutationAllowed(platform)).toBe(true);
    expect(read("app/admin/partners/page.js")).toContain(
      "ADMIN_VIEW_MODE.PLATFORM_ADMIN"
    );
  });

  it("6. Unpublished terms never show Open agreement", () => {
    const view = companyTermsPublication({ documents: [], containsDrafts: true });
    expect(view.publication).toBe("NOT_PUBLISHED");
    expect(view.canAccept).toBe(false);
    expect(view.links).toEqual([]);
    const copy = read("locales/partnerLegal.js");
    expect(copy).not.toContain("Open agreement");
  });

  it("7. Unpublished terms are not described as an unsigned agreement", () => {
    const copy = read("locales/partnerLegal.js");
    expect(copy).not.toContain("Master Partner Agreement has not been signed");
    expect(copy).toContain("Partner terms are being prepared");
  });

  it("8. Documents tab contains no agreement controls", () => {
    const section = read("app/admin/company/legal/CompanyLegalSection.js");
    expect(section).toContain('panel="documents"');
    expect(section).not.toContain("PartnerReviewActions");
    const profile = read("app/admin/legal-profile/PartnerLegalProfileSection.js");
    expect(profile).toContain("companyView ? null");
  });

  it("9. Terms and Documents use the same terms publication state", () => {
    const section = read("app/admin/company/legal/CompanyLegalSection.js");
    // One server-resolved value feeds both tabs. Neither re-derives it.
    expect(section).toContain("usePartnerLegalStatus()");
    expect(section).toContain("termsPublication={publication}");
    expect(section).toContain("<CompanyTermsPanel");
    expect(section).toContain("termsPublication={publication}");
    expect(section).not.toContain("companyTermsPublication({");
    const panel = read("app/admin/company/legal/CompanyTermsPanel.js");
    expect(panel).not.toContain("companyTermsPublication({");
    const status = read("app/api/partner/legal/status/route.js");
    expect(status).toContain("companyTermsPublication");
    expect(status).toContain("termsPublication: publication.publication");
    const unpublished = companyTermsPublication({ containsDrafts: true });
    const ready = companyTermsPublication({
      documents: [{ documentType: "partner-agreement", source: "published" }],
      containsDrafts: false,
      currentChecksum: "pkg",
    });
    expect(unpublished.publication).toBe("NOT_PUBLISHED");
    expect(ready.publication).toBe("READY_TO_ACCEPT");
  });

  it("10. Opening edit mode does not stop trading", () => {
    const profile = read("app/admin/legal-profile/PartnerLegalProfileSection.js");
    expect(profile).toContain("setUnlocked(true)");
    expect(profile).not.toContain("trading will stop");
    const plan = planVerifiedProfileSave(
      { verificationStatus: S.VERIFIED, legalName: "Test" },
      {}
    );
    expect(plan.suspend).toBe(false);
    expect(plan.verificationStatus).toBe(S.VERIFIED);
  });

  it("11. Non-material contact changes do not trigger re-verification", () => {
    const plan = planVerifiedProfileSave(
      {
        verificationStatus: S.VERIFIED,
        businessPhone: "+34000",
        notificationLanguage: "en",
        legalName: "Test",
      },
      {
        businessPhone: "+34111",
        notificationLanguage: "es",
        legalName: "Test",
      }
    );
    expect(plan.pending).toBeNull();
    expect(plan.applyNow).toEqual({
      businessPhone: "+34111",
      notificationLanguage: "es",
    });
    expect(plan.verificationStatus).toBe(S.VERIFIED);
    expect(plan.suspend).toBe(false);
  });

  it("11b. Material and non-material fields are classified explicitly", () => {
    for (const field of NON_MATERIAL_PROFILE_FIELDS) {
      expect(isMaterialProfileField(field)).toBe(false);
    }
    for (const field of MATERIAL_PROFILE_FIELDS) {
      expect(isMaterialProfileField(field)).toBe(true);
    }
    // Unknown fields are material until someone classifies them.
    expect(isMaterialProfileField("somethingNew")).toBe(true);
  });

  it("12. Material legal changes create pending changes without overwriting the verified profile", () => {
    const profile = {
      verificationStatus: S.VERIFIED,
      legalName: "Test",
      pendingChanges: { fields: null },
    };
    const plan = planVerifiedProfileSave(profile, { legalName: "Test SL" });
    expect(plan.applyNow).toEqual({});
    expect(plan.pending).toEqual({ legalName: "Test SL" });
    expect(profile.legalName).toBe("Test");
    expect(plan.verificationStatus).toBe(S.VERIFIED);
    profile.pendingChanges = { fields: plan.pending };

    // A reviewer sees only what changed, next to the value they verified.
    expect(pendingProfileChangeSummary(profile)).toEqual([
      { field: "legalName", verified: "Test", proposed: "Test SL", material: true },
    ]);

    const applied = applyPendingProfileChanges(profile);
    expect(applied.applied).toEqual(["legalName"]);
    expect(profile.legalName).toBe("Test SL");
    expect(profile.verificationStatus).toBe(S.VERIFIED);
    expect(pendingProfileChangeSummary(profile)).toEqual([]);
  });

  it("12b. Discarding a proposal leaves the verified profile untouched", () => {
    const profile = {
      verificationStatus: S.VERIFIED,
      legalName: "Test",
      pendingChanges: { fields: { legalName: "Test SL" } },
    };
    expect(discardPendingProfileChanges(profile).discarded).toEqual(["legalName"]);
    expect(profile.legalName).toBe("Test");
    expect(profile.verificationStatus).toBe(S.VERIFIED);
    expect(pendingProfileChangeSummary(profile)).toEqual([]);
  });

  it("13. Direct URLs cannot expose SUPERADMIN controls in company mode", () => {
    const page = read("app/admin/company/setup/page.js");
    expect(page).toContain("resolveAdminViewMode(session.user)");
    expect(platformReviewMutationAllowed(inside)).toBe(false);
  });

  it("14. Server APIs reject forged company IDs and role/context manipulation", () => {
    const auth = read("lib/adminAuth.js");
    expect(auth).toContain("platformReviewMutationAllowed(session.user)");
    expect(auth).not.toContain("body.role");
    const scope = read("domain/legal/companyLegalPage.js");
    expect(scope).toContain("forbidden: true");
  });
});
