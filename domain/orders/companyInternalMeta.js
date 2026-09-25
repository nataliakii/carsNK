/**
 * Company-owned metadata on INTERNAL calendar bookings.
 * Free-text notes and freeform tags (e.g. "paid", "bob-confirmed") — not
 * Rovaro workflow fields. Platform bookings ignore these.
 */

export const COMPANY_NOTES_MAX_LENGTH = 2000;
export const COMPANY_TAGS_MAX_COUNT = 12;
export const COMPANY_TAG_MAX_LENGTH = 32;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeCompanyNotes(raw) {
  const text = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) return "";
  return text.slice(0, COMPANY_NOTES_MAX_LENGTH);
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeCompanyTags(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,;]+/)
      : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const tag = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, COMPANY_TAG_MAX_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= COMPANY_TAGS_MAX_COUNT) break;
  }
  return out;
}

/**
 * Apply notes/tags from an update payload onto an order document.
 * No-ops for non-internal bookings (does not clear existing values).
 *
 * @param {object} order - mongoose doc or plain order
 * @param {object} payload
 * @param {{ isInternal: boolean }} opts
 */
export function applyCompanyInternalMeta(order, payload, { isInternal }) {
  if (!order || !payload || !isInternal) return false;
  let changed = false;
  if (payload.companyNotes !== undefined) {
    const next = normalizeCompanyNotes(payload.companyNotes);
    if (order.companyNotes !== next) {
      order.companyNotes = next;
      changed = true;
    }
  }
  if (payload.companyTags !== undefined) {
    const next = normalizeCompanyTags(payload.companyTags);
    const prev = normalizeCompanyTags(order.companyTags);
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      order.companyTags = next;
      changed = true;
    }
  }
  return changed;
}
