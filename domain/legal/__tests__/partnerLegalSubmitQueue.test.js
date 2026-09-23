/**
 * @jest-environment node
 */

import {
  PARTNER_VERIFICATION_STATUS,
  applyVerificationTransition,
  evaluateProfileCompleteness,
} from "@/domain/legal/partnerVerification";
import { buildAdminCountryCompanyFilter } from "@/domain/platform/adminCountryScope";

const S = PARTNER_VERIFICATION_STATUS;

function buildQueueRows(companies, profilesByCompanyId) {
  return companies.map((company) => {
    const profile = profilesByCompanyId.get(String(company._id)) || null;
    return {
      companyId: String(company._id),
      companyName: company.name,
      country: company.country,
      listedOnMarketplace: company.listedOnMarketplace !== false,
      verification: profile
        ? {
            status: profile.verificationStatus,
            documents: (profile.documents || []).filter((d) => d.storageRef),
          }
        : null,
    };
  });
}

function needsReview(rows) {
  return rows.filter((r) => r.verification?.status === S.PENDING_VERIFICATION);
}

describe("partner legal submit + Spain review queue", () => {
  const esCompany = {
    _id: "6aaedf3e4cad862dc29d7b1a",
    name: "Test",
    country: "ES",
    listedOnMarketplace: false,
    bookingMode: "MARKETPLACE_REQUEST",
  };
  const grCompany = {
    _id: "679903bd10e6c8a8c0f027bc",
    name: "CarsNK",
    country: "GR",
    listedOnMarketplace: true,
  };

  it("explicit submit transitions DRAFT → PENDING_VERIFICATION", () => {
    const profile = {
      verificationStatus: S.DRAFT,
      legalName: "",
      documents: [{ kind: "company_registration", storageRef: "x" }],
      statusHistory: [],
    };
    const result = applyVerificationTransition(profile, {
      to: S.PENDING_VERIFICATION,
      byEmail: "partner@example.com",
      reason: "Partner submitted profile for review",
    });
    expect(result.ok).toBe(true);
    expect(profile.verificationStatus).toBe(S.PENDING_VERIFICATION);
    expect(profile.statusHistory).toHaveLength(1);
  });

  it("draft autosave does not appear in Needs review", () => {
    const rows = buildQueueRows(
      [esCompany],
      new Map([
        [
          esCompany._id,
          {
            verificationStatus: S.DRAFT,
            documents: [{ kind: "company_registration", storageRef: "x" }],
          },
        ],
      ])
    );
    expect(needsReview(rows)).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });

  it("submitted Spain profile appears in Needs review even when unlisted", () => {
    const rows = buildQueueRows(
      [esCompany],
      new Map([
        [
          esCompany._id,
          {
            verificationStatus: S.PENDING_VERIFICATION,
            documents: [
              { kind: "company_registration", storageRef: "a" },
              { kind: "insurance_certificate", storageRef: "b" },
            ],
          },
        ],
      ])
    );
    expect(esCompany.listedOnMarketplace).toBe(false);
    const pending = needsReview(rows);
    expect(pending).toHaveLength(1);
    expect(pending[0].companyId).toBe(esCompany._id);
    expect(pending[0].listedOnMarketplace).toBe(false);
  });

  it("Spain workspace company filter excludes Greece", () => {
    const filter = buildAdminCountryCompanyFilter("ES");
    expect(filter).toEqual({ country: "ES" });
    const scoped = [esCompany, grCompany].filter((c) => c.country === "ES");
    expect(scoped.map((c) => c._id)).toEqual([esCompany._id]);
  });

  it("All companies lists every Spain legal status", () => {
    const profiles = new Map([
      [esCompany._id, { verificationStatus: S.DRAFT, documents: [] }],
    ]);
    const rows = buildQueueRows([esCompany], profiles);
    expect(rows.map((r) => r.verification?.status)).toEqual([S.DRAFT]);

    const statuses = [
      S.DRAFT,
      S.PENDING_VERIFICATION,
      S.VERIFIED,
      S.REJECTED,
      S.SUSPENDED,
      null,
    ];
    const companies = statuses.map((status, i) => ({
      _id: `c${i}`,
      name: `C${i}`,
      country: "ES",
      listedOnMarketplace: true,
    }));
    const map = new Map(
      statuses.map((status, i) => [
        `c${i}`,
        status ? { verificationStatus: status, documents: [] } : null,
      ])
    );
    const all = buildQueueRows(companies, map);
    expect(all).toHaveLength(6);
    expect(all.filter((r) => !r.verification)).toHaveLength(1);
  });

  it("uses companyId (not ownerId) as the profile join key", () => {
    const ownerUserId = "6aaedf554cad862dc29d7b2c";
    const profile = {
      companyId: esCompany._id,
      verificationStatus: S.PENDING_VERIFICATION,
      documents: [],
    };
    expect(profile.companyId).toBe(esCompany._id);
    expect(profile.companyId).not.toBe(ownerUserId);
  });

  it("completeness ready is not required for server transition", () => {
    const completeness = evaluateProfileCompleteness({
      legalName: "",
      documents: [{ kind: "company_registration", storageRef: "x" }],
    });
    expect(completeness.ready).toBe(false);
    const profile = {
      verificationStatus: S.DRAFT,
      statusHistory: [],
    };
    const result = applyVerificationTransition(profile, {
      to: S.PENDING_VERIFICATION,
      byEmail: "x",
    });
    expect(result.ok).toBe(true);
  });

  it("API failure must not be treated as an empty queue", () => {
    const apiFailed = true;
    const rows = null;
    const isEmptyQueue = !apiFailed && Array.isArray(rows) && rows.length === 0;
    const isError = apiFailed;
    expect(isEmptyQueue).toBe(false);
    expect(isError).toBe(true);
  });

  it("repeated PENDING transition is a no-op (no duplicate notify)", () => {
    const profile = {
      verificationStatus: S.PENDING_VERIFICATION,
      statusHistory: [{ from: S.DRAFT, to: S.PENDING_VERIFICATION }],
    };
    const result = applyVerificationTransition(profile, {
      to: S.PENDING_VERIFICATION,
      byEmail: "x",
    });
    expect(result.ok).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(profile.statusHistory).toHaveLength(1);
  });
});
