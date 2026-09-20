/**
 * Storage keys for platform-scoped legal documents.
 *
 * The primary store in this repo is MongoDB (`legal_documents`), but the key
 * shape mirrors the partition/sort key layout used by the shared
 * DynamoDB-backed legal API so a document can be moved either way without a
 * schema change:
 *
 *   pk: PLATFORM#rovaro#DOC#partner-agreement
 *   sk: LANG#en#JUR#EU#VERSION#1
 *
 * Documents belonging to other platforms (BBQR and friends) use a different
 * `PLATFORM#…` partition and are therefore untouched by every query here.
 */

import {
  LEGAL_PLATFORM,
  normalizeLegalLanguage,
  normalizeJurisdiction,
} from "./documentTypes";

/**
 * @param {{ platform?: string, documentType: string }} params
 */
export function buildDocumentPartitionKey({
  platform = LEGAL_PLATFORM,
  documentType,
}) {
  return `PLATFORM#${platform}#DOC#${documentType}`;
}

/**
 * @param {{ language: string, jurisdiction?: string, version: number }} params
 */
export function buildDocumentSortKey({ language, jurisdiction, version }) {
  const lang = normalizeLegalLanguage(language);
  const jur = normalizeJurisdiction(jurisdiction);
  return `LANG#${lang}#JUR#${jur}#VERSION#${Number(version)}`;
}

/**
 * Full composite key.
 * @param {{ platform?: string, documentType: string, language: string,
 *           jurisdiction?: string, version: number }} params
 */
export function buildDocumentKey(params) {
  return {
    pk: buildDocumentPartitionKey(params),
    sk: buildDocumentSortKey(params),
  };
}

/** Human-readable identifier used in URLs, emails and audit entries. */
export function buildDocumentRef({
  platform = LEGAL_PLATFORM,
  documentType,
  language,
  jurisdiction,
  version,
}) {
  return `${platform}-${documentType}@${normalizeLegalLanguage(
    language
  )}/${normalizeJurisdiction(jurisdiction)}/v${Number(version)}`;
}

/**
 * Parse a pk back into its parts. Returns null for keys that do not belong to
 * the given platform — the guard that keeps BBQR documents out of scope.
 *
 * @param {string} pk
 * @param {string} [platform]
 */
export function parseDocumentPartitionKey(pk, platform = LEGAL_PLATFORM) {
  const match = /^PLATFORM#([^#]+)#DOC#(.+)$/.exec(String(pk || ""));
  if (!match) return null;
  if (match[1] !== platform) return null;
  return { platform: match[1], documentType: match[2] };
}

/**
 * True when the key belongs to the Rovaro platform scope.
 * @param {string} pk
 */
export function isRovaroDocumentKey(pk) {
  return parseDocumentPartitionKey(pk, LEGAL_PLATFORM) !== null;
}
