/**
 * Rovaro legal document taxonomy.
 *
 * Every document created here is scoped to platform `rovaro`. Documents that
 * belong to other projects sharing the same legal-document store (e.g. BBQR)
 * live under a different platform scope and are never read, written or
 * migrated by this module.
 */

import { LEGAL_PLATFORM_SCOPE } from "@config/legalEntity";

export const LEGAL_PLATFORM = LEGAL_PLATFORM_SCOPE;

export const LEGAL_DOCUMENT_TYPE = Object.freeze({
  PARTNER_AGREEMENT: "partner-agreement",
  PARTNER_OPERATING_RULES: "partner-operating-rules",
  CUSTOMER_BOOKING_TERMS: "customer-booking-terms",
  PRIVACY_POLICY: "privacy-policy",
  COOKIE_POLICY: "cookie-policy",
  DATA_PROTECTION_SCHEDULE: "data-protection-schedule",
});

export const ALL_LEGAL_DOCUMENT_TYPES = Object.freeze(
  Object.values(LEGAL_DOCUMENT_TYPE)
);

/**
 * Canonical slug used in storage keys and URLs:
 *   `rovaro-partner-agreement`, `rovaro-privacy-policy`, …
 */
export function toPlatformDocumentSlug(documentType) {
  return `${LEGAL_PLATFORM}-${documentType}`;
}

export function isKnownDocumentType(value) {
  return ALL_LEGAL_DOCUMENT_TYPES.includes(String(value || "").trim());
}

/** Who the document is addressed to — drives access control on read. */
export const LEGAL_DOCUMENT_AUDIENCE = Object.freeze({
  PUBLIC: "public",
  PARTNER: "partner",
});

export const DOCUMENT_AUDIENCE = Object.freeze({
  /** Published terms — linked from the footer as "Partner Terms". */
  [LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT]: LEGAL_DOCUMENT_AUDIENCE.PUBLIC,
  [LEGAL_DOCUMENT_TYPE.PARTNER_OPERATING_RULES]:
    LEGAL_DOCUMENT_AUDIENCE.PUBLIC,
  /** Annex with processing detail — only inside the partner area. */
  [LEGAL_DOCUMENT_TYPE.DATA_PROTECTION_SCHEDULE]:
    LEGAL_DOCUMENT_AUDIENCE.PARTNER,
  [LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS]: LEGAL_DOCUMENT_AUDIENCE.PUBLIC,
  [LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY]: LEGAL_DOCUMENT_AUDIENCE.PUBLIC,
  [LEGAL_DOCUMENT_TYPE.COOKIE_POLICY]: LEGAL_DOCUMENT_AUDIENCE.PUBLIC,
});

export function getDocumentAudience(documentType) {
  return DOCUMENT_AUDIENCE[documentType] || LEGAL_DOCUMENT_AUDIENCE.PARTNER;
}

/**
 * Documents that form the Master Partner Agreement package. Accepting the
 * master agreement snapshots all of them together.
 */
export const MASTER_AGREEMENT_PACKAGE = Object.freeze([
  LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT,
  LEGAL_DOCUMENT_TYPE.PARTNER_OPERATING_RULES,
  LEGAL_DOCUMENT_TYPE.DATA_PROTECTION_SCHEDULE,
]);

export const LEGAL_DOCUMENT_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
});

export const ALL_LEGAL_DOCUMENT_STATUSES = Object.freeze(
  Object.values(LEGAL_DOCUMENT_STATUS)
);

/** Languages the registry ships. English is the authoritative legal version. */
export const LEGAL_AUTHORITATIVE_LANGUAGE = "en";
export const LEGAL_LANGUAGES = Object.freeze(["en", "es", "ru", "uk"]);

export function normalizeLegalLanguage(value) {
  const lang = String(value || "")
    .toLowerCase()
    .split("-")[0]
    .trim();
  return LEGAL_LANGUAGES.includes(lang)
    ? lang
    : LEGAL_AUTHORITATIVE_LANGUAGE;
}

/** Jurisdiction tag. EU covers the Spanish first market + Irish operator. */
export const LEGAL_DEFAULT_JURISDICTION = "EU";

export function normalizeJurisdiction(value) {
  const jur = String(value || "")
    .toUpperCase()
    .trim();
  return jur || LEGAL_DEFAULT_JURISDICTION;
}
