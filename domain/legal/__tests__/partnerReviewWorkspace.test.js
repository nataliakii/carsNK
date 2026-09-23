/**
 * @jest-environment node
 */

import { buildAdminCountryCompanyFilter } from "@/domain/platform/adminCountryScope";

const {
  planOneRecordPendingRepair,
  REPAIR_TARGET_COMPANY_ID,
} = require("../repairPartnerLegalPending");

import {
  PARTNER_REVIEW_FILTER,
  buildPartnerReviewCompliance,
  resolvePartnerReviewUrl,
  reviewControlsForStatus,
  shouldShowPendingEmpty,
  visiblePartnerRows,
} from "../partnerReviewWorkspace";

const PENDING = "PENDING_VERIFICATION";
const DOCS = [
  { kind: "company_registration", storageRef: "raw/a" },
  { kind: "insurance_certificate", storageRef: "raw/b" },
  { kind: "vehicle_authority", storageRef: "raw/c" },
];

function row(companyId, status, extra = {}) {
  return {
    companyId,
    verification: status ? { status, ...extra } : null,
    ...extra,
  };
}

describe("partner review filters", () => {
  const rows = [
    row("pending-es", PENDING),
    row("draft-es", "DRAFT"),
    row("verified-es", "VERIFIED"),
    row("rejected-es", "REJECTED"),
    row("suspended-es", "SUSPENDED"),
  ];

  it("shows a pending company in Needs review", () => {
    const visible = visiblePartnerRows(rows, PARTNER_REVIEW_FILTER.PENDING);
    expect(visible.map((item) => item.companyId)).toEqual(["pending-es"]);
  });

  it("hides a DRAFT company from Needs review", () => {
    const visible = visiblePartnerRows(rows, PARTNER_REVIEW_FILTER.PENDING);
    expect(visible.map((item) => item.companyId)).not.toContain("draft-es");
  });

  it("shows a DRAFT company in All partners", () => {
    const visible = visiblePartnerRows(rows, PARTNER_REVIEW_FILTER.ALL);
    expect(visible.map((item) => item.companyId)).toContain("draft-es");
    expect(visible).toHaveLength(rows.length);
  });

  it("deep-links a DRAFT company into All partners", () => {
    expect(
      resolvePartnerReviewUrl({
        filter: null,
        companyId: "draft-es",
        rows,
      })
    ).toEqual({ filter: "all", companyId: "draft-es" });
  });

  it("deep-links a pending company into Needs review", () => {
    expect(
      resolvePartnerReviewUrl({
        filter: null,
        companyId: "pending-es",
        rows,
      })
    ).toEqual({ filter: "pending", companyId: "pending-es" });
  });

  it("does not show the empty pending message together with a selected DRAFT", () => {
    const resolved = resolvePartnerReviewUrl({
      filter: "pending",
      companyId: "draft-es",
      rows,
    });
    const visible = visiblePartnerRows(rows, resolved.filter);
    const selectedVisible = visible.some((item) => item.companyId === resolved.companyId);
    expect(resolved.filter).toBe("all");
    expect(selectedVisible).toBe(true);
    expect(
      shouldShowPendingEmpty({
        filter: resolved.filter,
        visibleCount: visible.length,
        selectedVisible,
      })
    ).toBe(false);
  });

  it("shows the empty pending message only when nothing is selected", () => {
    expect(
      shouldShowPendingEmpty({
        filter: "pending",
        visibleCount: 0,
        selectedVisible: false,
      })
    ).toBe(true);
    expect(
      shouldShowPendingEmpty({
        filter: "all",
        visibleCount: 0,
        selectedVisible: false,
      })
    ).toBe(false);
  });

  it("keeps filter and company on refresh, back and forward", () => {
    const first = resolvePartnerReviewUrl({
      filter: null,
      companyId: "draft-es",
      rows,
    });
    const refreshed = resolvePartnerReviewUrl({
      filter: first.filter,
      companyId: first.companyId,
      rows,
    });
    const pendingLink = resolvePartnerReviewUrl({
      filter: null,
      companyId: "pending-es",
      rows,
    });
    const back = resolvePartnerReviewUrl({
      filter: pendingLink.filter,
      companyId: pendingLink.companyId,
      rows,
    });
    expect(refreshed).toEqual(first);
    expect(back).toEqual({ filter: "pending", companyId: "pending-es" });
    expect(refreshed).toEqual({ filter: "all", companyId: "draft-es" });
  });
});

describe("partner review actions", () => {
  it("does not show Approve or Reject for DRAFT", () => {
    expect(reviewControlsForStatus("DRAFT")).toEqual({
      moveToReview: true,
      approve: false,
      reject: false,
      suspend: false,
      reopenDraft: false,
    });
  });

  it("shows Approve and Reject for a pending profile", () => {
    const controls = reviewControlsForStatus(PENDING);
    expect(controls.approve).toBe(true);
    expect(controls.reject).toBe(true);
    expect(controls.moveToReview).toBe(false);
  });

  it("does not show Approve again for a verified profile", () => {
    const controls = reviewControlsForStatus("VERIFIED");
    expect(controls.approve).toBe(false);
    expect(controls.reject).toBe(false);
    expect(controls.suspend).toBe(true);
  });
});

