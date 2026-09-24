/**
 * Provider-independent legal translation. The browser never sees credentials.
 * Output is always a draft.
 */

import { translateText, isGoogleTranslateConfigured } from "@/domain/geo/googleTranslate";
import {
  protectTokens,
  restoreTokens,
  sectionsToPlain,
  sameStructure,
} from "./documentMarkup";
import {
  assertTranslationPublishable,
  regenerateChangedSections,
  translationStatusFor,
  TRANSLATION_STATUS,
} from "./translationWorkflow";

export const LEGAL_TRANSLATION_LANGUAGES = Object.freeze(["en", "es", "ru", "uk"]);

async function googleSectionTranslator(section, language, sourceLanguage) {
  const headingGuard = protectTokens(section.heading || "");
  const bodyGuard = protectTokens(section.body || "");
  const [heading, body] = await Promise.all([
    translateText({ text: headingGuard.safe, target: language, source: sourceLanguage }),
    translateText({ text: bodyGuard.safe, target: language, source: sourceLanguage }),
  ]);
  return {
    heading: restoreTokens(heading, headingGuard.tokens),
    body: restoreTokens(body, bodyGuard.tokens),
  };
}

/**
 * @param {{ translateSection?: Function }} [adapter]
 */
export function createLegalTranslator(adapter = {}) {
  const translateSection =
    adapter.translateSection ||
    (async (section, language, sourceLanguage) => {
      if (!isGoogleTranslateConfigured()) {
        return { heading: "", body: "" };
      }
      return googleSectionTranslator(section, language, sourceLanguage);
    });

  return {
    provider: adapter.name || (isGoogleTranslateConfigured() ? "google-translate-v2" : "unconfigured"),
    async draft({ source, language, sourceLanguage = "en" }) {
      const sections = [];
      const flags = [];
      for (const section of source.content?.sections || source.sections || []) {
        let translated = { heading: "", body: "" };
        try {
          translated = (await translateSection(section, language, sourceLanguage)) || translated;
        } catch {
          translated = { heading: "", body: "" };
        }
        const heading = String(translated.heading || "").trim();
        const body = String(translated.body || "").trim();
        if (!heading || !body) flags.push({ id: String(section.id), reason: "untranslated" });
        sections.push({
          id: String(section.id),
          heading: heading || `[untranslated:${section.id}]`,
          body: body || `[untranslated:${section.id}] ${section.body || ""}`,
          sourceFingerprint: `${section.id}|${section.heading}|${section.body}`,
        });
      }
      return {
        language,
        status: TRANSLATION_STATUS.DRAFT,
        published: false,
        autoPublished: false,
        sourceChecksum: String(source?.checksum || ""),
        sourceVersion: Number(source?.version || 0) || 0,
        title: source?.content?.title || source?.title || "",
        sections,
        flags,
        provider: this.provider,
      };
    },
  };
}

export async function buildTranslationDraft({
  source,
  language,
  sourceLanguage = "en",
  mode = "missing",
  existing,
  translateSection,
} = {}) {
  const translator = createLegalTranslator({ translateSection, name: translateSection ? "injected" : undefined });
  if (mode === "sections" && existing) {
    const syncExisting = {
      ...existing,
      sections: existing.sections || existing.content?.sections || [],
    };
    const plan = regenerateChangedSections({
      source,
      translation: syncExisting,
      language,
      translateSection: () => null,
    });
    const changed = new Set(plan.regeneratedSectionIds || []);
    const sections = [];
    for (const section of source.content?.sections || source.sections || []) {
      const previous = (syncExisting.sections || []).find((row) => String(row.id) === String(section.id));
      if (!changed.has(String(section.id)) && previous?.body) {
        sections.push(previous);
        continue;
      }
      let translated = { heading: section.heading, body: section.body };
      try {
        if (translateSection) translated = await translateSection(section, language, sourceLanguage);
        else if (isGoogleTranslateConfigured()) {
          translated = await googleSectionTranslator(section, language, sourceLanguage);
        }
      } catch {
        translated = { heading: "", body: "" };
      }
      sections.push({
        id: String(section.id),
        heading: translated?.heading || `[untranslated:${section.id}]`,
        body: translated?.body || `[untranslated:${section.id}] ${section.body || ""}`,
        sourceFingerprint: `${section.id}|${section.heading}|${section.body}`,
      });
    }
    return {
      language,
      status: TRANSLATION_STATUS.DRAFT,
      published: false,
      sourceChecksum: String(source?.checksum || ""),
      sourceVersion: Number(source?.version || 0) || 0,
      sections,
      regeneratedSectionIds: [...changed],
      provider: translator.provider,
    };
  }
  const draft = await translator.draft({ source, language, sourceLanguage });
  return { ...draft, published: false, status: TRANSLATION_STATUS.DRAFT };
}

export function publicationBlockReason(source, translation) {
  const status = translationStatusFor({
    translation,
    sourceChecksum: source?.checksum,
  });
  if (status === TRANSLATION_STATUS.OUTDATED) return "outdated_source";
  const check = assertTranslationPublishable(source, translation);
  if (!check.ok) return check.code;
  const sourceSections = source?.content?.sections || source?.sections || [];
  const translated = translation?.sections || translation?.content?.sections || [];
  if (!sameStructure(sourceSections, translated)) return "structure_mismatch";
  const sourceLen = sectionsToPlain(sourceSections).length;
  const translatedLen = sectionsToPlain(translated).length;
  if (sourceLen > 0 && translatedLen < sourceLen * 0.85) return "suspiciously_short";
  if (translated.some((section) => /\[untranslated:/.test(`${section.heading} ${section.body}`))) {
    return "untranslated_placeholder";
  }
  return "";
}
