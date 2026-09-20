import {
  PARTNER_VERIFICATION_STATUS as S,
  canTransitionVerification,
  canPartnerOperate,
  evaluateProfileCompleteness,
  applyVerificationTransition,
  REQUIRED_PROFILE_FIELDS,
  REQUIRED_PROFILE_DOCUMENTS,
} from "@/domain/legal/partnerVerification";

function completeProfile(overrides = {}) {
  const profile = {
    verificationStatus: S.PENDING_VERIFICATION,
    statusHistory: [],
    signatoryAuthorityConfirmed: true,
    vehicleAuthorityConfirmed: true,
    documents: REQUIRED_PROFILE_DOCUMENTS.map((kind) => ({
      kind,
      storageRef: `ref/${kind}`,
    })),
  };
  for (const field of REQUIRED_PROFILE_FIELDS) {
    profile[field] = `value-${field}`;
  }
  return { ...profile, ...overrides };
}

describe("verification state machine", () => {
  it("allows the onboarding path", () => {
    expect(canTransitionVerification(S.DRAFT, S.PENDING_VERIFICATION)).toBe(true);
    expect(canTransitionVerification(S.PENDING_VERIFICATION, S.VERIFIED)).toBe(true);
    expect(canTransitionVerification(S.VERIFIED, S.SUSPENDED)).toBe(true);
    expect(canTransitionVerification(S.SUSPENDED, S.VERIFIED)).toBe(true);
  });

  it("refuses to jump straight from draft to verified", () => {
    expect(canTransitionVerification(S.DRAFT, S.VERIFIED)).toBe(false);
  });

  it("only lets a verified partner trade", () => {
    expect(canPartnerOperate(S.VERIFIED)).toBe(true);
    for (const status of [S.DRAFT, S.PENDING_VERIFICATION, S.SUSPENDED, S.REJECTED]) {
      expect(canPartnerOperate(status)).toBe(false);
    }
  });
});

describe("profile completeness", () => {
  it("accepts a fully supplied profile", () => {
    expect(evaluateProfileCompleteness(completeProfile()).ready).toBe(true);
  });

  it("lists every missing identity field", () => {
    const result = evaluateProfileCompleteness({ documents: [] });
    expect(result.ready).toBe(false);
    expect(result.missingFields).toEqual(
      expect.arrayContaining(["legalName", "nifCif", "registrationNumber"])
    );
    expect(result.missingConfirmations).toEqual(
      expect.arrayContaining([
        "signatoryAuthorityConfirmed",
        "vehicleAuthorityConfirmed",
      ])
    );
    expect(result.missingDocuments).toEqual(
      expect.arrayContaining(REQUIRED_PROFILE_DOCUMENTS)
    );
  });

  it("ignores a document row with no stored file", () => {
    const profile = completeProfile({
      documents: [{ kind: "company_registration", storageRef: "" }],
    });
    expect(evaluateProfileCompleteness(profile).missingDocuments).toContain(
      "company_registration"
    );
  });
});

describe("applying a transition", () => {
  it("refuses to verify an incomplete partner", () => {
    const profile = { verificationStatus: S.PENDING_VERIFICATION, statusHistory: [] };
    const result = applyVerificationTransition(profile, { to: S.VERIFIED });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("incomplete_profile");
    expect(profile.verificationStatus).toBe(S.PENDING_VERIFICATION);
  });

  it("verifies a complete partner and records who did it", () => {
    const profile = completeProfile();
    const result = applyVerificationTransition(profile, {
      to: S.VERIFIED,
      byEmail: "super@rovaro.autos",
    });

    expect(result.ok).toBe(true);
    expect(profile.verificationStatus).toBe(S.VERIFIED);
    expect(profile.verifiedByEmail).toBe("super@rovaro.autos");
    expect(profile.statusHistory).toHaveLength(1);
    expect(profile.statusHistory[0]).toMatchObject({
      from: S.PENDING_VERIFICATION,
      to: S.VERIFIED,
      byEmail: "super@rovaro.autos",
    });
  });

  it("records the reason on suspension", () => {
    const profile = completeProfile({ verificationStatus: S.VERIFIED });
    applyVerificationTransition(profile, {
      to: S.SUSPENDED,
      reason: "Insurance certificate expired",
    });

    expect(profile.verificationStatus).toBe(S.SUSPENDED);
    expect(profile.suspensionReason).toBe("Insurance certificate expired");
  });

  it("lets a rejected partner reopen as a draft", () => {
    const profile = completeProfile({ verificationStatus: S.REJECTED });
    const result = applyVerificationTransition(profile, { to: S.DRAFT });

    expect(result.ok).toBe(true);
    expect(profile.verificationStatus).toBe(S.DRAFT);
  });

  it("refuses an illegal transition", () => {
    const profile = completeProfile({ verificationStatus: S.REJECTED });
    const result = applyVerificationTransition(profile, { to: S.VERIFIED });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid_transition");
  });

  it("refuses an unknown status", () => {
    const profile = completeProfile();
    expect(applyVerificationTransition(profile, { to: "APPROVED" }).code).toBe(
      "unknown_status"
    );
  });
});
