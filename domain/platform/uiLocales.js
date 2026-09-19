/** Locales the product can enable. Superadmin picks a subset per deployment. */
export const ALL_UI_LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "el", label: "Ελληνικά" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "de", label: "Deutsch" },
  { code: "bg", label: "Български" },
  { code: "ro", label: "Română" },
  { code: "sr", label: "Srpski" },
  { code: "pl", label: "Polski" },
];

export const ALL_UI_LOCALE_CODES = ALL_UI_LOCALES.map((item) => item.code);

export function isUiLocaleCode(code) {
  return ALL_UI_LOCALE_CODES.includes(String(code || "").trim().toLowerCase());
}

export function normalizeEnabledLocales(input, fallback = ["en"]) {
  const list = Array.isArray(input) ? input : [];
  const unique = [];
  for (const raw of list) {
    const code = String(raw || "").trim().toLowerCase();
    if (!isUiLocaleCode(code) || unique.includes(code)) continue;
    unique.push(code);
  }
  if (!unique.includes("en")) unique.unshift("en");
  return unique.length ? unique : fallback;
}
