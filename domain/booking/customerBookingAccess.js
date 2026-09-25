/**
 * Opaque customer booking-page credential.
 *
 * The raw token is returned once to the caller that sends the email.
 * Only its SHA-256 hash is stored. Scope is customer_booking_read.
 * Comparison is constant-time. The raw token is never logged here.
 */

import crypto from "crypto";

export const CUSTOMER_BOOKING_READ_SCOPE = "customer_booking_read";

const DEFAULT_LIFETIME_MS = 1000 * 60 * 60 * 24 * 400;
const INVALID_ATTEMPT_LIMIT = 8;
const INVALID_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const invalidAttempts = new Map();

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function hashesEqual(leftHex, rightHex) {
  const left = Buffer.from(String(leftHex || ""), "hex");
  const right = Buffer.from(String(rightHex || ""), "hex");
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    const dummy = Buffer.alloc(32);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function defaultExpiry(returnAt, now) {
  const base = returnAt ? new Date(returnAt).getTime() : now.getTime();
  const fromReturn = Number.isFinite(base) ? base + DEFAULT_LIFETIME_MS : now.getTime() + DEFAULT_LIFETIME_MS;
  const minimum = now.getTime() + DEFAULT_LIFETIME_MS;
  return new Date(Math.max(fromReturn, minimum));
}

export function createCustomerBookingAccess({ returnAt = null, now = new Date() } = {}) {
  const token = crypto.randomBytes(32).toString("base64url");
  const access = {
    tokenHash: sha256(token),
    scope: CUSTOMER_BOOKING_READ_SCOPE,
    issuedAt: now,
    expiresAt: defaultExpiry(returnAt, now),
    revokedAt: null,
    version: 1,
    revokedTokenHashes: [],
  };
  return { token, access };
}

export function rotateCustomerBookingAccess(access, { returnAt = null, now = new Date() } = {}) {
  const next = createCustomerBookingAccess({ returnAt, now });
  const previous = Array.isArray(access?.revokedTokenHashes)
    ? access.revokedTokenHashes
    : [];
  return {
    token: next.token,
    access: {
      ...next.access,
      version: Number(access?.version || 1) + 1,
      revokedTokenHashes: access?.tokenHash
        ? [...previous, { tokenHash: access.tokenHash, revokedAt: now }]
        : previous,
    },
  };
}

export function revokeCustomerBookingAccess(access, { now = new Date() } = {}) {
  const previous = Array.isArray(access?.revokedTokenHashes)
    ? access.revokedTokenHashes
    : [];
  return {
    ...access,
    revokedAt: now,
    revokedTokenHashes: access?.tokenHash
      ? [...previous, { tokenHash: access.tokenHash, revokedAt: now }]
      : previous,
  };
}

function hashListed(revokedTokenHashes, tokenHash) {
  const rows = Array.isArray(revokedTokenHashes) ? revokedTokenHashes : [];
  let matched = false;
  for (const row of rows) {
    if (hashesEqual(tokenHash, row?.tokenHash)) matched = true;
  }
  return matched;
}

/**
 * @returns {{ ok: true } | { ok: false }}
 * Failure is generic. Callers must not branch the customer message on the reason.
 */
export function verifyCustomerBookingAccess(access, token, { now = new Date() } = {}) {
  const presented = sha256(token || "");
  const stored = access?.tokenHash || sha256("customer-booking-read-dummy");
  const hashOk = hashesEqual(presented, stored);
  if (!access || access.scope !== CUSTOMER_BOOKING_READ_SCOPE) {
    return { ok: false };
  }
  if (access.revokedAt) return { ok: false };
  if (hashListed(access.revokedTokenHashes, presented)) return { ok: false };
  const expires = access.expiresAt ? new Date(access.expiresAt).getTime() : 0;
  if (!expires || expires <= now.getTime()) return { ok: false };
  if (!hashOk) return { ok: false };
  return { ok: true };
}

export function resetCustomerBookingAccessRateLimit() {
  invalidAttempts.clear();
}

/**
 * Count an invalid read. Returns limited: true when the window is exhausted.
 * The key must be IP + public reference, never the raw token.
 */
export function consumeInvalidBookingAccessAttempt(key, { now = Date.now() } = {}) {
  const id = String(key || "").trim();
  if (!id) return { limited: false, count: 0 };
  const current = invalidAttempts.get(id);
  if (!current || now - current.start > INVALID_ATTEMPT_WINDOW_MS) {
    invalidAttempts.set(id, { start: now, count: 1 });
    return { limited: false, count: 1 };
  }
  current.count += 1;
  return {
    limited: current.count > INVALID_ATTEMPT_LIMIT,
    count: current.count,
  };
}

export function bookingAccessAttemptLimited(key, { now = Date.now() } = {}) {
  const current = invalidAttempts.get(String(key || "").trim());
  if (!current || now - current.start > INVALID_ATTEMPT_WINDOW_MS) return false;
  return current.count > INVALID_ATTEMPT_LIMIT;
}

export function customerBookingAccessRateKey(ip, publicReference) {
  return `booking-access:${String(ip || "unknown")}:${String(publicReference || "")}`;
}
