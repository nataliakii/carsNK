/**
 * Built-in Rovaro legal document sources.
 *
 * The text lives in version-controlled modules so that a deployment always
 * carries a complete, reviewable copy. `syncSeedDocuments` copies them into
 * the `legal_documents` collection as drafts; publishing is a separate,
 * deliberate superadmin action.
 *
 * Seeding never overwrites an existing row — that is what protects an already
 * accepted version from being silently replaced.
 */

import partnerAgreementEn from "./content/partner-agreement.en";
import partnerAgreementEs from "./content/partner-agreement.es";
import partnerOperatingRulesEn from "./content/partner-operating-rules.en";
import partnerOperatingRulesEs from "./content/partner-operating-rules.es";
import customerBookingTermsEn from "./content/customer-booking-terms.en";
import customerBookingTermsEs from "./content/customer-booking-terms.es";
import privacyPolicyEn from "./content/privacy-policy.en";
import privacyPolicyEs from "./content/privacy-policy.es";
import cookiePolicyEn from "./content/cookie-policy.en";
import cookiePolicyEs from "./content/cookie-policy.es";
import dataProtectionScheduleEn from "./content/data-protection-schedule.en";
import dataProtectionScheduleEs from "./content/data-protection-schedule.es";

import {
  LEGAL_PLATFORM,
  LEGAL_DOCUMENT_STATUS,
  normalizeLegalLanguage,
  normalizeJurisdiction,
  isKnownDocumentType,
} from "./documentTypes";
import { computeDocumentChecksum } from "./checksum";
import { buildDocumentKey } from "./documentKeys";

const SEED_SOURCES = [
  partnerAgreementEn,
  partnerAgreementEs,
  partnerOperatingRulesEn,
  partnerOperatingRulesEs,
  customerBookingTermsEn,
  customerBookingTermsEs,
  privacyPolicyEn,
  privacyPolicyEs,
  cookiePolicyEn,
  cookiePolicyEs,
  dataProtectionScheduleEn,
  dataProtectionScheduleEs,
];

/**
 * Normalize a content module into the stored document shape and attach its
 * checksum and composite key.
 *
 * @param {object} source
 */
export function normalizeSeedDocument(source) {
  if (!isKnownDocumentType(source?.documentType)) {
    throw new Error(`Unknown legal document type: ${source?.documentType}`);
  }

  const base = {
    platform: LEGAL_PLATFORM,
    documentType: source.documentType,
    language: normalizeLegalLanguage(source.language),
    jurisdiction: normalizeJurisdiction(source.jurisdiction),
    version: Number(source.version) || 1,
    status: LEGAL_DOCUMENT_STATUS.DRAFT,
    effectiveFrom: source.effectiveFrom ? new Date(source.effectiveFrom) : null,
    content: {
      title: source.content?.title || "",
      sections: (source.content?.sections || []).map((section) => ({
        id: String(section.id),
        heading: section.heading || "",
        body: section.body ?? section.text ?? "",
        requires: Array.isArray(section.requires) ? section.requires : [],
      })),
    },
  };

  return {
    ...base,
    checksum: computeDocumentChecksum(base),
    ...buildDocumentKey(base),
  };
}

let cached = null;

/** All built-in documents, normalized. Computed once per process. */
export function getSeedDocuments() {
  if (!cached) cached = SEED_SOURCES.map(normalizeSeedDocument);
  return cached;
}

/**
 * @param {string} documentType
 * @param {string} language
 */
export function getSeedDocument(documentType, language) {
  const lang = normalizeLegalLanguage(language);
  const docs = getSeedDocuments();
  return (
    docs.find((d) => d.documentType === documentType && d.language === lang) ||
    docs.find((d) => d.documentType === documentType && d.language === "en") ||
    null
  );
}
