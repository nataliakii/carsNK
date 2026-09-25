/**
 * Client-safe public booking reference validation.
 *
 * No crypto RNG and no mongoose — safe for admin UI and pure domain modules.
 */

export const PUBLIC_REFERENCE_PREFIX = "RVR-";
export const PUBLIC_REFERENCE_LENGTH = 5;
/** Crockford-style alphabet without O/0 and I/1. */
export const PUBLIC_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const REFERENCE_RE = /^RVR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

export function isValidPublicBookingReference(value) {
  return REFERENCE_RE.test(String(value || "").trim());
}
