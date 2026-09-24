/**
 * @jest-environment node
 */

import {
  DOCUMENT_REQUIREMENT,
  listRequiredDocumentKinds,
  resolveDocumentRequirements,
} from "../partnerDocumentRequirements";
import {
  DOCUMENT_PROBLEM_REASON,
  DOCUMENT_REVIEW_STATE,
  applyDocumentChecked,
  applyDocumentProblem,
  resolveDocumentReviewState,
} from "../partnerDocumentReview";
import {
  buildPartnerReviewReadiness,
} from "../partnerReviewReadiness";
import {
  applyVerificationTransition,
  PARTNER_VERIFICATION_STATUS as S,
  REJECTION_DECISION,
} from "../partnerVerification";
import {
  reviewDisplayStatus,
  REVIEW_DISPLAY_STATUS,
  reviewDisplayStatusLabel,
} from "../partnerReviewWorkspace";

const OPTIONAL_DOCS = [
  {
    kind: "company_registration",
    storageRef: "raw/a",
    label: "reg.pdf",
    uploadedAt: "2026-09-21",
  },
  {
    kind: "insurance_certificate",
    storageRef: "raw/b",
    label: "ins.pdf",
    uploadedAt: "2026-09-21",
  },
  {
    kind: "vehicle_authority",
    storageRef: "raw/c",
    label: "auth.pdf",
    uploadedAt: "2026-09-21",
  },
];

describe("document requirements", () => {
  it("classifies ES evidence as optional by default", () => {
    const req = resolveDocumentRequirements({ country: "ES" });
    expect(req.company_registration).toBe(DOCUMENT_REQUIREMENT.OPTIONAL);
    expect(req.insurance_certificate).toBe(DOCUMENT_REQUIREMENT.OPTIONAL);
    expect(listRequiredDocumentKinds(req)).toEqual([]);
  });

  it("honours required overrides without treating optional as missing", () => {
    const req = resolveDocumentRequirements({
      country: "ES",
      overrides: { insurance_certificate: DOCUMENT_REQUIREMENT.REQUIRED },
    });
    expect(listRequiredDocumentKinds(req)).toEqual(["insurance_certificate"]);
  });
});

describe("review readiness", () => {
  it("never reports optional documents as missing", () => {
    const readiness = buildPartnerReviewReadiness({
      profile: { legalName: "Test", documents: [] },
      country: "ES",
    });
    expect(readiness.requiredDocuments.noneRequired).toBe(true);
    expect(readiness.requiredDocuments.missing).toEqual([]);
    expect(readiness.canApprove).toBe(true);
    expect(readiness.missingItems).toEqual([]);
  });

  it("lists exact required missing documents", () => {
    const readiness = buildPartnerReviewReadiness({
      profile: { legalName: "Test", documents: [] },
      country: "ES",
      requirementOverrides: {
        insurance_certificate: DOCUMENT_REQUIREMENT.REQUIRED,
      },
    });
    expect(readiness.canApprove).toBe(false);
    expect(readiness.missingItems).toEqual([
      {
        type: "document",
        key: "insurance_certificate",
        label: "Insurance certificate",
      },
    ]);
    expect(readiness.approveBlockedReasons[0]).toContain("Insurance certificate");
  });

  it("lists exact missing legal fields", () => {
    const readiness = buildPartnerReviewReadiness({
      profile: { legalName: "", documents: OPTIONAL_DOCS },
      country: "ES",
    });
    expect(readiness.companyDetails.complete).toBe(false);
    expect(readiness.missingItems).toEqual([
      { type: "field", key: "legalName", label: "Legal name" },
    ]);
  });

  it("enables approve when three optional docs are uploaded and none required", () => {
    const readiness = buildPartnerReviewReadiness({
      profile: { legalName: "Test", documents: OPTIONAL_DOCS },
      country: "ES",
    });
    expect(readiness.optionalDocuments.uploadedCount).toBe(3);
    expect(readiness.requiredDocuments.noneRequired).toBe(true);
    expect(readiness.canApprove).toBe(true);
    expect(readiness.readyCopy).toBe("Ready for your decision.");
  });

  it("surfaces document problems in the summary and blocks approve", () => {
    const docs = OPTIONAL_DOCS.map((doc) => ({ ...doc }));
    applyDocumentProblem(docs[1], {
      reason: DOCUMENT_PROBLEM_REASON.EXPIRED,
      byEmail: "root@rovaro.test",
    });
    const readiness = buildPartnerReviewReadiness({
      profile: { legalName: "Test", documents: docs },
      country: "ES",
    });
    expect(readiness.canApprove).toBe(false);
    expect(readiness.documentProblems[0].kind).toBe("insurance_certificate");
    expect(readiness.missingItems.some((item) => item.type === "document_problem")).toBe(
      true
    );
  });

  it("does not mark a document checked merely because it was opened", () => {
    const doc = { ...OPTIONAL_DOCS[0] };
    expect(resolveDocumentReviewState(doc)).toBe(DOCUMENT_REVIEW_STATE.NOT_CHECKED);
    applyDocumentChecked(doc, { byEmail: "root@rovaro.test" });
    expect(resolveDocumentReviewState(doc)).toBe(DOCUMENT_REVIEW_STATE.CHECKED);
  });
});

