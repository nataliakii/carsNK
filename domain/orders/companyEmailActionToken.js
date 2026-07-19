/**
 * Signed tokens for company-email order actions (Accept / Reject / Message).
 * Uses NEXTAUTH_SECRET (or EMAIL_ACTION_SECRET). No session required to click.
 */

import crypto from "crypto";

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 14; // 14 days

function getSecret() {
  const secret = String(
    process.env.EMAIL_ACTION_SECRET || process.env.NEXTAUTH_SECRET || ""
  ).trim();
  if (!secret) {
    throw new Error("EMAIL_ACTION_SECRET or NEXTAUTH_SECRET is required");
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

/**
 * @param {{ orderId: string, action: 'accept'|'reject'|'message', exp?: number }} payload
 * @param {{ ttlSec?: number }} [opts]
 * @returns {string}
 */
export function signCompanyEmailActionToken(payload, opts = {}) {
  const orderId = String(payload?.orderId || "").trim();
  const action = String(payload?.action || "").trim();
  if (!orderId || !["accept", "reject", "message"].includes(action)) {
    throw new Error("Invalid company email action payload");
  }
  const ttlSec = Number(opts.ttlSec) > 0 ? Number(opts.ttlSec) : DEFAULT_TTL_SEC;
  const body = {
    orderId,
    action,
    exp: payload.exp || Math.floor(Date.now() / 1000) + ttlSec,
  };
  const data = b64url(JSON.stringify(body));
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${sig}`;
}

/**
 * @param {string} token
 * @returns {{ ok: true, orderId: string, action: string, exp: number } | { ok: false, message: string }}
 */
export function verifyCompanyEmailActionToken(token) {
  try {
    const raw = String(token || "").trim();
    const [data, sig] = raw.split(".");
    if (!data || !sig) return { ok: false, message: "Invalid token" };

    const expected = crypto
      .createHmac("sha256", getSecret())
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, message: "Invalid signature" };
    }

    const body = JSON.parse(fromB64url(data));
    const orderId = String(body?.orderId || "").trim();
    const action = String(body?.action || "").trim();
    const exp = Number(body?.exp);
    if (!orderId || !["accept", "reject", "message"].includes(action)) {
      return { ok: false, message: "Invalid token payload" };
    }
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, message: "Token expired" };
    }
    return { ok: true, orderId, action, exp };
  } catch (err) {
    return { ok: false, message: err?.message || "Token verify failed" };
  }
}
