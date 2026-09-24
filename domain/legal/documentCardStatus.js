/**
 * Pure view helpers for the legal document admin cards.
 * Live (published) and unpublished (draft) are always separate.
 */

import { LEGAL_LANGUAGES } from "./documentTypes";
import { PLATFORM_DOCUMENT_CATALOG } from "./platformCatalog";

/**
 * Path used by “View live page” in admin (locale-prefixed by the caller).
 * Customer docs use the short public aliases.
 */
export function livePathForDocument(documentType) {
  const meta = PLATFORM_DOCUMENT_CATALOG.find(
    (row) => row.documentType === documentType
  );
  if (!meta) return null;
  if (meta.livePath) return meta.livePath;
  return meta.publicPath || null;
}

/**
 * @param {{ published?: object|null, latestVersion?: number|null, latestStatus?: string, draft?: object|null }} info
 */
export function splitLiveAndDraft(info) {
  const published = info?.published || null;
  const latestVersion = info?.latestVersion ?? null;
  const latestStatus = String(info?.latestStatus || "");
  const hasNewerDraft =
    latestStatus === "draft" &&
    latestVersion &&
    (!published || Number(latestVersion) > Number(published.version));

  return {
    live: published
      ? {
          version: Number(published.version),
          status: "Published",
          publishedAt: published.publishedAt || published.effectiveFrom || null,
          publishedBy: published.publishedByEmail || "",
        }
      : null,
    draft: hasNewerDraft
      ? {
          version: Number(latestVersion),
          status: "Draft",
          sourceFilename:
            info?.draft?.sourceFilename ||
            info?.draft?.pdfFilename ||
            "",
          savedAt: info?.draft?.updatedAt || null,
          savedBy: info?.draft?.savedByEmail || "",
        }
      : null,
  };
}

/**
 * Version number a new import/save would create when forcing a new draft row.
 * Prefer updating an existing newer draft (same version) when one already exists.
 */
export function nextImportDraftVersion(info) {
  const { live, draft } = splitLiveAndDraft(info);
  if (draft) return draft.version;
  if (live) return live.version + 1;
  return 1;
}

export function primaryLanguages() {
  return LEGAL_LANGUAGES;
}
