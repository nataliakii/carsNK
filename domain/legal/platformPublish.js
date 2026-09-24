/**
 * Simplified platform publish: one action covers every required document
 * language (EN + ES), including Cookie Policy.
 */

import { LEGAL_DOCUMENT_STATUS } from "./documentTypes";
import { PLATFORM_DOCUMENT_CATALOG } from "./platformCatalog";

/** Languages that must be published before the platform package is ready. */
export const REQUIRED_PLATFORM_PUBLISH_LANGUAGES = Object.freeze(["en", "es"]);

/**
 * @param {Array<{ documentType: string, languages?: Record<string, any> }>} overview
 * @returns {{ documentType: string, language: string, version: number }[]}
 */
export function collectRequiredPublishTargets(overview = []) {
  const list = Array.isArray(overview) ? overview : [];
  const targets = [];

  for (const { documentType } of PLATFORM_DOCUMENT_CATALOG) {
    const entry = list.find((row) => row?.documentType === documentType);
    for (const language of REQUIRED_PLATFORM_PUBLISH_LANGUAGES) {
      const info = entry?.languages?.[language];
      const version = Number(info?.latestVersion);
      if (!Number.isFinite(version) || version < 1) continue;

      const publishedVersion = info?.published
        ? Number(info.published.version)
        : null;
      const isDraft = info?.latestStatus === LEGAL_DOCUMENT_STATUS.DRAFT;
      const needsPublish =
        isDraft &&
        (!publishedVersion || version > publishedVersion);

      if (needsPublish) {
        targets.push({ documentType, language, version });
      }
    }
  }

  return targets;
}

/**
 * True when any of the six platform documents still needs EN or ES published.
 */
export function platformDocumentsNeedPublish(overview = []) {
  return collectRequiredPublishTargets(overview).length > 0;
}

export function platformDocumentDisplayName(documentType) {
  return (
    PLATFORM_DOCUMENT_CATALOG.find((row) => row.documentType === documentType)
      ?.name || "This document"
  );
}
