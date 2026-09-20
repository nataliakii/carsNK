/**
 * Deterministic checksum for legal document content.
 *
 * The checksum is what makes an accepted agreement provable: the acceptance
 * record stores the checksum of the exact text the partner saw. Any later
 * edit produces a different checksum, so a new version can never silently
 * replace a previously accepted one.
 *
 * Only content-bearing fields participate. Storage metadata (updatedAt,
 * status, publishedBy) is excluded so that publishing a draft does not change
 * the checksum of the text.
 */

import crypto from "crypto";

/**
 * Canonical JSON with sorted keys so key order can never change the hash.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalize(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Fields that define the legal text. Changing this list changes every
 * checksum, so treat it as frozen once documents are in production.
 *
 * @param {object} doc
 */
export function buildChecksumPayload(doc) {
  return {
    platform: doc?.platform ?? "",
    documentType: doc?.documentType ?? "",
    language: doc?.language ?? "",
    jurisdiction: doc?.jurisdiction ?? "",
    version: Number(doc?.version ?? 0),
    title: doc?.content?.title ?? "",
    sections: (doc?.content?.sections || []).map((section) => ({
      id: section?.id ?? "",
      heading: section?.heading ?? "",
      body: section?.body ?? section?.text ?? "",
      requires: Array.isArray(section?.requires) ? [...section.requires].sort() : [],
    })),
  };
}

/**
 * @param {object} doc
 * @returns {string} lowercase hex sha256
 */
export function computeDocumentChecksum(doc) {
  return crypto
    .createHash("sha256")
    .update(canonicalize(buildChecksumPayload(doc)), "utf8")
    .digest("hex");
}

/**
 * @param {object} doc
 * @param {string} expected
 */
export function verifyDocumentChecksum(doc, expected) {
  const actual = computeDocumentChecksum(doc);
  return {
    ok: actual === String(expected || "").toLowerCase(),
    actual,
    expected: String(expected || "").toLowerCase(),
  };
}

/** Checksum of an arbitrary rendered snapshot (immutable agreement copy). */
export function computeSnapshotChecksum(snapshot) {
  return crypto
    .createHash("sha256")
    .update(canonicalize(snapshot), "utf8")
    .digest("hex");
}
