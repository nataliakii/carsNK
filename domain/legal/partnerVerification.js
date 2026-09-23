/**
 * Partner (supplier) verification state machine.
 *
 * A partner may not trade on the platform until VERIFIED. `canOperate` is the
 * single predicate the rest of the application should use — never compare the
 * raw status string in call sites.
 */

export const PARTNER_VERIFICATION_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  VERIFIED: "VERIFIED",
  SUSPENDED: "SUSPENDED",
  REJECTED: "REJECTED",
});

export const ALL_PARTNER_VERIFICATION_STATUSES = Object.freeze(
  Object.values(PARTNER_VERIFICATION_STATUS)
);

const S = PARTNER_VERIFICATION_STATUS;

/** Allowed transitions. Anything not listed is rejected. */
export const PARTNER_VERIFICATION_TRANSITIONS = Object.freeze({
  [S.DRAFT]: [S.PENDING_VERIFICATION, S.REJECTED],
  [S.PENDING_VERIFICATION]: [S.VERIFIED, S.REJECTED, S.DRAFT],
  [S.VERIFIED]: [S.SUSPENDED, S.REJECTED],
  [S.SUSPENDED]: [S.VERIFIED, S.REJECTED],
  [S.REJECTED]: [S.DRAFT],
});

export function canTransitionVerification(from, to) {
  const allowed = PARTNER_VERIFICATION_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** Only a verified partner may take commercial bookings. */
export function canPartnerOperate(status) {
  return status === S.VERIFIED;
}

/**
 * The only field that blocks "submit for verification".
 *
 * Creating a company (Companies → New company) does not collect KYB at all.
 * The legal profile is a later step, and almost everything on it is optional so
 * onboarding stays light. Superadmin can still verify from whatever was sent.
 */
export const REQUIRED_PROFILE_FIELDS = Object.freeze(["legalName"]);

/** Confirmations are optional — they help the reviewer, they do not block. */
export const REQUIRED_PROFILE_CONFIRMATIONS = Object.freeze([]);

/** Evidence is optional at submit. Superadmin asks for more if needed. */
export const REQUIRED_PROFILE_DOCUMENTS = Object.freeze([]);

/** Shown as "helps review" in the superadmin queue, never as a hard gate. */
export const RECOMMENDED_PROFILE_FIELDS = Object.freeze([
  "nifCif",
  "registrationNumber",
  "signatoryName",
  "businessEmail",
  "registeredAddress",
  "insuranceProvider",
]);

export const RECOMMENDED_PROFILE_DOCUMENTS = Object.freeze([
  "company_registration",
  "insurance_certificate",
]);

/**
 * @param {object|null} profile PartnerLegalProfile (lean or doc)
 * @returns {{
 *   ready: boolean,
 *   missingFields: string[],
 *   missingConfirmations: string[],
 *   missingDocuments: string[],
 *   missingRecommendedFields: string[],
 *   missingRecommendedDocuments: string[],
 * }}
 */
export function evaluateProfileCompleteness(profile) {
  const p = profile || {};
  const missingFields = REQUIRED_PROFILE_FIELDS.filter(
    (key) => !String(p[key] || "").trim()
  );
  const missingConfirmations = REQUIRED_PROFILE_CONFIRMATIONS.filter(
    (key) => !p[key]
  );
  const present = new Set(
    (p.documents || [])
      .filter((doc) => doc && doc.storageRef)
      .map((doc) => doc.kind)
  );
  const missingDocuments = REQUIRED_PROFILE_DOCUMENTS.filter(
    (kind) => !present.has(kind)
  );

  const missingRecommendedFields = RECOMMENDED_PROFILE_FIELDS.filter(
    (key) => !String(p[key] || "").trim()
  );
  const missingRecommendedDocuments = RECOMMENDED_PROFILE_DOCUMENTS.filter(
    (kind) => !present.has(kind)
  );

  return {
    ready:
      missingFields.length === 0 &&
      missingConfirmations.length === 0 &&
      missingDocuments.length === 0,
    missingFields,
    missingConfirmations,
    missingDocuments,
    missingRecommendedFields,
    missingRecommendedDocuments,
  };
}

/**
 * Apply a status change with validation and an appended history entry.
 * Mutates and returns the given profile document.
 *
 * @param {object} profile mongoose document
 * @param {{ to: string, byEmail?: string, reason?: string }} params
 */
export function applyVerificationTransition(profile, { to, byEmail = "", reason = "" }) {
  const from = profile.verificationStatus || S.DRAFT;
  if (!ALL_PARTNER_VERIFICATION_STATUSES.includes(to)) {
    return { ok: false, code: "unknown_status", message: `Unknown status ${to}` };
  }
  if (from === to) {
    return { ok: true, unchanged: true, profile };
  }
  if (!canTransitionVerification(from, to)) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `Cannot move partner verification from ${from} to ${to}`,
    };
  }
  // Superadmin may verify a thin profile: the partner is not forced to
  // upload every paper before Rovaro can accept them.

  profile.verificationStatus = to;
  profile.verificationStatusAt = new Date();
  if (to === S.VERIFIED) {
    profile.verifiedByEmail = byEmail;
    profile.suspensionReason = "";
    profile.rejectionReason = "";
  }
  if (to === S.SUSPENDED) profile.suspensionReason = reason;
  if (to === S.REJECTED) profile.rejectionReason = reason;

  profile.statusHistory = [
    ...(profile.statusHistory || []),
    { from, to, at: new Date(), byEmail, reason },
  ];

  return { ok: true, unchanged: false, from, to, profile };
}
