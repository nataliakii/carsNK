/**
 * Driving licence snapshot captured with a public PLATFORM booking request.
 *
 * A public request cannot exist without it: the customer states who holds the
 * licence, which licence it is, and uploads the document. What is stored is a
 * *snapshot* in the same spirit as the booking financial snapshot — captured
 * once at create time and never recomputed afterwards, so a later profile edit
 * or a re-upload cannot rewrite what the customer presented when they booked.
 *
 * Scope: this applies to new public PLATFORM requests only. INTERNAL bookings
 * are the contractor's own offline records and are deliberately exempt.
 *
 * `verificationStatus` describes the *document*, not the booking. It is not a
 * booking lifecycle vocabulary and must never be mixed with BOOKING_STATUS,
 * RENTAL_STATE or CANONICAL_STAGE.
 */

/** Review state of the uploaded document itself. */
export const DRIVING_LICENCE_VERIFICATION = Object.freeze({
  /** Captured and stored, no human has reviewed it yet. */
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
});

export function isDrivingLicenceVerification(value) {
  return Object.values(DRIVING_LICENCE_VERIFICATION).includes(
    String(value || "")
  );
}

/**
 * Why a capture was refused. Each code maps to one translated customer
 * sentence; the server never returns a raw validator message.
 */
export const LICENCE_CAPTURE_CODE = Object.freeze({
  REQUIRED: "LICENCE_REQUIRED",
  UPLOAD_MISSING: "LICENCE_UPLOAD_MISSING",
  UPLOAD_FAILED: "LICENCE_UPLOAD_FAILED",
  HOLDER_NAME_REQUIRED: "LICENCE_HOLDER_NAME_REQUIRED",
  NUMBER_REQUIRED: "LICENCE_NUMBER_REQUIRED",
  COUNTRY_REQUIRED: "LICENCE_COUNTRY_REQUIRED",
  EXPIRY_REQUIRED: "LICENCE_EXPIRY_REQUIRED",
  EXPIRES_BEFORE_RETURN: "LICENCE_EXPIRES_BEFORE_RETURN",
  ISSUE_DATE_REQUIRED: "LICENCE_ISSUE_DATE_REQUIRED",
  ISSUE_DATE_INVALID: "LICENCE_ISSUE_DATE_INVALID",
});

/** i18n key for a refusal. Every code has an entry in all locale files. */
export function licenceCaptureMessageKey(code) {
  const map = {
    [LICENCE_CAPTURE_CODE.REQUIRED]: "order.licenceRequired",
    [LICENCE_CAPTURE_CODE.UPLOAD_MISSING]: "order.licenceUploadMissing",
    [LICENCE_CAPTURE_CODE.UPLOAD_FAILED]: "order.licenceUploadFailed",
    [LICENCE_CAPTURE_CODE.HOLDER_NAME_REQUIRED]: "order.licenceHolderRequired",
    [LICENCE_CAPTURE_CODE.NUMBER_REQUIRED]: "order.licenceNumberRequired",
    [LICENCE_CAPTURE_CODE.COUNTRY_REQUIRED]: "order.licenceCountryRequired",
    [LICENCE_CAPTURE_CODE.EXPIRY_REQUIRED]: "order.licenceExpiryRequired",
    [LICENCE_CAPTURE_CODE.EXPIRES_BEFORE_RETURN]: "order.licenceExpiresBeforeReturn",
    [LICENCE_CAPTURE_CODE.ISSUE_DATE_REQUIRED]: "order.licenceIssueDateRequired",
    [LICENCE_CAPTURE_CODE.ISSUE_DATE_INVALID]: "order.licenceIssueDateInvalid",
  };
  return map[code] || "order.licenceRequired";
}

/** English fallback for clients without a loaded translation bundle. */
export function licenceCaptureFallbackMessage(code) {
  const map = {
    [LICENCE_CAPTURE_CODE.REQUIRED]:
      "Driving licence details and a photo of the licence are required to book.",
    [LICENCE_CAPTURE_CODE.UPLOAD_MISSING]:
      "Upload a photo of the driving licence to continue.",
    [LICENCE_CAPTURE_CODE.UPLOAD_FAILED]:
      "The driving licence upload did not complete. Please upload the photo again.",
    [LICENCE_CAPTURE_CODE.HOLDER_NAME_REQUIRED]:
      "Enter the full name printed on the driving licence.",
    [LICENCE_CAPTURE_CODE.NUMBER_REQUIRED]: "Enter the driving licence number.",
    [LICENCE_CAPTURE_CODE.COUNTRY_REQUIRED]:
      "Select the country that issued the driving licence.",
    [LICENCE_CAPTURE_CODE.EXPIRY_REQUIRED]:
      "Enter the driving licence expiry date.",
    [LICENCE_CAPTURE_CODE.EXPIRES_BEFORE_RETURN]:
      "The driving licence expires before the end of the rental. Use a licence that is valid for the whole rental.",
    [LICENCE_CAPTURE_CODE.ISSUE_DATE_REQUIRED]:
      "Enter the date the driving licence was issued.",
    [LICENCE_CAPTURE_CODE.ISSUE_DATE_INVALID]:
      "The driving licence issue date must be in the past and before the expiry date.",
  };
  return map[code] || map[LICENCE_CAPTURE_CODE.REQUIRED];
}

