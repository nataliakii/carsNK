/**
 * Public driving-licence intake rules.
 *
 * A public request uploads before the order exists, so the intake endpoint is
 * reachable without a session. Everything that keeps that safe lives here:
 * accepted file types, size ceiling, a neutral storage folder that carries no
 * customer data, and a per-IP rate limit.
 */

import { getCloudinaryOrdersFolder } from "@config/cloudinary";

export const MAX_LICENCE_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_LICENCE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const UPLOAD_LIMIT = 12;
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;

const uploadAttempts = new Map();

export function resetLicenceUploadRateLimit() {
  uploadAttempts.clear();
}

export function licenceUploadRateKey(ip) {
  return `licence-upload:${String(ip || "unknown")}`;
}

/**
 * Count an intake attempt. Returns limited: true once the window is spent.
 * The key is derived from the IP only — never from customer data.
 */
export function consumeLicenceUploadAttempt(key, { now = Date.now() } = {}) {
  const id = String(key || "").trim();
  if (!id) return { limited: false, count: 0 };
  const current = uploadAttempts.get(id);
  if (!current || now - current.start > UPLOAD_WINDOW_MS) {
    uploadAttempts.set(id, { start: now, count: 1 });
    return { limited: false, count: 1 };
  }
  current.count += 1;
  return { limited: current.count > UPLOAD_LIMIT, count: current.count };
}

/**
 * @returns {{ ok: true, contentType: string } | { ok: false, code: string }}
 */
export function validateLicenceUpload({ contentType, byteSize }) {
  const mime = String(contentType || "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_LICENCE_MIME_TYPES.includes(mime)) {
    return { ok: false, code: "UNSUPPORTED_TYPE" };
  }
  const size = Number(byteSize) || 0;
  if (size <= 0) return { ok: false, code: "EMPTY_FILE" };
  if (size > MAX_LICENCE_UPLOAD_BYTES) return { ok: false, code: "TOO_LARGE" };
  return { ok: true, contentType: mime };
}

/**
 * Folder for a licence uploaded before its order exists.
 *
 * Deliberately carries no name, email or reference: at intake time there is no
 * order to attach it to, and a storage path is not a place to put customer
 * data. Cloudinary assigns the unique filename.
 */
export function licenceIntakeFolder(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const month = Number.isNaN(date.getTime())
    ? "unknown"
    : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${getCloudinaryOrdersFolder()}/licence-intake/${month}`;
}

/** PDFs are stored as raw resources; images as images. */
export function storageResourceType(contentType) {
  return String(contentType || "").toLowerCase() === "application/pdf"
    ? "raw"
    : "image";
}
