/**
 * Supporting evidence a partner uploads during legal onboarding.
 *
 * Only the kinds listed here may be stored. The three kinds in
 * `REQUIRED_PROFILE_DOCUMENTS` block verification while missing; the rest are
 * conditional — a partner without a VAT registration or without a regional
 * licence must not be forced to invent a file.
 *
 * Storage follows the driving-licence rules: the upload goes through an
 * authenticated route, only the Cloudinary public id is persisted, and the
 * file is served back as a short-lived signed URL. There is deliberately no
 * public variant of either route.
 */

import { getCloudinaryRootFolder } from "@config/cloudinary";

import { REQUIRED_PROFILE_DOCUMENTS } from "./partnerVerification";

export const PARTNER_DOCUMENT_KIND = Object.freeze({
  COMPANY_REGISTRATION: "company_registration",
  INSURANCE_CERTIFICATE: "insurance_certificate",
  VEHICLE_AUTHORITY: "vehicle_authority",
  TAX_IDENTIFICATION: "tax_identification",
  VAT_CERTIFICATE: "vat_certificate",
  LICENCE_PERMIT: "licence_permit",
  PAYOUT_BANK_PROOF: "payout_bank_proof",
  SIGNATORY_AUTHORITY: "signatory_authority",
});

export const ALL_PARTNER_DOCUMENT_KINDS = Object.freeze(
  Object.values(PARTNER_DOCUMENT_KIND)
);

export function isKnownPartnerDocumentKind(value) {
  return ALL_PARTNER_DOCUMENT_KINDS.includes(String(value || "").trim());
}

export function isRequiredPartnerDocumentKind(value) {
  return REQUIRED_PROFILE_DOCUMENTS.includes(String(value || "").trim());
}

/** Same ceiling as the driving-licence upload. */
export const PARTNER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Scans of registry extracts and insurance certificates are usually PDFs. */
export const PARTNER_DOCUMENT_ALLOWED_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function isAllowedPartnerDocumentType(mime) {
  return PARTNER_DOCUMENT_ALLOWED_TYPES.includes(
    String(mime || "").toLowerCase()
  );
}

/**
 * Cloudinary stores PDFs under `raw`, images under `image`. The resource type
 * has to be remembered because signing a URL requires it.
 */
export function partnerDocumentResourceType(mime) {
  return String(mime || "").toLowerCase() === "application/pdf"
    ? "raw"
    : "image";
}

/**
 * Cloudinary keeps the file extension in the public id of a `raw` asset and
 * strips it from an `image` one, so the stored reference alone is enough to
 * sign the URL back. Nothing extra has to be persisted alongside it.
 *
 * @param {string} storageRef Cloudinary public id
 */
export function resourceTypeFromStorageRef(storageRef) {
  return /\.pdf$/i.test(String(storageRef || "")) ? "raw" : "image";
}

/**
 * carsnk/partners/{companyId}/legal — one folder per partner so that an
 * erasure request can be satisfied by deleting a single prefix.
 *
 * @param {string} companyId
 */
export function buildPartnerLegalFolderPath(companyId) {
  const id = String(companyId || "").replace(/[^a-zA-Z0-9]/g, "");
  return `${getCloudinaryRootFolder()}/partners/${id || "unknown"}/legal`;
}
