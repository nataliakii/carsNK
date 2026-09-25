/**
 * Short-lived grant for one driving licence document.
 *
 * The metadata endpoint hands this out in a JSON body after it has already
 * decided that the caller may read the document. The download endpoint then
 * re-runs the full authorisation from the session before serving a single byte:
 * the grant narrows *which* document and *for how long*, it never proves *who*
 * the caller is.
 *
 * That is why the grant travels in a request body and not in a URL — a link
 * carrying authorisation data would end up in browser history, referrers and
 * server logs, which the platform rules forbid.
 */

import crypto from "crypto";

/** A grant is valid for two minutes. Long enough to click, short enough to be useless later. */
export const DOWNLOAD_GRANT_TTL_SECONDS = 120;

const VERSION = "g1";

function grantSecret() {
  return String(
    process.env.DRIVING_LICENCE_RECEIPT_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      process.env.AUTH_SECRET ||
      ""
  );
}

export function downloadGrantSecretConfigured() {
  return grantSecret().length >= 16;
}

function sign(body) {
  return crypto
    .createHmac("sha256", grantSecret())
    .update(body, "utf8")
    .digest("base64url");
}

function equal(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    const dummy = Buffer.alloc(32);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * @param {{ orderId: string, storageReference: string, storageType?: string,
 *           resourceType?: string, now?: Date }} params
 * @returns {{ ok: true, grant: string, expiresAt: string, ttlSeconds: number }
 *          | { ok: false, code: string }}
 */
export function createDownloadGrant({
  orderId,
  storageReference,
  storageType = "authenticated",
  resourceType = "image",
  now = new Date(),
}) {
  if (!downloadGrantSecretConfigured()) {
    return { ok: false, code: "GRANT_SECRET_MISSING" };
  }
  if (!String(orderId || "").trim() || !String(storageReference || "").trim()) {
    return { ok: false, code: "GRANT_PAYLOAD_INVALID" };
  }
  const issuedAt = now instanceof Date ? now.getTime() : Number(now);
  const expSeconds = Math.floor(issuedAt / 1000) + DOWNLOAD_GRANT_TTL_SECONDS;
  const payload = {
    v: VERSION,
    oid: String(orderId),
    ref: String(storageReference),
    st: String(storageType),
    rt: String(resourceType),
    exp: expSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return {
    ok: true,
    grant: `${VERSION}.${body}.${sign(body)}`,
    expiresAt: new Date(expSeconds * 1000).toISOString(),
    ttlSeconds: DOWNLOAD_GRANT_TTL_SECONDS,
  };
}

/**
 * Every failure is a single generic outcome: an expired grant and a forged one
 * must look identical from outside.
 *
 * @returns {{ ok: true, orderId: string, storageReference: string,
 *             storageType: string, resourceType: string }
 *          | { ok: false, code: string }}
 */
export function verifyDownloadGrant(grant, { now = new Date() } = {}) {
  if (!downloadGrantSecretConfigured()) {
    return { ok: false, code: "GRANT_SECRET_MISSING" };
  }
  const raw = String(grant || "").trim();
  if (!raw) return { ok: false, code: "GRANT_MISSING" };

  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) {
    return { ok: false, code: "GRANT_MALFORMED" };
  }
  const [, body, signature] = parts;
  if (!equal(signature, sign(body))) {
    return { ok: false, code: "GRANT_SIGNATURE_INVALID" };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "GRANT_MALFORMED" };
  }

  const nowSeconds = Math.floor(
    (now instanceof Date ? now.getTime() : Number(now)) / 1000
  );
  if (!Number.isFinite(Number(payload?.exp)) || Number(payload.exp) <= nowSeconds) {
    return { ok: false, code: "GRANT_EXPIRED" };
  }

  return {
    ok: true,
    orderId: String(payload.oid || ""),
    storageReference: String(payload.ref || ""),
    storageType: String(payload.st || "authenticated"),
    resourceType: String(payload.rt || "image"),
  };
}
