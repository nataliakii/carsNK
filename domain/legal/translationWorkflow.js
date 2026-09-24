/**
 * Legal translation workflow.
 *
 * Generated translations are drafts. Nothing here publishes a language.
 * A source change marks existing translations outdated instead of overwriting them.
 */

export const TRANSLATION_STATUS = Object.freeze({
  MISSING: "missing",
  DRAFT: "draft",
  READY: "ready",
  PUBLISHED: "published",
  OUTDATED: "outdated",
});

const UNCERTAIN = /\[untranslated:[^\]]+\]|\[uncertain\]/i;

function sectionsOf(doc) {
  return Array.isArray(doc?.sections)
    ? doc.sections
    : Array.isArray(doc?.content?.sections)
      ? doc.content.sections
      : [];
}

function textOf(section) {
  return String(section?.body ?? section?.text ?? "");
}

export function sectionFingerprint(section) {
  return `${section?.id || ""}|${section?.heading || ""}|${textOf(section)}`;
}

/**
 * A translation is complete only when every source section is present with
 * non-empty heading and body. Shorter text than the source is refused.
 */
export function assessTranslationCompleteness(source, translation) {
  const sourceSections = sectionsOf(source);
  const translated = sectionsOf(translation);
  const byId = new Map(translated.map((section) => [String(section.id), section]));
  const missing = [];
  const shortened = [];
  const uncertain = [];

  for (const section of sourceSections) {
    const next = byId.get(String(section.id));
    if (!next || !textOf(next).trim() || !String(next.heading || "").trim()) {
      missing.push(String(section.id));
      continue;
    }
    if (textOf(next).trim().length < textOf(section).trim().length) {
      shortened.push(String(section.id));
    }
    if (UNCERTAIN.test(`${next.heading}\n${textOf(next)}`)) {
      uncertain.push(String(section.id));
    }
  }

  return {
    complete: missing.length === 0 && shortened.length === 0,
    missing,
    shortened,
    uncertain,
  };
}

export function translationStatusFor({
  translation,
  sourceChecksum,
  published = false,
  readyForReview = false,
} = {}) {
  if (!translation) return TRANSLATION_STATUS.MISSING;
  const storedSource = String(translation.sourceChecksum || "");
  if (storedSource && sourceChecksum && storedSource !== String(sourceChecksum)) {
    return TRANSLATION_STATUS.OUTDATED;
  }
  if (published && translation.status === "published") {
    return TRANSLATION_STATUS.PUBLISHED;
  }
  if (readyForReview || translation.readyForReview) {
    return TRANSLATION_STATUS.READY;
  }
  return TRANSLATION_STATUS.DRAFT;
}

/**
 * Build a translation draft. The result is never published.
 */
export function createTranslationDraft({ source, language, translateSection }) {
  const sourceSections = sectionsOf(source);
  const flags = [];
  const sections = sourceSections.map((section) => {
    const translated = translateSection ? translateSection(section, language) : null;
    const heading = String(translated?.heading || "").trim();
    const body = String(translated?.body || "").trim();
    if (!heading || !body) {
      flags.push({ id: String(section.id), reason: "untranslated" });
      return {
        id: String(section.id),
        heading: heading || `[untranslated:${section.id}]`,
        body: body || `[untranslated:${section.id}] ${textOf(section)}`,
        requires: section.requires || [],
        sourceFingerprint: sectionFingerprint(section),
      };
    }
    return {
      id: String(section.id),
      heading,
      body,
      requires: section.requires || [],
      sourceFingerprint: sectionFingerprint(section),
    };
  });

  return {
    language,
    status: TRANSLATION_STATUS.DRAFT,
    published: false,
    autoPublished: false,
    sourceChecksum: String(source?.checksum || ""),
    sourceVersion: Number(source?.version || 0) || 0,
    title: String(source?.content?.title || source?.title || ""),
    sections,
    flags,
  };
}

export function diffSourceAndTranslation(source, translation) {
  const sourceSections = sectionsOf(source);
  const translated = sectionsOf(translation);
  const byId = new Map(translated.map((section) => [String(section.id), section]));
  const changes = [];
  for (const section of sourceSections) {
    const next = byId.get(String(section.id));
    const sourceFp = sectionFingerprint(section);
    const previousFp = String(next?.sourceFingerprint || "");
    if (!next || (previousFp && previousFp !== sourceFp) || !textOf(next).trim()) {
      changes.push({
        id: String(section.id),
        sourceHeading: section.heading || "",
        sourceBody: textOf(section),
        translationHeading: next?.heading || "",
        translationBody: textOf(next),
      });
    }
  }
  return changes;
}

/** Regenerate only sections whose source fingerprint changed. */
export function regenerateChangedSections({
  source,
  translation,
  translateSection,
  language,
}) {
  const changes = diffSourceAndTranslation(source, translation);
  const changedIds = new Set(changes.map((row) => row.id));
  const byId = new Map(
    sectionsOf(translation).map((section) => [String(section.id), section])
  );
  const sections = sectionsOf(source).map((section) => {
    const id = String(section.id);
    if (!changedIds.has(id) && byId.get(id)) {
      return { ...byId.get(id), sourceFingerprint: sectionFingerprint(section) };
    }
    const translated = translateSection ? translateSection(section, language) : null;
    return {
      id,
      heading: translated?.heading || section.heading || "",
      body: translated?.body || textOf(section),
      requires: section.requires || [],
      sourceFingerprint: sectionFingerprint(section),
    };
  });
  return {
    language,
    status: TRANSLATION_STATUS.DRAFT,
    published: false,
    autoPublished: false,
    sourceChecksum: String(source?.checksum || ""),
    sourceVersion: Number(source?.version || 0) || 0,
    sections,
    regeneratedSectionIds: [...changedIds],
  };
}

export function assertTranslationPublishable(source, translation) {
  const status = translationStatusFor({
    translation,
    sourceChecksum: source?.checksum,
    published: false,
  });
  if (status === TRANSLATION_STATUS.OUTDATED) {
    return { ok: false, code: "outdated", message: "Translation is outdated" };
  }
  const completeness = assessTranslationCompleteness(source, translation);
  if (!completeness.complete) {
    return {
      ok: false,
      code: "incomplete",
      message: "A published language must contain the complete document",
      completeness,
    };
  }
  if (translation?.autoPublished) {
    return {
      ok: false,
      code: "auto_publish_forbidden",
      message: "Generated translations cannot be published automatically",
    };
  }
  return { ok: true, completeness };
}

export function visibleToAudience(doc) {
  return doc?.status === "published";
}