const MAX_TEXT = 120;

function cleanText(value, maxLength = MAX_TEXT) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanCountry(value) {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2,3}$/.test(raw) ? raw : "";
}

/** Licence numbers are alphanumeric with separators; reject anything else. */
function cleanLicenceNumber(value) {
  const raw = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 40);
  return raw;
}

function parseDate(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Calendar day in UTC, so a time-of-day never decides an expiry comparison. */
function startOfUtcDay(date) {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

function refuse(code, field = "") {
  return {
    ok: false,
    code,
    field,
    messageKey: licenceCaptureMessageKey(code),
    message: licenceCaptureFallbackMessage(code),
  };
}

/**
 * Validate a customer licence capture.
 *
 * `upload` is the already-verified upload descriptor (storage reference,
 * checksum, uploadedAt) — see domain/legal/drivingLicenceUploadReceipt. This
 * function never trusts a client-supplied storage reference: callers must pass
 * an upload they verified themselves, or nothing.
 *
 * @param {{
 *   payload: object|null|undefined,
 *   upload: {storageReference: string, checksum: string, uploadedAt: Date|string,
 *            storageType?: string, resourceType?: string}|null,
 *   returnAtUtc?: Date|string|null,
 *   pickupAtUtc?: Date|string|null,
 *   requireIssueDate?: boolean,
 *   now?: Date,
 * }} params
 * @returns {{ ok: true, snapshot: object } | { ok: false, code: string, field: string, messageKey: string, message: string }}
 */
export function validateDrivingLicenceCapture({
  payload,
  upload,
  returnAtUtc = null,
  pickupAtUtc = null,
  requireIssueDate = true,
  now = new Date(),
} = {}) {
  const fields = validateDrivingLicenceFields({
    payload,
    returnAtUtc,
    pickupAtUtc,
    requireIssueDate,
    now,
  });
  if (!fields.ok) return fields;

  // Document last: the customer should learn about a typo before being told to
  // re-upload, but a missing or broken upload still blocks the whole request.
  if (!upload || typeof upload !== "object") {
    return refuse(LICENCE_CAPTURE_CODE.UPLOAD_MISSING, "document");
  }
  const storageReference = cleanText(upload.storageReference, 300);
  const checksum = String(upload.checksum || "").trim().toLowerCase();
  const uploadedAt = parseDate(upload.uploadedAt);
  if (!storageReference) {
    return refuse(LICENCE_CAPTURE_CODE.UPLOAD_MISSING, "document");
  }
  if (!/^[a-f0-9]{64}$/.test(checksum) || !uploadedAt) {
    return refuse(LICENCE_CAPTURE_CODE.UPLOAD_FAILED, "document");
  }

  return {
    ok: true,
    snapshot: {
      storageReference,
      storageType: String(upload.storageType || "authenticated"),
      // Storage needs this to build a delivery URL: a PDF scan is a "raw"
      // resource, an image is not. Captured now because the request that knew
      // the content type is long gone by the time an admin asks for the file.
      resourceType: String(upload.resourceType || "image"),
      checksum,
      uploadedAt,
      ...fields.values,
      verificationStatus: DRIVING_LICENCE_VERIFICATION.PENDING,
      capturedAt: parseDate(now) || new Date(),
    },
  };
}

/**
 * The typed-field half of the rules, without the upload.
 *
 * This is what the booking form calls so the customer sees the same refusal the
 * server would give, in the same order. It mirrors the server; it never replaces
 * it — validateDrivingLicenceCapture is still the only thing that can admit a
 * booking.
 *
 * @returns {{ ok: true, values: object } | { ok: false, code: string, field: string, messageKey: string, message: string }}
 */
export function validateDrivingLicenceFields({
  payload,
  returnAtUtc = null,
  pickupAtUtc = null,
  requireIssueDate = true,
  now = new Date(),
} = {}) {
  if (!payload || typeof payload !== "object") {
    return refuse(LICENCE_CAPTURE_CODE.REQUIRED);
  }

  const holderName = cleanText(payload.holderName);
  if (holderName.length < 2) {
    return refuse(LICENCE_CAPTURE_CODE.HOLDER_NAME_REQUIRED, "holderName");
  }

  const licenceNumber = cleanLicenceNumber(payload.licenceNumber);
  if (licenceNumber.length < 4) {
    return refuse(LICENCE_CAPTURE_CODE.NUMBER_REQUIRED, "licenceNumber");
  }

  const issuingCountry = cleanCountry(payload.issuingCountry);
  if (!issuingCountry) {
    return refuse(LICENCE_CAPTURE_CODE.COUNTRY_REQUIRED, "issuingCountry");
  }

  const expiryDate = parseDate(payload.expiryDate);
  if (!expiryDate) {
    return refuse(LICENCE_CAPTURE_CODE.EXPIRY_REQUIRED, "expiryDate");
  }

  // The licence has to cover the whole rental, not merely today. Compared on
  // calendar days: a licence expiring on the return day is still valid that day.
  const mustCover = parseDate(returnAtUtc) || parseDate(now);
  if (mustCover && startOfUtcDay(expiryDate) < startOfUtcDay(mustCover)) {
    return refuse(LICENCE_CAPTURE_CODE.EXPIRES_BEFORE_RETURN, "expiryDate");
  }

  const issueDate = parseDate(payload.issueDate);
  if (requireIssueDate && !issueDate) {
    return refuse(LICENCE_CAPTURE_CODE.ISSUE_DATE_REQUIRED, "issueDate");
  }
  if (issueDate) {
    const notAfter = parseDate(pickupAtUtc) || parseDate(now) || new Date();
    if (
      startOfUtcDay(issueDate) > startOfUtcDay(notAfter) ||
      startOfUtcDay(issueDate) >= startOfUtcDay(expiryDate)
    ) {
      return refuse(LICENCE_CAPTURE_CODE.ISSUE_DATE_INVALID, "issueDate");
    }
  }

  return {
    ok: true,
    values: {
      holderName,
      licenceNumber,
      issuingCountry,
      expiryDate,
      issueDate: issueDate || null,
    },
  };
}

/**
 * Snapshot shaped for a caller that is allowed to see it.
 *
 * `storageReference` is dropped unconditionally, for every role including
 * superadmin: it is an internal storage pointer, and the only sanctioned way to
 * reach the bytes is the authorised download endpoint. Nothing downstream
 * should ever be in a position to build a delivery URL itself.
 *
 * @param {object|null|undefined} snapshot
 * @returns {object|null}
 */
export function redactDrivingLicenceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const plain =
    typeof snapshot.toObject === "function" ? snapshot.toObject() : snapshot;
  // An empty subdocument is "never provided", not "provided but blank".
  const hasContent = Boolean(
    String(plain.storageReference || "").trim() ||
      String(plain.checksum || "").trim() ||
      String(plain.holderName || "").trim()
  );
  if (!hasContent) return null;
  const {
    storageReference: _storageReference,
    storageType: _storageType,
    resourceType: _resourceType,
    ...rest
  } = plain;
  return { ...rest, hasDocument: Boolean(String(plain.storageReference || "").trim()) };
}

/** True when the order carries a usable captured licence. */
export function hasDrivingLicenceSnapshot(order) {
  const snapshot = order?.drivingLicenceSnapshot;
  return Boolean(
    snapshot &&
      typeof snapshot === "object" &&
      String(snapshot.storageReference || "").trim() &&
      String(snapshot.checksum || "").trim()
  );
}

/**
 * Refuse a later rewrite of the captured snapshot. Mirrors the source
 * immutability guard: what the customer presented at booking is evidence.
 *
 * @returns {{ ok: boolean, code?: string }}
 */
export function assertDrivingLicenceSnapshotUnchanged(current, next) {
  if (!hasDrivingLicenceSnapshot({ drivingLicenceSnapshot: current })) {
    return { ok: true };
  }
  if (next === undefined) return { ok: true };
  const sameDocument =
    next &&
    typeof next === "object" &&
    String(next.storageReference || "") === String(current.storageReference || "") &&
    String(next.checksum || "") === String(current.checksum || "");
  if (!sameDocument) {
    return { ok: false, code: "DRIVING_LICENCE_SNAPSHOT_IMMUTABLE" };
  }
  return { ok: true };
}

/**
 * The only field a reviewer may move after capture.
 *
 * @returns {{ ok: boolean, code?: string, verificationStatus?: string }}
 */
export function applyDrivingLicenceVerification(snapshot, verificationStatus) {
  if (!isDrivingLicenceVerification(verificationStatus)) {
    return { ok: false, code: "DRIVING_LICENCE_VERIFICATION_INVALID" };
  }
  if (!hasDrivingLicenceSnapshot({ drivingLicenceSnapshot: snapshot })) {
    return { ok: false, code: "DRIVING_LICENCE_SNAPSHOT_MISSING" };
  }
  return { ok: true, verificationStatus: String(verificationStatus) };
}
