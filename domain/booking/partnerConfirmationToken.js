/**
 * Signed one-time tokens for partner booking confirmation.
 *
 * Differences from the older company-email action token:
 *   - carries a `jti` so the token can be tracked and consumed exactly once
 *   - is bound to the order AND the owning company
 *   - has no fallback secret: if no secret is configured, signing and
 *     verification both fail loudly rather than silently using a weak key
 *
 * Opening the link (GET) is always read-only. Consumption happens only on
 * POST, in `partnerBookingConfirmation`.
 */

import crypto from "crypto";

export const CONFIRMATION_TOKEN_PURPOSE = "confirm_availability";

function getSecret() {
  const secret = String(
    process.env.BOOKING_CONFIRM_SECRET ||
      process.env.EMAIL_ACTION_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      ""
  ).trim();
  if (!secret) {
    throw new Error(
      "BOOKING_CONFIRM_SECRET, EMAIL_ACTION_SECRET or NEXTAUTH_SECRET must be set to issue booking confirmation links"
    );
  }
  return secret;
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = String(str).replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function hmac(data) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** SHA-256 of the raw token — the only form stored. */
export function hashConfirmationToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

/**
 * @param {{ orderId: string, companyId?: string|null, ttlHours?: number }} params
 * @returns {{ token: string, jti: string, expiresAt: Date, tokenHash: string }}
 */
export function signConfirmationToken({ orderId, companyId = null, ttlHours = 48 }) {
  const id = String(orderId || "").trim();
  if (!id) throw new Error("orderId is required");

  const ttl = Number(ttlHours) > 0 ? Number(ttlHours) : 48;
  const expSeconds = Math.floor(Date.now() / 1000) + ttl * 3600;
  const jti = crypto.randomBytes(16).toString("hex");

  const payload = {
    v: 1,
    p: CONFIRMATION_TOKEN_PURPOSE,
    o: id,
    c: companyId ? String(companyId) : "",
    jti,
    exp: expSeconds,
  };

  const data = b64url(JSON.stringify(payload));
  const token = `${data}.${hmac(data)}`;

  return {
    token,
    jti,
    expiresAt: new Date(expSeconds * 1000),
    tokenHash: hashConfirmationToken(token),
  };
}

/**
 * Signature + expiry check only. Says nothing about whether the token has
 * already been used — that is a database question answered on POST.
 *
 * @param {string} token
 * @returns {{ ok: true, orderId: string, companyId: string, jti: string, exp: number }
 *          | { ok: false, code: string, message: string, status: number }}
 */
export function verifyConfirmationToken(token) {
  let secretAvailable = true;
  try {
    getSecret();
  } catch {
    secretAvailable = false;
  }
  if (!secretAvailable) {
    return {
      ok: false,
      code: "no_secret",
      status: 500,
      message: "Confirmation links are not configured on this deployment",
    };
  }

  const raw = String(token || "").trim();
  const [data, sig] = raw.split(".");
  if (!data || !sig) {
    return { ok: false, code: "malformed", status: 400, message: "Invalid link" };
  }

  const expected = hmac(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, code: "bad_signature", status: 400, message: "Invalid link" };
  }

  let payload;
  try {
    payload = JSON.parse(fromB64url(data));
  } catch {
    return { ok: false, code: "malformed", status: 400, message: "Invalid link" };
  }

  if (payload?.p !== CONFIRMATION_TOKEN_PURPOSE) {
    return { ok: false, code: "wrong_purpose", status: 400, message: "Invalid link" };
  }
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return {
      ok: false,
      code: "expired",
      status: 410,
      message: "This confirmation link has expired. Ask Rovaro for a new one.",
    };
  }
  const orderId = String(payload?.o || "").trim();
  if (!orderId) {
    return { ok: false, code: "malformed", status: 400, message: "Invalid link" };
  }

  return {
    ok: true,
    orderId,
    companyId: String(payload?.c || ""),
    jti: String(payload?.jti || ""),
    exp,
  };
}
