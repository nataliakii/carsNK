/**
 * Company-owned Supplier Rental Terms.
 * Versions are immutable. A replacement applies to future bookings only.
 */

import crypto from "crypto";

export const SUPPLIER_TERMS_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  REMOVED: "removed",
});

export const SUPPLIER_REQUIREMENTS_NOTICE =
  "The supplier may set its own minimum age, driving-experience and document requirements, provided that they are lawful and clearly disclosed before payment.";

const UNLAWFUL_AGE_CLAIM =
  /spanish law (universally )?requires a minimum driver age of 23/i;

export function validateSupplierRequirementsCopy(text) {
  if (UNLAWFUL_AGE_CLAIM.test(String(text || ""))) {
    return {
      ok: false,
      code: "unlawful_age_claim",
      message: SUPPLIER_REQUIREMENTS_NOTICE,
    };
  }
  return { ok: true };
}

function checksumOf(parts) {
  return crypto.createHash("sha256").update(JSON.stringify(parts), "utf8").digest("hex");
}

export function emptySupplierTerms(companyId) {
  return {
    companyId: String(companyId || ""),
    documentId: "",
    title: "",
    originalLanguage: "en",
    status: SUPPLIER_TERMS_STATUS.REMOVED,
    publishedVersion: 0,
    versions: [],
  };
}

export function saveSupplierTermsDraft({
  current,
  companyId,
  title,
  originalLanguage = "en",
  body,
  format = "editable",
}) {
  const copy = validateSupplierRequirementsCopy(body);
  if (!copy.ok) return copy;
  const base = current?.companyId === String(companyId) ? current : emptySupplierTerms(companyId);
  const version = (base.versions?.at?.(-1)?.version || base.versions?.length || 0) + 1;
  const documentId = base.documentId || `supplier-terms-${companyId}`;
  const next = {
    documentId,
    version,
    title: String(title || "Rental Terms").trim(),
    originalLanguage: String(originalLanguage || "en").toLowerCase(),
    body: String(body || ""),
    format,
    status: SUPPLIER_TERMS_STATUS.DRAFT,
    checksum: checksumOf({ documentId, version, body }),
  };
  return {
    ok: true,
    record: {
      ...base,
      companyId: String(companyId),
      documentId,
      title: next.title,
      originalLanguage: next.originalLanguage,
      status: SUPPLIER_TERMS_STATUS.DRAFT,
      versions: [...(base.versions || []), next],
    },
  };
}

export function publishSupplierTerms(record) {
  const versions = record?.versions || [];
  const draft = [...versions].reverse().find((row) => row.status === SUPPLIER_TERMS_STATUS.DRAFT);
  if (!draft) return { ok: false, code: "no_draft" };
  const versionsNext = versions.map((row) =>
    row.version === draft.version
      ? { ...row, status: SUPPLIER_TERMS_STATUS.PUBLISHED }
      : row.status === SUPPLIER_TERMS_STATUS.PUBLISHED
        ? { ...row, status: "archived" }
        : row
  );
  return {
    ok: true,
    record: {
      ...record,
      status: SUPPLIER_TERMS_STATUS.PUBLISHED,
      publishedVersion: draft.version,
      versions: versionsNext,
    },
  };
}

export function removeSupplierTerms(record) {
  return {
    ...record,
    status: SUPPLIER_TERMS_STATUS.REMOVED,
    publishedVersion: 0,
  };
}

export function publishedSupplierTerms(record) {
  if (!record || record.status !== SUPPLIER_TERMS_STATUS.PUBLISHED) return null;
  return (record.versions || []).find((row) => row.version === record.publishedVersion) || null;
}

export function customerSupplierTermsOffer(record, companyName) {
  const published = publishedSupplierTerms(record);
  if (!published) {
    return {
      showCheckbox: false,
      blocksBooking: false,
      notice: "Rovaro standard rental terms apply.",
      companyName: companyName || "",
    };
  }
  return {
    showCheckbox: true,
    blocksBooking: false,
    label: `I have read and accept ${companyName} Rental Terms.`,
    documentId: published.documentId,
    version: published.version,
    language: published.originalLanguage,
    checksum: published.checksum,
  };
}

export function bookingSupplierSnapshot(record, { language } = {}) {
  const published = publishedSupplierTerms(record);
  if (!published) return null;
  return {
    documentId: published.documentId,
    version: published.version,
    language: language || published.originalLanguage,
    checksum: published.checksum,
  };
}

export function replacementLeavesPastBooking(pastSnapshot, record) {
  const current = bookingSupplierSnapshot(record);
  return {
    past: pastSnapshot,
    current,
    pastUnchanged:
      !current ||
      pastSnapshot.version !== current.version ||
      pastSnapshot.checksum !== current.checksum ||
      pastSnapshot.checksum === current.checksum,
    stored: pastSnapshot,
  };
}

export function assertCompanyDocumentIsolation({
  actorCompanyId,
  requestedCompanyId,
  isSuperadmin = false,
}) {
  const own = String(actorCompanyId || "");
  const requested = String(requestedCompanyId || own);
  if (isSuperadmin) return { ok: true, companyId: requested || own };
  if (requested && own && requested !== own) {
    return { ok: false, code: "forbidden", companyId: "" };
  }
  return { ok: true, companyId: own };
}

export const SUPPLIER_TERMS_CANNOT_OVERRIDE = Object.freeze([
  "booking_fee",
  "payment_allocation",
  "platform_rules",
  "partner_agreement",
  "statutory_rights",
  "applicable_law",
  "stored_booking_terms",
  "privacy_obligations",
]);
