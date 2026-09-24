import { PARTNER_VERIFICATION_STATUS } from "./partnerVerification";

/**
 * Non-material fields. Reaching a company is not a legal identity claim, so
 * these apply straight away and never re-open verification.
 */
export const NON_MATERIAL_PROFILE_FIELDS = Object.freeze([
  "businessEmail",
  "businessPhone",
  "emergencyPhone",
  "businessAddress",
  "notificationLanguage",
]);

/** Older name for the same list. */
export const CONTACT_PROFILE_FIELDS = NON_MATERIAL_PROFILE_FIELDS;

/**
 * Material fields. These are the identity, authority and insurance claims
 * Rovaro verified, so a change to any of them is reviewed before it replaces
 * the verified value.
 */
export const MATERIAL_PROFILE_FIELDS = Object.freeze([
  "legalName",
  "tradingName",
  "entityType",
  "countryOfRegistration",
  "registrationNumber",
  "nifCif",
  "vatNumber",
  "registeredAddress",
  "signatoryName",
  "signatoryRole",
  "signatoryAuthorityBasis",
  "signatoryAuthorityConfirmed",
  "vehicleAuthorityConfirmed",
  "payoutAccountReference",
  "insuranceProvider",
  "insurancePolicyReference",
  "insuranceValidUntil",
  "licences",
]);

/** Anything not explicitly non-material is treated as material. */
export function isMaterialProfileField(field) {
  return !NON_MATERIAL_PROFILE_FIELDS.includes(field);
}

export function sameProfileValue(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left || []) === JSON.stringify(right || []);
  }
  if (left instanceof Date || right instanceof Date) {
    const a = left ? new Date(left).toISOString() : "";
    const b = right ? new Date(right).toISOString() : "";
    return a === b;
  }
  return String(left ?? "") === String(right ?? "");
}

/**
 * Split a verified-profile save. Contact fields apply immediately.
 * Material legal fields are stored as pending and do not replace the
 * verified values or change verification status.
 */
export function planVerifiedProfileSave(profile, patch = {}) {
  const status = profile?.verificationStatus || PARTNER_VERIFICATION_STATUS.DRAFT;
  const contact = {};
  const material = {};
  for (const [key, value] of Object.entries(patch)) {
    if (sameProfileValue(profile?.[key], value)) continue;
    if (isMaterialProfileField(key)) material[key] = value;
    else contact[key] = value;
  }
  const verified = status === PARTNER_VERIFICATION_STATUS.VERIFIED;
  return {
    applyNow: verified ? contact : { ...contact, ...material },
    pending: verified && Object.keys(material).length ? material : null,
    verificationStatus: status,
    suspend: false,
  };
}

/** Copy approved pending fields onto the live verified profile. */
export function applyPendingProfileChanges(profile) {
  const pending = profile?.pendingChanges?.fields;
  if (!pending || typeof pending !== "object") return { applied: [] };
  const applied = [];
  for (const [key, value] of Object.entries(pending)) {
    profile[key] = value;
    applied.push(key);
  }
  profile.pendingChanges = { fields: null, submittedAt: null, submittedByEmail: "" };
  return { applied };
}

/** Drop the proposal. The verified profile was never touched, so nothing else changes. */
export function discardPendingProfileChanges(profile) {
  const discarded = Object.keys(profile?.pendingChanges?.fields || {});
  if (profile) {
    profile.pendingChanges = {
      fields: null,
      submittedAt: null,
      submittedByEmail: "",
    };
  }
  return { discarded };
}

/**
 * The changed fields only — what a reviewer has to look at. The verified
 * value stays alongside the proposal so nothing is reviewed out of context.
 */
export function pendingProfileChangeSummary(profile) {
  const pending = profile?.pendingChanges?.fields;
  if (!pending || typeof pending !== "object") return [];
  return Object.entries(pending)
    .filter(([field, value]) => !sameProfileValue(profile?.[field], value))
    .map(([field, value]) => ({
      field,
      verified: profile?.[field] ?? "",
      proposed: value,
      material: isMaterialProfileField(field),
    }));
}
