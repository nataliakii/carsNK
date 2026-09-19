import crypto from "crypto";
import TransferOffer from "@models/TransferOffer";

const DEFAULT_TTL_SEC = 60 * 60 * 72; // 72h

/**
 * Create a random unguessable claim token; store only SHA-256 hash.
 * @returns {Promise<{ ok: true, token: string, offer: object } | { ok: false, message: string }>}
 */
export async function createHashedTransferOffer({
  transferId,
  companyId,
  supplierPayoutMinor = null,
  currency = "EUR",
  expSec = DEFAULT_TTL_SEC,
  purpose = "claim",
}) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(
    Date.now() + Math.max(60, Number(expSec) || DEFAULT_TTL_SEC) * 1000
  );

  const offer = await TransferOffer.create({
    transferId,
    companyId,
    purpose,
    tokenHash,
    expiresAt,
    supplierPayoutMinor,
    currency,
  });

  return { ok: true, token: raw, offer };
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

/**
 * Resolve a raw token to an active offer.
 * @returns {Promise<{ ok: true, offer: object, transferId: string, companyId: string } | { ok: false, message: string }>}
 */
export async function resolveTransferOfferToken(token) {
  const raw = String(token || "").trim();
  if (!raw || raw.length < 16) {
    return { ok: false, message: "Invalid token" };
  }
  const tokenHash = hashToken(raw);
  const offer = await TransferOffer.findOne({ tokenHash }).lean();
  if (!offer) {
    return { ok: false, message: "Invalid or unknown token" };
  }
  if (offer.revokedAt) {
    return { ok: false, message: "Token revoked" };
  }
  if (offer.expiresAt && new Date(offer.expiresAt).getTime() < Date.now()) {
    return { ok: false, message: "Token expired" };
  }
  return {
    ok: true,
    offer,
    transferId: String(offer.transferId),
    companyId: String(offer.companyId),
    exp: Math.floor(new Date(offer.expiresAt).getTime() / 1000),
  };
}

export async function revokeTransferOffers(transferId, { companyId } = {}) {
  const filter = { transferId, revokedAt: null };
  if (companyId) filter.companyId = companyId;
  await TransferOffer.updateMany(filter, { $set: { revokedAt: new Date() } });
}

export async function markOfferUsed(offerId) {
  if (!offerId) return;
  await TransferOffer.findByIdAndUpdate(offerId, {
    $set: { usedAt: new Date() },
  });
}

// ── Legacy HMAC tokens (read-only verify for in-flight emails) ──────────────

function getSecret() {
  const secret = String(
    process.env.TRANSFER_CLAIM_SECRET || process.env.NEXTAUTH_SECRET || ""
  ).trim();
  if (!secret) {
    throw new Error("TRANSFER_CLAIM_SECRET or NEXTAUTH_SECRET is required");
  }
  return secret;
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function sign(payloadB64) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** @deprecated Prefer createHashedTransferOffer — kept only for migration/tests. */
export function createTransferClaimToken({
  transferId,
  companyId,
  expSec = DEFAULT_TTL_SEC,
}) {
  const payload = {
    tid: String(transferId),
    cid: String(companyId),
    exp:
      Math.floor(Date.now() / 1000) +
      Math.max(60, Number(expSec) || DEFAULT_TTL_SEC),
  };
  const payloadB64 = b64urlJson(payload);
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verify legacy HMAC token OR resolve hashed offer token.
 * Prefer resolveTransferOfferToken for new tokens.
 */
export function verifyTransferClaimToken(token) {
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2) {
    return { ok: false, message: "Invalid token" };
  }
  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, message: "Invalid token signature" };
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(payloadB64));
  } catch {
    return { ok: false, message: "Invalid token payload" };
  }
  if (!payload?.tid || !payload?.cid) {
    return { ok: false, message: "Invalid token payload" };
  }
  if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
    return { ok: false, message: "Token expired" };
  }
  return {
    ok: true,
    transferId: String(payload.tid),
    companyId: String(payload.cid),
    exp: Number(payload.exp),
    legacy: true,
  };
}

/**
 * Unified resolver: hashed offer first, then legacy HMAC.
 */
export async function verifyOrResolveClaimToken(token) {
  const hashed = await resolveTransferOfferToken(token);
  if (hashed.ok) return { ...hashed, legacy: false };
  const legacy = verifyTransferClaimToken(token);
  if (legacy.ok) return legacy;
  return { ok: false, message: hashed.message || legacy.message || "Invalid token" };
}
