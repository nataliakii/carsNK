import { PARTNER_VERIFICATION_STATUS as S } from "@/domain/legal/partnerVerification";
import {
  evaluatePartnerOperatingGate,
  PARTNER_GATE_BLOCKER,
  PARTNER_GATE_STEP,
} from "@/domain/legal/partnerGate";

const CURRENT = "checksum-v2";

function codes(result) {
  return result.blockers.map((b) => b.code);
}

describe("partner operating gate", () => {
  it("opens only when the partner is verified and has signed the current package", () => {
    const result = evaluatePartnerOperatingGate({
      profile: { verificationStatus: S.VERIFIED },
      completeness: { ready: true },
      activeAgreement: { packageChecksum: CURRENT },
      currentPackageChecksum: CURRENT,
    });

    expect(result.canOperate).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("reports both blockers for a partner that has done nothing", () => {
    const result = evaluatePartnerOperatingGate({
      profile: null,
      completeness: null,
      activeAgreement: null,
      currentPackageChecksum: CURRENT,
    });

    expect(result.canOperate).toBe(false);
    expect(codes(result)).toEqual([
      PARTNER_GATE_BLOCKER.NO_PROFILE,
      PARTNER_GATE_BLOCKER.AGREEMENT_NOT_SIGNED,
    ]);
  });

  it("distinguishes an incomplete draft from one waiting on Rovaro", () => {
    const incomplete = evaluatePartnerOperatingGate({
      profile: { verificationStatus: S.DRAFT },
      completeness: { ready: false },
      activeAgreement: null,
    });
    expect(codes(incomplete)).toContain(PARTNER_GATE_BLOCKER.PROFILE_INCOMPLETE);
    expect(incomplete.blockers[0].step).toBe(PARTNER_GATE_STEP.PROFILE);

    const submitted = evaluatePartnerOperatingGate({
      profile: { verificationStatus: S.PENDING_VERIFICATION },
      completeness: { ready: true },
      activeAgreement: null,
    });
    expect(codes(submitted)).toContain(
      PARTNER_GATE_BLOCKER.AWAITING_VERIFICATION
    );
    expect(submitted.blockers[0].step).toBe(PARTNER_GATE_STEP.OPERATOR);
  });

  it("points a rejected partner back at the profile and a suspended one at Rovaro", () => {
    const rejected = evaluatePartnerOperatingGate({
      profile: { verificationStatus: S.REJECTED },
      completeness: { ready: true },
      activeAgreement: { packageChecksum: CURRENT },
      currentPackageChecksum: CURRENT,
    });
    expect(codes(rejected)).toEqual([PARTNER_GATE_BLOCKER.REJECTED]);
    expect(rejected.blockers[0].step).toBe(PARTNER_GATE_STEP.PROFILE);

    const suspended = evaluatePartnerOperatingGate({
      profile: { verificationStatus: S.SUSPENDED },
      completeness: { ready: true },
      activeAgreement: { packageChecksum: CURRENT },
      currentPackageChecksum: CURRENT,
    });
    expect(codes(suspended)).toEqual([PARTNER_GATE_BLOCKER.SUSPENDED]);
    expect(suspended.blockers[0].step).toBe(PARTNER_GATE_STEP.OPERATOR);
  });

  it("closes the gate again when a new version of the package is published", () => {
    const result = evaluatePartnerOperatingGate({
      profile: { verificationStatus: S.VERIFIED },
      completeness: { ready: true },
      activeAgreement: { packageChecksum: "checksum-v1" },
      currentPackageChecksum: CURRENT,
    });

    expect(result.agreementSigned).toBe(true);
    expect(result.agreementOutdated).toBe(true);
    expect(result.canOperate).toBe(false);
    expect(codes(result)).toEqual([PARTNER_GATE_BLOCKER.AGREEMENT_OUTDATED]);
  });

  it("does not invent an outdated agreement when the current checksum is unknown", () => {
    const result = evaluatePartnerOperatingGate({
      profile: { verificationStatus: S.VERIFIED },
      completeness: { ready: true },
      activeAgreement: { packageChecksum: "checksum-v1" },
      currentPackageChecksum: "",
    });

    expect(result.agreementOutdated).toBe(false);
    expect(result.canOperate).toBe(true);
  });
});
