/**
 * The gate that stops a public PLATFORM request without a driving licence.
 *
 * This is the server-side rule. The booking form mirrors it so the customer
 * gets immediate feedback, but the form never replaces this: a request that
 * skips the UI, replays an old payload or forges a storage reference is refused
 * here.
 *
 * Callers must run this *before* the first database write and before any Stripe
 * session is created, which is what makes "no partially valid booking" true
 * rather than aspirational.
 */

import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import {
  LICENCE_CAPTURE_CODE,
  licenceCaptureFallbackMessage,
  licenceCaptureMessageKey,
  validateDrivingLicenceCapture,
} from "@/domain/legal/drivingLicenceSnapshot";
import { storageResourceType } from "@/domain/legal/drivingLicenceFileRules";
import { verifyUploadReceipt } from "@/domain/legal/drivingLicenceUploadReceipt";

export { clientDrivingLicenceReadyForCreate } from "@/domain/legal/drivingLicenceCreateGateClient";

/**
 * Only new public PLATFORM requests are in scope.
 *
 * An admin creating a booking in the contractor console is not a public
 * request, and INTERNAL records are the contractor's own offline history — both
 * keep working exactly as before.
 */
export function drivingLicenceRequiredForCreate({
  isAdminSession = false,
  bookingSource = "",
} = {}) {
  if (isAdminSession) return false;
  return String(bookingSource) === BOOKING_SOURCE.PLATFORM;
}

/**
 * Decide the licence snapshot for a create.
 *
 * @param {{
 *   isAdminSession?: boolean,
 *   bookingSource?: string,
 *   payload?: object|null,
 *   pickupAtUtc?: Date|string|null,
 *   returnAtUtc?: Date|string|null,
 *   now?: Date,
 * }} params
 * @returns {{ ok: true, required: boolean, snapshot: object|undefined }
 *          | { ok: false, code: string, field: string, messageKey: string, message: string }}
 */
export function resolveDrivingLicenceForCreate({
  isAdminSession = false,
  bookingSource = "",
  payload = null,
  pickupAtUtc = null,
  returnAtUtc = null,
  now = new Date(),
} = {}) {
  if (!drivingLicenceRequiredForCreate({ isAdminSession, bookingSource })) {
    return { ok: true, required: false, snapshot: undefined };
  }

  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      required: true,
      code: LICENCE_CAPTURE_CODE.REQUIRED,
      field: "",
      messageKey: licenceCaptureMessageKey(LICENCE_CAPTURE_CODE.REQUIRED),
      message: licenceCaptureFallbackMessage(LICENCE_CAPTURE_CODE.REQUIRED),
    };
  }

  // A forged, replayed or expired receipt is indistinguishable to the customer
  // from an upload that simply did not finish: all of them mean "upload again".
  const receipt = verifyUploadReceipt(payload.uploadReceipt, { now });
  const upload = receipt.ok ? receipt.upload : null;
  if (!upload) {
    const code =
      receipt.code === "RECEIPT_MISSING"
        ? LICENCE_CAPTURE_CODE.UPLOAD_MISSING
        : LICENCE_CAPTURE_CODE.UPLOAD_FAILED;
    return {
      ok: false,
      required: true,
      code,
      field: "document",
      messageKey: licenceCaptureMessageKey(code),
      message: licenceCaptureFallbackMessage(code),
      receiptCode: receipt.code,
    };
  }

  const result = validateDrivingLicenceCapture({
    payload,
    // The content type is authenticated by the receipt signature, so the
    // resource type derived from it is trustworthy enough to persist.
    upload: { ...upload, resourceType: storageResourceType(upload.contentType) },
    pickupAtUtc,
    returnAtUtc,
    requireTypedFields: false,
    now,
  });
  if (!result.ok) return { ...result, required: true };

  return { ok: true, required: true, snapshot: result.snapshot };
}
