/**
 * Strip scripts, handlers and unsafe URLs from imported legal content.
 * Uploaded file bytes and private URLs must not be written to audit logs.
 */

const BLOCKED_TAGS = /<\s*(script|iframe|object|embed|link|meta|style|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|iframe|object|embed|link|meta|style|form)\b[^>]*\/?\s*>/gi;
const EVENT_ATTRS = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi;

export function sanitizeLegalHtml(value) {
  return String(value || "")
    .replace(BLOCKED_TAGS, "")
    .replace(EVENT_ATTRS, "")
    .replace(JS_URL, '$1=$2#$2');
}

export function importEditableContent(raw) {
  const sanitized = sanitizeLegalHtml(raw);
  const unsafeRemoved = sanitized !== String(raw || "");
  return {
    format: "editable",
    editable: true,
    html: sanitized,
    unsafeRemoved,
  };
}

export function importPdfUpload({ filename, bytesLength }) {
  return {
    format: "pdf",
    editable: false,
    originalPreserved: true,
    viewer: "safe-pdf",
    filename: String(filename || "document.pdf"),
    bytesLength: Number(bytesLength) || 0,
  };
}

export function auditLegalAction(action, metadata = {}) {
  const safe = { action };
  for (const [key, value] of Object.entries(metadata)) {
    if (/content|html|body|url|storage|file/i.test(key)) continue;
    safe[key] = value;
  }
  return safe;
}

export function legalDocumentLayout(viewport) {
  const mobile = viewport === "mobile";
  return {
    viewport: mobile ? "mobile" : "desktop",
    maxWidth: mobile ? 390 : 960,
    fontSize: mobile ? 15 : 17,
    tableDisplay: mobile ? "stacked" : "table",
    horizontalScroll: mobile,
  };
}
