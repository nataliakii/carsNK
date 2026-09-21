/**
 * Maps stored car enum strings (class / transmission / fuel / color)
 * onto `car.value.*` i18n keys. Falls back to a capitalized original
 * when a locale has no entry — never invents a different English word.
 */

const capitalize = (value) => {
  if (typeof value !== "string" || !value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export function carEnumValueKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function translateCarEnumValue(t, raw) {
  if (raw == null || raw === "") return raw;
  const slug = carEnumValueKey(raw);
  if (!slug) return raw;
  const key = `car.value.${slug}`;
  const translated = typeof t === "function" ? t(key) : key;
  if (!translated || translated === key) return capitalize(String(raw));
  return translated;
}

export function translateSeasonName(t, seasonKey) {
  const key = String(seasonKey || "").trim();
  if (!key) return key;
  const i18nKey = `carPark.${key}`;
  const translated = typeof t === "function" ? t(i18nKey) : i18nKey;
  if (!translated || translated === i18nKey) return key;
  return translated;
}
