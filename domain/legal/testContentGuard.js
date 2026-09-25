/**
 * Detect and block obvious test/fixture legal content in production.
 */

const TEST_TITLE_RE =
  /^(qa|test|draft\s*test|test\s*draft|fixture|dummy)\b|\b(qa|test)\s*(only|doc|document|terms|title)?$/i;
const TEST_BODY_RE = /draft\s*save\s*test/i;
const FIXTURE_ID_RE = /^(fixture[_-]|test[_-]|qa[_-])/i;

export const TEST_CONTENT_PRODUCTION_MESSAGE =
  "Test content cannot be published in production.";

/**
 * @param {{ content?: { title?: string, sections?: Array<{ heading?: string, body?: string, id?: string }> }, testOnly?: boolean, _id?: unknown, id?: unknown } | null} doc
 */
export function detectTestLegalContent(doc) {
  if (!doc) return { isTest: false, reasons: [] };
  const reasons = [];
  if (doc.testOnly === true) reasons.push("testOnly");

  const title = String(doc.content?.title || "").trim();
  if (title && TEST_TITLE_RE.test(title)) reasons.push("title");

  const body = (doc.content?.sections || [])
    .map((s) => `${s?.heading || ""}\n${s?.body || ""}`)
    .join("\n");
  if (TEST_BODY_RE.test(body)) reasons.push("body");
  if (TEST_TITLE_RE.test(body.slice(0, 120))) reasons.push("body_prefix");

  const id = String(doc._id || doc.id || "");
  if (id && FIXTURE_ID_RE.test(id)) reasons.push("fixture_id");

  for (const section of doc.content?.sections || []) {
    if (section?.id && FIXTURE_ID_RE.test(String(section.id))) {
      reasons.push("fixture_section_id");
      break;
    }
  }

  return { isTest: reasons.length > 0, reasons: [...new Set(reasons)] };
}

/** Body text that is itself a QA fixture, not a real legal document. */
export function isFixtureLegalBody(body) {
  const text = String(body || "");
  if (!text.trim()) return true;
  if (TEST_BODY_RE.test(text)) return true;
  if (TEST_TITLE_RE.test(text.slice(0, 120))) return true;
  return false;
}

export function isProductionLegalRuntime() {
  const vercel = String(process.env.VERCEL_ENV || "").toLowerCase();
  if (vercel === "production") return true;
  if (vercel === "preview" || vercel === "development") return false;
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

/**
 * @param {object|null} doc
 * @returns {{ ok: true } | { ok: false, code: string, message: string, reasons: string[] }}
 */
export function assertNotTestContentInProduction(doc) {
  const detected = detectTestLegalContent(doc);
  if (!detected.isTest) return { ok: true };
  if (!isProductionLegalRuntime()) {
    return { ok: true, warned: true, reasons: detected.reasons };
  }
  return {
    ok: false,
    code: "test_content_blocked",
    message: TEST_CONTENT_PRODUCTION_MESSAGE,
    reasons: detected.reasons,
  };
}
