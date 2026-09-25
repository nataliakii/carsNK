/**
 * What counts as an acceptable driving licence file.
 *
 * Deliberately free of storage config and server state so the booking form can
 * import it without dragging the intake rate limiter or Cloudinary settings into
 * the browser bundle. The server enforces these same rules at intake.
 */

export const MAX_LICENCE_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_LICENCE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

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

/** PDFs are stored as raw resources; images as images. */
export function storageResourceType(contentType) {
  return String(contentType || "").toLowerCase() === "application/pdf"
    ? "raw"
    : "image";
}
