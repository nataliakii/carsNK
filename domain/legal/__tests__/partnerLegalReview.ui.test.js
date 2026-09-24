/**
 * @jest-environment node
 *
 * Source hygiene for the company-level Legal review UI: no raw verification
 * enums in user-visible default copy, sticky actions present, Approve gated.
 */

const fs = require("fs");
const path = require("path");

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("PartnerLegalReview UI", () => {
  const files = [
    "app/admin/legal-profile/_components/PartnerLegalReview/ReviewHeader.js",
    "app/admin/legal-profile/_components/PartnerLegalReview/ReviewSummary.js",
    "app/admin/legal-profile/_components/PartnerLegalReview/DocumentsChecklist.js",
    "app/admin/legal-profile/_components/PartnerLegalReview/StickyReviewActions.js",
    "app/admin/legal-profile/_components/PartnerLegalReview/index.js",
  ];

  it("keeps the company-level section structure", () => {
    const index = read(files[4]);
    expect(index).toContain("ReviewHeader");
    expect(index).toContain("ReviewSummary");
    expect(index).toContain("CompanyDetails");
    expect(index).toContain("DocumentsChecklist");
    expect(index).toContain("RentalTermsSummary");
    expect(index).toContain("StickyReviewActions");
  });

  it("does not show raw PENDING_VERIFICATION in default UI copy", () => {
    for (const file of files) {
      const src = read(file);
      expect(src).not.toMatch(/defaultValue:\s*["']PENDING_VERIFICATION["']/);
      expect(src).not.toMatch(/defaultValue:\s*["']VERIFIED["']/);
      expect(src).not.toMatch(/defaultValue:\s*["']REJECTED["']/);
    }
  });

  it("replaces per-file Awaiting review with checked/problem controls", () => {
    const docs = read(files[2]);
    expect(docs).toContain("Not checked");
    expect(docs).toContain("Checked");
    expect(docs).toContain("Problem found");
    expect(docs).not.toContain("Awaiting review");
  });

  it("gates Approve on readiness and shows the exact blocked reason", () => {
    const actions = read(files[3]);
    expect(actions).toContain("canApprove");
    expect(actions).toContain("approveBlockedReasons");
    expect(actions).toContain("Approval unavailable");
    expect(actions).toContain("Approve company");
    expect(actions).toContain("Request changes");
    expect(actions).toContain("position: \"sticky\"");
  });

  it("keeps Approve and Request changes visible on mobile with Reject in More", () => {
    const actions = read(files[3]);
    expect(actions).toContain("isMobile");
    expect(actions).toContain("MoreVertIcon");
    expect(actions).toContain("requestChangesOnly");
  });
});
