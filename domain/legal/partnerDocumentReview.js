/**
 * Per-document review state for the company-level legal review workflow.
 *
 * Opening a file does not mark it checked. The reviewer must choose
 * "Mark as checked" or "Report a problem". Problems block Approve until
 * cleared or the company reuploads.
 */

export const DOCUMENT_REVIEW_STATE = Object.freeze({
  NOT_CHECKED: "not_checked",
  CHECKED: "checked",
  PROBLEM: "problem",
});

export const DOCUMENT_PROBLEM_REASON = Object.freeze({
  UNREADABLE: "unreadable",
  EXPIRED: "expired",
  DETAILS_MISMATCH: "details_mismatch",
  WRONG_DOC: "wrong_doc",
  INCOMPLETE: "incomplete",
  OTHER: "other",
});

export const ALL_DOCUMENT_PROBLEM_REASONS = Object.freeze(
  Object.values(DOCUMENT_PROBLEM_REASON)
);

/** Plain-language labels for problem reasons (UI + company-facing copy). */
export const DOCUMENT_PROBLEM_REASON_LABEL = Object.freeze({
  [DOCUMENT_PROBLEM_REASON.UNREADABLE]: "Unreadable file",
  [DOCUMENT_PROBLEM_REASON.EXPIRED]: "Expired document",
  [DOCUMENT_PROBLEM_REASON.DETAILS_MISMATCH]: "Company details do not match",
  [DOCUMENT_PROBLEM_REASON.WRONG_DOC]: "Wrong document",
  [DOCUMENT_PROBLEM_REASON.INCOMPLETE]: "Incomplete pages",
  [DOCUMENT_PROBLEM_REASON.OTHER]: "Other",
});

/**
 * Derive review state from a stored document row.
 * Prefer explicit `reviewState`; fall back to legacy `accepted` / `note`.
 */
export function resolveDocumentReviewState(doc) {
  const explicit = String(doc?.reviewState || "").trim();
  if (
    explicit === DOCUMENT_REVIEW_STATE.CHECKED ||
    explicit === DOCUMENT_REVIEW_STATE.PROBLEM ||
    explicit === DOCUMENT_REVIEW_STATE.NOT_CHECKED
  ) {
    return explicit;
  }
  if (doc?.accepted === true) return DOCUMENT_REVIEW_STATE.CHECKED;
  if (String(doc?.note || "").trim() || String(doc?.problemReason || "").trim()) {
    return DOCUMENT_REVIEW_STATE.PROBLEM;
  }
  return DOCUMENT_REVIEW_STATE.NOT_CHECKED;
}

export function documentProblemLabel(doc) {
  const code = String(doc?.problemReason || "").trim();
  if (code && DOCUMENT_PROBLEM_REASON_LABEL[code]) {
    return DOCUMENT_PROBLEM_REASON_LABEL[code];
  }
  const note = String(doc?.note || "").trim();
  return note || "";
}

/**
 * Mark a document checked. Clears any previous problem.
 * Mutates and returns the document object.
 */
export function applyDocumentChecked(doc, { byEmail = "" } = {}) {
  if (!doc) return doc;
  doc.reviewState = DOCUMENT_REVIEW_STATE.CHECKED;
  doc.accepted = true;
  doc.note = "";
  doc.problemReason = "";
  doc.reviewedAt = new Date();
  doc.reviewedByEmail = byEmail || "";
  return doc;
}

/**
 * Flag a document problem. Reason code is required.
 * Mutates and returns the document object.
 */
export function applyDocumentProblem(
  doc,
  { reason = "", note = "", byEmail = "" } = {}
) {
  if (!doc) {
    return { ok: false, code: "missing_document", message: "Document not found" };
  }
  const code = String(reason || "").trim();
  if (!ALL_DOCUMENT_PROBLEM_REASONS.includes(code)) {
    return {
      ok: false,
      code: "reason_required",
      message: "A problem reason is required",
    };
  }
  if (code === DOCUMENT_PROBLEM_REASON.OTHER && !String(note || "").trim()) {
    return {
      ok: false,
      code: "note_required",
      message: "Describe the problem when choosing Other",
    };
  }
  doc.reviewState = DOCUMENT_REVIEW_STATE.PROBLEM;
  doc.accepted = false;
  doc.problemReason = code;
  doc.note =
    String(note || "").trim() || DOCUMENT_PROBLEM_REASON_LABEL[code] || code;
  doc.reviewedAt = new Date();
  doc.reviewedByEmail = byEmail || "";
  return { ok: true, doc };
}

/** Reset review state when the partner replaces the file. */
export function resetDocumentReviewOnUpload(doc) {
  if (!doc) return doc;
  doc.reviewState = DOCUMENT_REVIEW_STATE.NOT_CHECKED;
  doc.accepted = false;
  doc.note = "";
  doc.problemReason = "";
  doc.reviewedAt = null;
  doc.reviewedByEmail = "";
  return doc;
}
