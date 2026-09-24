/**
 * Display labels for platform legal document language rows.
 */

export const LEGAL_LANGUAGE_LABELS = Object.freeze({
  en: "English",
  es: "Spanish",
  ru: "Russian",
  uk: "Ukrainian",
});

/**
 * @param {{ published?: { version: number }|null, latestVersion?: number|null, latestStatus?: string }} info
 * @param {string} language
 */
export function formatLegalLanguageStatus(info, language) {
  const code = String(language || "").toLowerCase();
  const full = LEGAL_LANGUAGE_LABELS[code] || code.toUpperCase();
  const published = info?.published || null;
  const latestVersion = info?.latestVersion || null;
  const latestStatus = String(info?.latestStatus || "");
  const hasNewerDraft =
    latestStatus === "draft" &&
    latestVersion &&
    (!published || Number(latestVersion) > Number(published.version));

  if (published && hasNewerDraft) {
    return `${code.toUpperCase()} — Published v${published.version} · Draft v${latestVersion} ready for review`;
  }
  if (published) {
    return `${code.toUpperCase()} — Published v${published.version}`;
  }
  if (latestVersion) {
    return `${code.toUpperCase()} — Draft v${latestVersion}`;
  }
  return `${full} — Not started`;
}
