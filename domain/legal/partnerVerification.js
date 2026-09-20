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
 * Fields the supplier must supply before verification can be requested.
 * Mirrors the verification list in the Partner Agreement.
 */
export const REQUIRED_PROFILE_FIELDS = Object.freeze([
  "legalName",
  "entityType",
  "countryOfRegistration",
  "registrationNumber",
  "nifCif",
  "registeredAddress",
  "signatoryName",
  "signatoryRole",
  "businessEmail",
  "businessPhone",
  "insuranceProvider",
  "insurancePolicyReference",
]);

/** Boolean declarations that must be affirmatively confirmed. */
export const REQUIRED_PROFILE_CONFIRMATIONS = Object.freeze([
  "signatoryAuthorityConfirmed",
  "vehicleAuthorityConfirmed",
]);

/**
 * Supporting documents the supplier must upload. `vat` is conditional: a
 * Spanish supplier below the registration threshold may legitimately have no
 * VAT number, so it is recommended rather than required.
 */
export const REQUIRED_PROFILE_DOCUMENTS = Object.freeze([
  "company_registration",
  "insurance_certificate",
  "vehicle_authority",
]);

/**
 * @param {object|null} profile PartnerLegalProfile (lean or doc)
 * @returns {{
 *   ready: boolean,
 *   missingFields: string[],
 *   missingConfirmations: string[],
 *   missingDocuments: string[],
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

  return {
    ready:
      missingFields.length === 0 &&
      missingConfirmations.length === 0 &&
      missingDocuments.length === 0,
    missingFields,
    missingConfirmations,
    missingDocuments,
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
  if (to === S.VERIFIED) {
    const completeness = evaluateProfileCompleteness(profile);
    if (!completeness.ready) {
      return {
        ok: false,
        code: "incomplete_profile",
        message: "Partner profile is incomplete",
        completeness,
      };
    }
  }

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
