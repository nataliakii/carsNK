/**
 * @jest-environment node
 *
 * Spain marketplace operating gate. No live Stripe, mail, or Mongo writes.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@models/PartnerLegalProfile", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), find: jest.fn() },
}));
jest.mock("@models/PartnerAgreementAcceptance", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock("@/domain/legal/agreementService", () => ({
  getActiveAgreement: jest.fn(),
  getCurrentPackageChecksum: jest.fn(),
  resolveCurrentPartnerPackage: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));

import { PARTNER_VERIFICATION_STATUS as S } from "@/domain/legal/partnerVerification";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import {
  getActiveAgreement,
  getCurrentPackageChecksum,
  resolveCurrentPartnerPackage,
} from "@/domain/legal/agreementService";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import {
  PARTNER_OPERATION_ERROR,
  PARTNER_OPERATION_REASON,
  PARTNER_OPERATION_PURPOSE,
  assertPartnerCanOperate,
  auditPartnerComplianceBlock,
  customerUnavailableJson,
  defaultListedOnMarketplaceForCountry,
  evaluateMarketplaceOperatingState,
  filterMarketplaceOperationalCompanies,
  isGreeceLegacyCompany,
  isMarketplaceOperatingCompany,
  isPublicMarketplaceCarAllowed,
  mapGateToOperationDenial,
  ownerIdsHiddenFromPublicMarketplace,
  partnerComplianceJson,
} from "../partnerOperatingPolicy";
import { evaluatePartnerOperatingGate } from "../partnerGate";

const CURRENT = "pkg-current";
const ES_ID = "64b7f2c3a1b2c3d4e5f60711";
const GR_ID = "64b7f2c3a1b2c3d4e5f60722";
const ES_B_ID = "64b7f2c3a1b2c3d4e5f60733";

function spainCompany(overrides = {}) {
  return {
    _id: ES_ID,
    country: "ES",
    listedOnMarketplace: true,
    ...overrides,
  };
}

function greeceCompany(overrides = {}) {
  return {
    _id: GR_ID,
    country: "GR",
    listedOnMarketplace: true,
    ...overrides,
  };
}

function verifiedProfile(overrides = {}) {
  return { companyId: ES_ID, verificationStatus: S.VERIFIED, ...overrides };
}

function currentAgreement(overrides = {}) {
  return { packageChecksum: CURRENT, ...overrides };
}

describe("company listing defaults", () => {
  test("new Spain companies stay off the public hub", () => {
    expect(defaultListedOnMarketplaceForCountry("ES")).toBe(false);
    expect(defaultListedOnMarketplaceForCountry("es")).toBe(false);
  });

  test("Greece legacy companies still default to listed", () => {
    expect(defaultListedOnMarketplaceForCountry("GR")).toBe(true);
    expect(defaultListedOnMarketplaceForCountry("")).toBe(true);
  });
});

describe("evaluateMarketplaceOperatingState", () => {
  test("1. no profile → cannot be publicly listed", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: null,
      activeAgreement: null,
      currentPackageChecksum: CURRENT,
      requireListed: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe(PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED);
    expect(result.code).toBe(PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED);
    expect(JSON.stringify(result)).not.toMatch(/nifCif|storageRef|reviewNote/i);
  });

  test("2. PENDING_VERIFICATION → hidden from public search", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: { verificationStatus: S.PENDING_VERIFICATION },
      activeAgreement: currentAgreement(),
      currentPackageChecksum: CURRENT,
      requireListed: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe(PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED);
    expect(result.code).toBe(PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED);
  });

  test("3. VERIFIED but no agreement → cannot operate", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: verifiedProfile(),
      activeAgreement: null,
      currentPackageChecksum: CURRENT,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(PARTNER_OPERATION_REASON.AGREEMENT_MISSING);
  });

  test("4. VERIFIED + current agreement → allowed", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: verifiedProfile(),
      completeness: { ready: true },
      activeAgreement: currentAgreement(),
      currentPackageChecksum: CURRENT,
      requireListed: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.packageChecksumMatch).toBe(true);
    expect(result.verificationStatus).toBe(S.VERIFIED);
  });

  test("5. outdated package checksum → blocked", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: verifiedProfile(),
      activeAgreement: { packageChecksum: "pkg-old" },
      currentPackageChecksum: CURRENT,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(PARTNER_OPERATION_REASON.AGREEMENT_OUTDATED);
  });

  test("6. SUSPENDED → cars hidden and new commercial actions blocked", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: { verificationStatus: S.SUSPENDED },
      activeAgreement: currentAgreement(),
      currentPackageChecksum: CURRENT,
      requireListed: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe(PARTNER_OPERATION_ERROR.SUSPENDED);
    expect(result.code).toBe(PARTNER_OPERATION_ERROR.SUSPENDED);
  });

  test("REJECTED maps to PARTNER_REJECTED without leaking review notes", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: {
        verificationStatus: S.REJECTED,
        reviewNote: "failed KYB, NIF mismatch",
      },
      activeAgreement: currentAgreement(),
      currentPackageChecksum: CURRENT,
    });
    expect(result.code).toBe(PARTNER_OPERATION_REASON.PARTNER_REJECTED);
    expect(JSON.stringify(partnerComplianceJson(result))).not.toMatch(
      /KYB|NIF|reviewNote/i
    );
  });

  test("8. booking creation fails closed when the partner is not compliant", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: { verificationStatus: S.DRAFT },
      activeAgreement: null,
      currentPackageChecksum: CURRENT,
      requireListed: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe(PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED);
  });

  test("listedOnMarketplace false blocks public listing even when verified", () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany({ listedOnMarketplace: false }),
      profile: verifiedProfile(),
      activeAgreement: currentAgreement(),
      currentPackageChecksum: CURRENT,
      requireListed: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(PARTNER_OPERATION_REASON.MARKETPLACE_DISABLED);
  });

  test("14. Greece legacy rental companies skip the Spain gate", () => {
    const result = evaluateMarketplaceOperatingState({
      company: greeceCompany(),
      profile: null,
      activeAgreement: null,
      currentPackageChecksum: CURRENT,
      requireListed: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(isGreeceLegacyCompany(greeceCompany())).toBe(true);
    expect(isMarketplaceOperatingCompany(greeceCompany())).toBe(false);
  });

  test("15. transfer-style / non-marketplace companies are not gated", () => {
    expect(
      isMarketplaceOperatingCompany({
        country: "GR",
        bookingMode: "OPS_CALENDAR",
      })
    ).toBe(false);
    expect(isMarketplaceOperatingCompany(null)).toBe(false);
  });
});

describe("public JSON and audit payloads", () => {
  test("17. public and partner JSON contain no KYB or document fields", () => {
    const denied = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: {
        verificationStatus: S.DRAFT,
        legalName: "Secret SL",
        nifCif: "B123",
        registeredAddress: "Calle Falsa 1",
        documents: [{ kind: "passport", storageRef: "private/ref" }],
      },
      activeAgreement: null,
      currentPackageChecksum: CURRENT,
    });
    const partner = partnerComplianceJson(denied);
    const customer = customerUnavailableJson();
    expect(partner.error).toBe(PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED);
    expect(partner.code).toBe(PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED);
    expect(JSON.stringify(partner)).not.toMatch(
      /Secret SL|B123|Calle Falsa|passport|storageRef/
    );
    expect(customer.message).toBe("This vehicle is not available.");
    expect(JSON.stringify(customer)).not.toMatch(
      /PARTNER_COMPLIANCE|PROFILE_NOT_VERIFIED|verification/i
    );
  });
});

describe("assertPartnerCanOperate override", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentPackageChecksum.mockResolvedValue(CURRENT);
    getActiveAgreement.mockResolvedValue(currentAgreement());
    resolveCurrentPartnerPackage.mockImplementation(
      async ({ latestAcceptance } = {}) => {
        const acceptance =
          latestAcceptance === undefined
            ? await getActiveAgreement(ES_ID)
            : latestAcceptance;
        return {
          packageChecksum: CURRENT,
          latestAcceptance: acceptance,
          legalState: {
            state: acceptance ? "ACCEPTED_CURRENT" : "ACCEPTANCE_REQUIRED",
            legalActionCount: acceptance ? 0 : 1,
          },
        };
      }
    );
    PartnerLegalProfile.findOne.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            companyId: ES_ID,
            verificationStatus: S.SUSPENDED,
          }),
      }),
    });
  });

  test("13. superadmin override requires a reason and writes AuditLog", async () => {
    const blocked = await assertPartnerCanOperate(ES_ID, {
      company: spainCompany(),
      purpose: PARTNER_OPERATION_PURPOSE.REISSUE,
      overrideByRole: "superadmin",
      overrideReason: "",
    });
    expect(blocked.allowed).toBe(false);
    expect(recordAuditEvent).not.toHaveBeenCalled();

    const recovered = await assertPartnerCanOperate(ES_ID, {
      company: spainCompany(),
      purpose: PARTNER_OPERATION_PURPOSE.REISSUE,
      overrideByRole: "superadmin",
      overrideByEmail: "root@rovaro.autos",
      overrideReason: "Recover unpaid hold after partner suspension",
      audit: { orderId: "order-1", ipAddress: "1.1.1.1", userAgent: "jest" },
    });
    expect(recovered.allowed).toBe(true);
    expect(recovered.overridden).toBe(true);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PARTNER_COMPLIANCE_OVERRIDE",
        userRole: "superadmin",
        userEmail: "root@rovaro.autos",
        reason: expect.stringMatching(/Recover unpaid hold/),
        ipAddress: "1.1.1.1",
        metadata: expect.objectContaining({
          purpose: PARTNER_OPERATION_PURPOSE.REISSUE,
          companyId: ES_ID,
        }),
      })
    );
    const meta = recordAuditEvent.mock.calls[0][0];
    expect(JSON.stringify(meta)).not.toMatch(
      /nifCif|storageRef|registeredAddress|legalName/i
    );
  });

  test("role alone cannot silently bypass public listing", async () => {
    const result = await assertPartnerCanOperate(ES_ID, {
      company: spainCompany(),
      purpose: PARTNER_OPERATION_PURPOSE.LISTING,
      requireListed: true,
      overrideByRole: "superadmin",
      overrideReason: "please list anyway",
    });
    expect(result.allowed).toBe(false);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("ownerIdsHiddenFromPublicMarketplace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentPackageChecksum.mockResolvedValue(CURRENT);
    PartnerLegalProfile.find.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { companyId: ES_ID, verificationStatus: S.PENDING_VERIFICATION },
            {
              companyId: ES_B_ID,
              verificationStatus: S.VERIFIED,
            },
          ]),
      }),
    });
    PartnerAgreementAcceptance.find.mockReturnValue({
      sort: () => ({
        select: () => ({
          lean: () =>
            Promise.resolve([{ companyId: ES_B_ID, packageChecksum: CURRENT }]),
        }),
      }),
    });
    resolveCurrentPartnerPackage.mockImplementation(
      async ({ latestAcceptance } = {}) => ({
        packageChecksum: CURRENT,
        latestAcceptance,
        legalState: {
          state: latestAcceptance ? "ACCEPTED_CURRENT" : "ACCEPTANCE_REQUIRED",
          legalActionCount: latestAcceptance ? 0 : 1,
        },
      })
    );
  });

  test("hides non-compliant Spain fleets without dropping Greece or a verified neighbour", async () => {
    const hide = await ownerIdsHiddenFromPublicMarketplace([
      spainCompany(),
      greeceCompany(),
      spainCompany({ _id: ES_B_ID }),
    ]);
    const ids = hide.map((id) => String(id));
    expect(ids).toContain(ES_ID);
    expect(ids).not.toContain(GR_ID);
    expect(ids).not.toContain(ES_B_ID);
  });

  test("16. one non-compliant company does not hide another company's cars", async () => {
    const hide = await ownerIdsHiddenFromPublicMarketplace([
      spainCompany(),
      spainCompany({ _id: ES_B_ID }),
    ]);
    expect(hide.map(String)).toEqual([ES_ID]);
  });

  test("fails closed for marketplace fleets when the canonical package cannot be loaded", async () => {
    resolveCurrentPartnerPackage.mockRejectedValue(new Error("package down"));
    const hide = await ownerIdsHiddenFromPublicMarketplace([
      spainCompany(),
      greeceCompany(),
    ]);
    expect(hide.map(String)).toContain(ES_ID);
    expect(hide.map(String)).not.toContain(GR_ID);
  });

  test("filterMarketplaceOperationalCompanies keeps operational partners", async () => {
    const kept = await filterMarketplaceOperationalCompanies([
      spainCompany(),
      spainCompany({ _id: ES_B_ID }),
      greeceCompany(),
    ]);
    expect(kept.map((c) => String(c._id))).toEqual([ES_B_ID, GR_ID]);
  });
});

describe("isPublicMarketplaceCarAllowed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentPackageChecksum.mockResolvedValue(CURRENT);
    getActiveAgreement.mockResolvedValue(null);
    PartnerLegalProfile.findOne.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            companyId: ES_ID,
            verificationStatus: S.PENDING_VERIFICATION,
          }),
      }),
    });
  });

  test("7. hidden marketplace cars are not publicly readable", async () => {
    expect(
      await isPublicMarketplaceCarAllowed({
        car: { isActive: true, ownerId: ES_ID },
        company: spainCompany({ listedOnMarketplace: false }),
      })
    ).toBe(false);

    expect(
      await isPublicMarketplaceCarAllowed({
        car: { isActive: true, ownerId: ES_ID },
        company: spainCompany(),
      })
    ).toBe(false);
  });

  test("inactive cars skip the public marketplace surface", async () => {
    const allowed = await isPublicMarketplaceCarAllowed({
      car: { isActive: false, ownerId: ES_ID },
      company: spainCompany({
        listedOnMarketplace: true,
      }),
    });
    expect(allowed).toBe(false);
  });
});

describe("auditPartnerComplianceBlock", () => {
  test("writes a block event without flooding or attaching documents", async () => {
    const result = evaluateMarketplaceOperatingState({
      company: spainCompany(),
      profile: { verificationStatus: S.SUSPENDED },
      activeAgreement: currentAgreement(),
      currentPackageChecksum: CURRENT,
    });
    await auditPartnerComplianceBlock({
      purpose: PARTNER_OPERATION_PURPOSE.CAR_PUBLISH,
      result,
      actorEmail: "admin@partner.test",
      actorRole: "admin",
      ipAddress: "8.8.8.8",
      userAgent: "jest",
      carId: "car-1",
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PARTNER_COMPLIANCE_BLOCKED",
        metadata: expect.objectContaining({
          purpose: PARTNER_OPERATION_PURPOSE.CAR_PUBLISH,
          carId: "car-1",
          companyId: ES_ID,
        }),
      })
    );
  });

  test("does not audit allowed or skipped results", async () => {
    recordAuditEvent.mockClear();
    await auditPartnerComplianceBlock({
      purpose: PARTNER_OPERATION_PURPOSE.LISTING,
      result: { allowed: true },
    });
    await auditPartnerComplianceBlock({
      purpose: PARTNER_OPERATION_PURPOSE.LISTING,
      result: { allowed: true, skipped: true },
    });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("mapGateToOperationDenial", () => {
  test("prefers profile status over a missing agreement", () => {
    const gate = evaluatePartnerOperatingGate({
      profile: null,
      completeness: null,
      activeAgreement: null,
      currentPackageChecksum: CURRENT,
    });
    expect(mapGateToOperationDenial(gate).code).toBe(
      PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED
    );
  });
});
