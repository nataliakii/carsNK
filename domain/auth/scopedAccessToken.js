import { createHash, randomBytes } from "crypto";
import mongoose from "mongoose";
import { ScopedAccessToken } from "@models/ScopedAccessToken";
import { isValidAccessScope } from "@/domain/auth/accessScopes";
import { connectToDB } from "@lib/database";

export function hashAccessToken(rawToken) {
  return createHash("sha256").update(String(rawToken)).digest("hex");
}

export function createRawAccessToken() {
  // URL-safe token
  return randomBytes(32).toString("base64url");
}

/**
 * Validate raw token for a required scope.
 * @returns {Promise<null | { tokenDoc, ownerId }>}
 */
export async function resolveScopedAccessToken(rawToken, requiredScope) {
  const raw = String(rawToken || "").trim();
  if (!raw || !isValidAccessScope(requiredScope)) return null;

  await connectToDB();
  const tokenHash = hashAccessToken(raw);
  const doc = await ScopedAccessToken.findOne({
    tokenHash,
    revokedAt: null,
  });

  if (!doc) return null;
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
    return null;
  }
  if (!Array.isArray(doc.scopes) || !doc.scopes.includes(requiredScope)) {
    return null;
  }
  if (!doc.ownerId) return null;

  // Fire-and-forget last used
  ScopedAccessToken.updateOne(
    { _id: doc._id },
    { $set: { lastUsedAt: new Date() } }
  ).catch(() => {});

  return {
    tokenDoc: doc,
    ownerId: String(doc.ownerId),
    scopes: doc.scopes,
  };
}

export function buildAccessLink(origin, rawToken, pathSuffix = "vouchers") {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/access/${encodeURIComponent(rawToken)}/${pathSuffix}`;
}

export function toObjectIdOrNull(value) {
  if (!value) return null;
  const s = String(value);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}