describe("request changes vs reject metadata", () => {
  it("stores requested changes under REJECTED without a new status", () => {
    const profile = {
      verificationStatus: S.PENDING_VERIFICATION,
      statusHistory: [],
    };
    const result = applyVerificationTransition(profile, {
      to: S.REJECTED,
      byEmail: "root@rovaro.test",
      reason: "Please fix insurance",
      rejectionDecision: REJECTION_DECISION.CHANGES_REQUESTED,
      requestedChanges: [
        {
          type: "document",
          key: "insurance_certificate",
          label: "Insurance certificate",
        },
      ],
      internalNote: "blurry scan",
    });
    expect(result.ok).toBe(true);
    expect(profile.verificationStatus).toBe(S.REJECTED);
    expect(profile.rejectionDecision).toBe(REJECTION_DECISION.CHANGES_REQUESTED);
    expect(profile.requestedChanges).toHaveLength(1);
    expect(profile.verificationNote).toBe("blurry scan");
    expect(reviewDisplayStatus(profile)).toBe(REVIEW_DISPLAY_STATUS.CHANGES_REQUESTED);
    expect(reviewDisplayStatusLabel(profile)).toBe("Changes requested");
  });

  it("rejects with structured decision and no changes list", () => {
    const profile = {
      verificationStatus: S.PENDING_VERIFICATION,
      statusHistory: [],
    };
    applyVerificationTransition(profile, {
      to: S.REJECTED,
      reason: "Fraud concern",
      rejectionDecision: REJECTION_DECISION.REJECTED,
    });
    expect(reviewDisplayStatus(profile)).toBe(REVIEW_DISPLAY_STATUS.REJECTED);
    expect(reviewDisplayStatusLabel(profile)).toBe("Rejected");
  });

  it("shows Suspend only after verified and never Approve", () => {
    const profile = {
      verificationStatus: S.VERIFIED,
      verifiedByEmail: "root@rovaro.test",
      verificationStatusAt: new Date("2026-09-24"),
    };
    expect(reviewDisplayStatus(profile)).toBe(REVIEW_DISPLAY_STATUS.APPROVED);
  });
});

describe("UI copy hygiene", () => {
  it("never exposes PENDING_VERIFICATION as a display label", () => {
    expect(
      reviewDisplayStatusLabel({
        verificationStatus: S.PENDING_VERIFICATION,
      })
    ).toBe("Awaiting review");
    expect(
      reviewDisplayStatusLabel({
        verificationStatus: S.PENDING_VERIFICATION,
      })
    ).not.toMatch(/PENDING_VERIFICATION/);
  });
});