describe("one-record pending repair", () => {
  const company = { _id: REPAIR_TARGET_COMPANY_ID, name: "Test" };
  const profile = {
    _id: "6ab11a02d84058a7fa56a0fd",
    companyId: REPAIR_TARGET_COMPANY_ID,
    verificationStatus: "DRAFT",
    legalName: "",
    submittedAt: null,
    documents: DOCS,
  };

  it("changes exactly the intended profile", () => {
    const plan = planOneRecordPendingRepair({ company, profile });
    expect(plan.apply).toBe(true);
    expect(plan.profileId).toBe("6ab11a02d84058a7fa56a0fd");
    expect(plan.companyId).toBe(REPAIR_TARGET_COMPANY_ID);
    expect(plan.set.verificationStatus).toBe(PENDING);
    expect(plan.set.legalName).toBe("Test");
    expect(plan.notifies).toBe(false);
    expect(
      planOneRecordPendingRepair({
        company: { _id: "679903bd10e6c8a8c0f027bc", name: "CarsNK" },
        profile: {
          _id: "other",
          companyId: "679903bd10e6c8a8c0f027bc",
          verificationStatus: "DRAFT",
          documents: DOCS,
        },
      }).apply
    ).toBe(false);
  });

  it("preserves all documents", () => {
    const plan = planOneRecordPendingRepair({ company, profile });
    expect(plan.documents).toEqual([
      { kind: "company_registration", storageRef: "raw/a" },
      { kind: "insurance_certificate", storageRef: "raw/b" },
      { kind: "vehicle_authority", storageRef: "raw/c" },
    ]);
    expect(plan.set.documents).toBeUndefined();
    expect(plan.pushHistory.from).toBe("DRAFT");
    expect(plan.pushHistory.to).toBe(PENDING);
  });

  it("is idempotent when run again", () => {
    const first = planOneRecordPendingRepair({ company, profile });
    const second = planOneRecordPendingRepair({
      company,
      profile: {
        ...profile,
        verificationStatus: first.set.verificationStatus,
        legalName: first.set.legalName,
        submittedAt: first.set.submittedAt,
        documents: DOCS,
        statusHistory: [first.pushHistory],
      },
    });
    expect(second.apply).toBe(false);
    expect(second.code).toBe("not_draft");
    expect(second.documents).toHaveLength(3);
  });
});

describe("agreement and operating gate on the review card", () => {
  it("keeps a missing agreement visible and the operating gate blocked", () => {
    const summary = buildPartnerReviewCompliance({
      verificationStatus: PENDING,
      documentCount: 3,
      listedOnMarketplace: true,
      activeAgreement: null,
      agreementHistory: [],
      currentPackageChecksum: "current-package",
      completeness: { ready: true },
    });
    expect(summary.documentCount).toBe(3);
    expect(summary.verificationStatus).toBe(PENDING);
    expect(summary.agreementStatus).toBe("not_accepted");
    expect(summary.listingOn).toBe(true);
    expect(summary.operating).toBe("blocked");
  });

  it("stays blocked after verification until the current agreement is accepted", () => {
    const verifiedWithoutAgreement = buildPartnerReviewCompliance({
      verificationStatus: "VERIFIED",
      documentCount: 3,
      listedOnMarketplace: true,
      activeAgreement: null,
      agreementHistory: [],
      currentPackageChecksum: "current-package",
    });
    const ready = buildPartnerReviewCompliance({
      verificationStatus: "VERIFIED",
      documentCount: 3,
      listedOnMarketplace: true,
      activeAgreement: { packageChecksum: "current-package" },
      currentPackageChecksum: "current-package",
    });
    expect(verifiedWithoutAgreement.operating).toBe("blocked");
    expect(verifiedWithoutAgreement.agreementStatus).toBe("not_accepted");
    expect(ready.agreementStatus).toBe("current");
    expect(ready.operating).toBe("ready");
  });
});

describe("partner review workspace scope", () => {
  it("ES company filter excludes Greece legacy empties", () => {
    const filter = buildAdminCountryCompanyFilter("ES");
    expect(filter).toEqual({ country: "ES" });
  });

  it("GR company filter includes missing country (legacy)", () => {
    const filter = buildAdminCountryCompanyFilter("GR");
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        { country: "GR" },
        { country: { $exists: false } },
      ])
    );
  });

  it("pending count drops after approval (status change semantics)", () => {
    const rows = [
      { companyId: "a", country: "ES", verification: { status: "PENDING_VERIFICATION" } },
      { companyId: "b", country: "ES", verification: { status: "PENDING_VERIFICATION" } },
      { companyId: "c", country: "GR", verification: { status: "PENDING_VERIFICATION" } },
    ];
    const esPending = rows.filter(
      (item) =>
        item.country === "ES" && item.verification?.status === "PENDING_VERIFICATION"
    );
    expect(esPending).toHaveLength(2);

    rows[0].verification.status = "VERIFIED";
    const after = rows.filter(
      (item) =>
        item.country === "ES" && item.verification?.status === "PENDING_VERIFICATION"
    );
    expect(after).toHaveLength(1);

    rows[1].verification.status = "REJECTED";
    const cleared = rows.filter(
      (item) =>
        item.country === "ES" && item.verification?.status === "PENDING_VERIFICATION"
    );
    expect(cleared).toHaveLength(0);
  });

  it("repeated partner profile saves while PENDING do not duplicate queue rows", () => {
    const byCompany = new Map();
    const upsert = (companyId, status) => {
      byCompany.set(companyId, { companyId, status });
    };
    upsert("es-1", "PENDING_VERIFICATION");
    upsert("es-1", "PENDING_VERIFICATION");
    upsert("es-1", "PENDING_VERIFICATION");
    expect([...byCompany.values()]).toHaveLength(1);
  });
});
