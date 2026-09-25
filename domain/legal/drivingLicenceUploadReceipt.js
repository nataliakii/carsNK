/**
 * Proof that a driving licence upload really landed in storage.
 *
 * The upload endpoint stores the file and hands the browser an opaque receipt
 * instead of a storage URL. At order-create time the server re-verifies the
 * receipt's signature, so:
 *
 *   - a client cannot invent a storage reference for a file it never uploaded,
 *   - a client cannot swap the checksum of the file it did upload,
 *   - a half-finished upload produces no receipt at all, which is exactly what
 *     makes "failed upload ⇒ no order" enforceable server-side.
 *
 * The receipt is a value, not a credential for reading the document: holding
 * one grants no access. Reads go through the authorised download endpoint,
 * which decides from session, ownership and payment state.
 */

import crypto from "crypto";

/** A customer has this long to finish the booking after uploading. */
export const UPLOAD_RECEIPT_TTL_MS = 2 * 60 * 60 * 1000;

const VERSION = "v1";

function receiptSecret() {
  const secret =
    process.env.DRIVING_LICENCE_RECEIPT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "";
  return String(secret);
}

export function uploadReceiptSecretConfigured() {
  return receiptSecret().length >= 16;
}

function canonicalPayload({
  storageReference,
  storageType,
  checksum,
  uploadedAt,
  byteSize,
  contentType,
}) {
  return {
    v: VERSION,
    ref: String(storageReference || ""),
    st: String(storageType || "authenticated"),
    sum: String(checksum || "").toLowerCase(),
    at: new Date(uploadedAt).toISOString(),
    size: Number(byteSize) || 0,
    mime: String(contentType || ""),
  };
}

function signPayload(payloadJson) {
  return crypto
    .createHmac("sha256", receiptSecret())
    .update(payloadJson, "utf8")
    .digest("base64url");
}

function signaturesEqual(left, right) {
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
 * Mint a receipt for a stored document.
 *
 * @returns {{ ok: true, receipt: string } | { ok: false, code: string }}
 */
export function createUploadReceipt(descriptor) {
  if (!uploadReceiptSecretConfigured()) {
    return { ok: false, code: "RECEIPT_SECRET_MISSING" };
  }
  const payload = canonicalPayload(descriptor || {});
  if (!payload.ref || !/^[a-f0-9]{64}$/.test(payload.sum)) {
    return { ok: false, code: "RECEIPT_PAYLOAD_INVALID" };
  }
  if (payload.at === "Invalid Date") return { ok: false, code: "RECEIPT_PAYLOAD_INVALID" };

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { ok: true, receipt: `${VERSION}.${body}.${signPayload(body)}` };
}

/**
 * Verify a receipt presented at order create.
 *
 * Every failure returns the same shape and the caller maps all of them onto one
 * customer sentence: a forged receipt and an expired one must be
 * indistinguishable from outside.
 *
 * @returns {{ ok: true, upload: object } | { ok: false, code: string }}
 */
export function verifyUploadReceipt(receipt, { now = new Date() } = {}) {
  if (!uploadReceiptSecretConfigured()) {
    return { ok: false, code: "RECEIPT_SECRET_MISSING" };
  }
  const raw = String(receipt || "").trim();
  if (!raw) return { ok: false, code: "RECEIPT_MISSING" };

  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) {
    return { ok: false, code: "RECEIPT_MALFORMED" };
  }
  const [, body, signature] = parts;
  if (!signaturesEqual(signature, signPayload(body))) {
    return { ok: false, code: "RECEIPT_SIGNATURE_INVALID" };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "RECEIPT_MALFORMED" };
  }

  const uploadedAt = new Date(payload?.at);
  if (Number.isNaN(uploadedAt.getTime())) {
    return { ok: false, code: "RECEIPT_MALFORMED" };
  }
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (uploadedAt.getTime() + UPLOAD_RECEIPT_TTL_MS <= nowMs) {
    return { ok: false, code: "RECEIPT_EXPIRED" };
  }

  return {
    ok: true,
    upload: {
      storageReference: String(payload.ref || ""),
      storageType: String(payload.st || "authenticated"),
      checksum: String(payload.sum || "").toLowerCase(),
      uploadedAt,
      byteSize: Number(payload.size) || 0,
      contentType: String(payload.mime || ""),
    },
  };
}

/** SHA-256 of the uploaded bytes — the snapshot's document checksum. */
export function checksumForBytes(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
