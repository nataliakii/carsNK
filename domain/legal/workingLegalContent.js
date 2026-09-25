/**
 * Choose the legal text a publisher edits and publishes.
 * Fixture drafts (QA title, "draft save test") must not outrank a real document.
 */

import { detectTestLegalContent, isFixtureLegalBody } from "./testContentGuard";

function byNewestVersion(rows) {
  return [...rows].sort((a, b) => Number(b.version) - Number(a.version));
}

function sectionText(content) {
  return (content?.sections || [])
    .map((section) => `${section?.heading || ""}\n${section?.body || ""}`)
    .join("\n");
}

export function contentFromLegalDocument(content) {
  return {
    title: content?.title || "",
    sections: Array.isArray(content?.sections) ? content.sections : [],
  };
}

function isRealLegalDocument(doc) {
  return Boolean(doc) && !detectTestLegalContent(doc).isTest;
}

/**
 * Prefer a real draft, then a real published version, then a same-language seed.
 * A QA fixture is used only when nothing else exists, so production can still reject it.
 *
 * @param {Array<{ status?: string, version?: number, content?: object }>|null|undefined} rows
 * @param {{ content?: object, language?: string }|null|undefined} seed
 */
export function selectWorkingLegalContent(rows, seed) {
  const list = Array.isArray(rows) ? rows : [];
  const drafts = byNewestVersion(list.filter((row) => row?.status === "draft"));
  const published = byNewestVersion(
    list.filter((row) => row?.status === "published")
  );
  const realSeed = seed?.content && isRealLegalDocument(seed) ? seed : null;
  const chosen =
    drafts.find(isRealLegalDocument) ||
    published.find(isRealLegalDocument) ||
    realSeed ||
    drafts[0] ||
    published[0] ||
    null;

  if (chosen?.content) return contentFromLegalDocument(chosen.content);
  if (seed?.content) return contentFromLegalDocument(seed.content);
  return { title: "", sections: [] };
}

/**
 * A stale fixture title must not block a real legal body.
 * Genuine fixtures (short QA copy, "draft save test") are left unchanged.
 *
 * @param {{ title?: string, sections?: object[] }|null|undefined} content
 * @param {{ content?: { title?: string, sections?: object[] } }|{ title?: string, sections?: object[] }|null|undefined} fallback
 */
export function prepareLegalContentForPublish(content, fallback) {
  const normalized = contentFromLegalDocument(content);
  const detected = detectTestLegalContent({ content: normalized });
  if (!detected.isTest) return normalized;

  const fallbackContent = fallback?.content?.sections
    ? fallback.content
    : fallback;
  if (
    !fallbackContent?.title ||
    !Array.isArray(fallbackContent.sections) ||
    !fallbackContent.sections.length ||
    detectTestLegalContent({ content: fallbackContent }).isTest
  ) {
    return normalized;
  }

  const onlyStaleTitle =
    detected.reasons.length > 0 &&
    detected.reasons.every((reason) => reason === "title");
  if (!onlyStaleTitle) return normalized;

  const body = sectionText(normalized);
  if (body.trim().length < 400) return normalized;
  if (isFixtureLegalBody(body)) return normalized;

  return { ...normalized, title: fallbackContent.title };
}
