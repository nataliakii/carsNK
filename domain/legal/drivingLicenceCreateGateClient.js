/**
 * Browser-safe mirror of the PLATFORM create licence-photo requirement.
 *
 * Kept separate from drivingLicenceCreateGate.js so the booking modal never
 * pulls Node crypto (upload-receipt verification) into the client bundle.
 * Only the server can verify a receipt signature; this helper only checks that
 * an opaque receipt string is present after intake.
 */

import {
  LICENCE_CAPTURE_CODE,
  licenceCaptureFallbackMessage,
  licenceCaptureMessageKey,
} from "@/domain/legal/drivingLicenceSnapshot";

/**
 * @returns {{ ok: true } | { ok: false, code: string, field: string, messageKey: string, message: string }}
 */
export function clientDrivingLicenceReadyForCreate({ payload = null } = {}) {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      code: LICENCE_CAPTURE_CODE.REQUIRED,
      field: "",
      messageKey: licenceCaptureMessageKey(LICENCE_CAPTURE_CODE.REQUIRED),
      message: licenceCaptureFallbackMessage(LICENCE_CAPTURE_CODE.REQUIRED),
    };
  }
  if (!String(payload?.uploadReceipt || "").trim()) {
    return {
      ok: false,
      code: LICENCE_CAPTURE_CODE.UPLOAD_MISSING,
      field: "document",
      messageKey: licenceCaptureMessageKey(LICENCE_CAPTURE_CODE.UPLOAD_MISSING),
      message: licenceCaptureFallbackMessage(LICENCE_CAPTURE_CODE.UPLOAD_MISSING),
    };
  }
  return { ok: true };
}
