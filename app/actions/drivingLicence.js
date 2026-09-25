/**
 * Server communication for the public driving-licence capture.
 *
 * Components and hooks never call the network themselves; they call in here.
 * The returned receipt is opaque: the browser cannot read a storage URL out of
 * it, and holding it grants no access to the document.
 */

import { ALLOWED_LICENCE_MIME_TYPES } from "@/domain/legal/drivingLicenceFileRules";

const INTAKE_PATH = "/api/order/driving-licence/intake";

/** Refusal codes the field turns into one translated sentence each. */
export const LICENCE_UPLOAD_ERROR = Object.freeze({
  UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE",
  TOO_LARGE: "TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  UPLOAD_FAILED: "UPLOAD_FAILED",
});

export const LICENCE_FILE_ACCEPT = ALLOWED_LICENCE_MIME_TYPES.join(",");

/**
 * Upload one licence document.
 *
 * @param {File} file
 * @returns {Promise<{ ok: true, receipt: string, checksum: string, uploadedAt: string, fileName: string }
 *                  | { ok: false, code: string }>}
 */
export async function uploadDrivingLicenceDocument(file) {
  if (!file) return { ok: false, code: LICENCE_UPLOAD_ERROR.UPLOAD_FAILED };

  const formData = new FormData();
  formData.append("file", file);

  let response;
  try {
    response = await fetch(INTAKE_PATH, { method: "POST", body: formData });
  } catch {
    return { ok: false, code: LICENCE_UPLOAD_ERROR.UPLOAD_FAILED };
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success || !body?.receipt) {
    const code = String(body?.code || "");
    // Receipt signing misconfig and storage failures share one customer sentence:
    // the photo did not finish attaching to the booking.
    if (
      code === "RECEIPT_UNAVAILABLE" ||
      code === "STORAGE_UNAVAILABLE" ||
      code === "NO_FILE" ||
      code === "EMPTY_FILE" ||
      code === "INVALID_REQUEST"
    ) {
      return { ok: false, code: LICENCE_UPLOAD_ERROR.UPLOAD_FAILED };
    }
    return {
      ok: false,
      code: Object.values(LICENCE_UPLOAD_ERROR).includes(code)
        ? code
        : LICENCE_UPLOAD_ERROR.UPLOAD_FAILED,
    };
  }

  return {
    ok: true,
    receipt: body.receipt,
    checksum: String(body.checksum || ""),
    uploadedAt: String(body.uploadedAt || ""),
    fileName: String(body.fileName || ""),
  };
}
