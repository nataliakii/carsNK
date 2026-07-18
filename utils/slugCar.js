/**
 * Slug generation for Car URLs.
 * Format: lowercase, latin only, spaces/special → "-", trimmed.
 * Uniqueness: append "-2", "-3", etc. when slug exists (caller checks DB).
 */

/**
 * Normalize string to latin-only, lowercase, hyphens.
 * @param {string} str
 * @returns {string}
 */
function toSlugBase(str) {
  if (str == null || typeof str !== "string") return "";
  // Normalize: NFD to split accents, remove combining chars, then only a-z0-9 and spaces
  const normalized = str
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return normalized.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Generate base slug from model + transmission.
 * Avoids duplicating transmission if it already appears in model name.
 * Examples:
 *   { model: "Toyota Yaris", transmission: "automatic" }  → "toyota-yaris-automatic"
 *   { model: "Toyota Yaris Automatic", transmission: "automatic" } → "toyota-yaris-automatic"
 *   { model: "Fiat 500 Cabrio", transmission: "manual" } → "fiat-500-cabrio-manual"
 * @param {Object} car - { model, transmission }
 * @returns {string} Base slug (no uniqueness suffix).
 */
function generateSlugBase(car) {
  const model = car.model ? String(car.model).trim() : "";
  const transmission = car.transmission ? String(car.transmission).trim() : "";

  const parts = [];
  if (model) parts.push(model);

  if (transmission && !model.toLowerCase().includes(transmission.toLowerCase())) {
    parts.push(transmission);
  }

  const raw = parts.join(" ");
  const base = toSlugBase(raw);
  return base || "car";
}

/**
 * Ensure unique slug: if base exists, append "-2", "-3", ...
 * @param {string} base - Base slug
 * @param {Function} slugExists - async (slug) => boolean
 * @returns {Promise<string>} Unique slug
 */
async function ensureUniqueSlug(base, slugExists) {
  if (!base) base = "car";
  let slug = base;
  let n = 1;
  while (await slugExists(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

module.exports = {
  toSlugBase,
  generateSlugBase,
  ensureUniqueSlug,
};
