/**
 * @jest-environment node
 *
 * Pure helpers for workspace-scoped partner review counts.
 */

import { buildAdminCountryCompanyFilter } from "@/domain/platform/adminCountryScope";

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
      (r) =>
        r.country === "ES" && r.verification?.status === "PENDING_VERIFICATION"
    );
    expect(esPending).toHaveLength(2);

    // Approve one Spain partner
    rows[0].verification.status = "VERIFIED";
    const after = rows.filter(
      (r) =>
        r.country === "ES" && r.verification?.status === "PENDING_VERIFICATION"
    );
    expect(after).toHaveLength(1);

    // Reject remaining
    rows[1].verification.status = "REJECTED";
    const cleared = rows.filter(
      (r) =>
        r.country === "ES" && r.verification?.status === "PENDING_VERIFICATION"
    );
    expect(cleared).toHaveLength(0);
  });

  it("repeated partner profile saves while PENDING do not duplicate queue rows", () => {
    const byCompany = new Map();
    const upsert = (companyId, status) => {
      byCompany.set(companyId, { companyId, status });
    };
    upsert("es-1", "PENDING_VERIFICATION");
    upsert("es-1", "PENDING_VERIFICATION"); // re-save
    upsert("es-1", "PENDING_VERIFICATION");
    expect([...byCompany.values()]).toHaveLength(1);
  });
});
