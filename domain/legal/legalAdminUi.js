/**
 * Superadmin Legal documents UI: six platform documents, English and Spanish.
 * Version history and extra languages stay in the database; this module only
 * shapes the main admin surface.
 */

import {
  PLATFORM_AUDIENCE,
  PLATFORM_DOCUMENT_CATALOG,
  platformDocumentMeta,
} from "./platformCatalog";

export const ADMIN_LEGAL_LANGUAGES = Object.freeze(["en", "es"]);

export const ADMIN_LANGUAGE_LABELS = Object.freeze({
  en: "English",
  es: "Español",
});

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatLegalPublishedDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function canonicalPublicPath(documentType, locale = "en") {
  const lang = ADMIN_LEGAL_LANGUAGES.includes(locale) ? locale : "en";
  const meta = platformDocumentMeta(documentType);
  const path = meta?.publicPath || `/${documentType}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

export function customerDocumentRows() {
  return PLATFORM_DOCUMENT_CATALOG.filter(
    (row) => row.audience === PLATFORM_AUDIENCE.CUSTOMER
  );
}

export function partnerDocumentRows() {
  return PLATFORM_DOCUMENT_CATALOG.filter(
    (row) => row.audience === PLATFORM_AUDIENCE.SUPPLIER
  );
}

export function orderedAdminDocuments() {
  return [...customerDocumentRows(), ...partnerDocumentRows()];
}

/**
 * @param {{ published?: object|null, draft?: object|null, latestStatus?: string, latestVersion?: number }} info
 */
export function languagePublicationState(info) {
  const published = info?.published || null;
  const draft = info?.draft || null;
  const publishedVersion = published ? Number(published.version) : null;
  const draftVersion = draft ? Number(draft.version) : null;
  const unpublishedChanges = Boolean(
    published &&
      draft &&
      (draftVersion > publishedVersion ||
        (info?.latestStatus === "draft" &&
          Number(info?.latestVersion) > publishedVersion))
  );
  if (unpublishedChanges) {
    return {
      key: "unpublished_changes",
      label: "Unpublished changes",
      published: true,
      publishedAt: published.publishedAt || published.effectiveFrom || null,
    };
  }
  if (published) {
    const publishedAt = published.publishedAt || published.effectiveFrom || null;
    return {
      key: "published",
      label: publishedAt
        ? `Published · ${formatLegalPublishedDate(publishedAt)}`
        : "Published",
      published: true,
      publishedAt,
    };
  }
  return {
    key: "not_published",
    label: "Not published",
    published: false,
    publishedAt: null,
  };
}

export function compactLanguageBadge(info, language) {
  const state = languagePublicationState(info);
  const code = String(language || "").toUpperCase();
  if (state.key === "unpublished_changes") {
    return `${code} · Draft`;
  }
  if (state.key === "published") {
    const when = formatLegalPublishedDate(state.publishedAt);
    return when ? `${code} · Published ${when}` : `${code} · Published`;
  }
  return `${code} · Draft`;
}

export function summarizeAdminLanguages(overview) {
  const rows = Array.isArray(overview) ? overview : [];
  let published = 0;
  let notPublished = 0;
  let unpublishedChanges = 0;
  const attentionTypes = [];
  for (const entry of orderedAdminDocuments()) {
    const languages = rows.find(
      (row) => row.documentType === entry.documentType
    )?.languages;
    let needsAttention = false;
    for (const lang of ADMIN_LEGAL_LANGUAGES) {
      const state = languagePublicationState(languages?.[lang]);
      if (state.key === "published") published += 1;
      else if (state.key === "unpublished_changes") {
        unpublishedChanges += 1;
        needsAttention = true;
      } else {
        notPublished += 1;
        needsAttention = true;
      }
    }
    if (needsAttention) attentionTypes.push(entry.documentType);
  }
  const total = ADMIN_LEGAL_LANGUAGES.length * orderedAdminDocuments().length;
  return {
    total,
    published,
    notPublished,
    unpublishedChanges,
    documentsWithUnpublishedChanges: unpublishedChanges
      ? new Set(
          orderedAdminDocuments()
            .filter((entry) => {
              const languages = rows.find(
                (row) => row.documentType === entry.documentType
              )?.languages;
              return ADMIN_LEGAL_LANGUAGES.some(
                (lang) =>
                  languagePublicationState(languages?.[lang]).key ===
                  "unpublished_changes"
              );
            })
            .map((row) => row.documentType)
        ).size
      : 0,
    firstAttentionType: attentionTypes[0] || null,
  };
}

export function attentionMessage(summary) {
  if (!summary) return "";
  if (summary.notPublished > 0) {
    return `${summary.notPublished} language version${
      summary.notPublished === 1 ? "" : "s"
    } ${summary.notPublished === 1 ? "is" : "are"} not published.`;
  }
  if (summary.unpublishedChanges > 0) {
    return `${summary.unpublishedChanges} language version${
      summary.unpublishedChanges === 1 ? "" : "s"
    } ${summary.unpublishedChanges === 1 ? "has" : "have"} unpublished changes.`;
  }
  return "";
}
