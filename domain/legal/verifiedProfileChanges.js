import { PARTNER_VERIFICATION_STATUS } from "./partnerVerification";

/** Contact updates that must not stop a verified company from trading. */
export const CONTACT_PROFILE_FIELDS = Object.freeze([
  "businessEmail",
  "businessPhone",
  "emergencyPhone",
]);

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
    if (CONTACT_PROFILE_FIELDS.includes(key)) contact[key] = value;
    else material[key] = value;
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
