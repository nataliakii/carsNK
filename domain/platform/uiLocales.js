/** Locales the product can enable. Superadmin picks a subset per deployment. */
export const ALL_UI_LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "ca", label: "Català" },
  { code: "el", label: "Ελληνικά" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "sv", label: "Svenska" },
  { code: "no", label: "Norsk" },
  { code: "bg", label: "Български" },
  { code: "ro", label: "Română" },
  { code: "sr", label: "Srpski" },
  { code: "pl", label: "Polski" },
];

export const ALL_UI_LOCALE_CODES = ALL_UI_LOCALES.map((item) => item.code);

/**
 * Admin UI languages for now (EN / ES / RU). Others stay in ALL_UI_LOCALES
 * for the public storefront and for a later admin re-enable.
 */
export const ADMIN_UI_LOCALE_CODES = ["en", "es", "ru"];

export function getAdminUiLocales() {
  return ALL_UI_LOCALES.filter((item) =>
    ADMIN_UI_LOCALE_CODES.includes(item.code)
  );
  // Later: uncomment to restore more admin languages
  // return getAvailableUiLocales(countryCode);
}

/**
 * Paused on the Spanish (ES) deployment for now — keep in ALL_UI_LOCALES so
 * Greece can still enable them; strip via getAvailableUiLocales / filterForCountry.
 */
export const SPAIN_PAUSED_UI_LOCALES = ["bg", "sr"];

export function isUiLocaleCode(code) {
  return ALL_UI_LOCALE_CODES.includes(String(code || "").trim().toLowerCase());
}

export function isAdminUiLocaleCode(code) {
  return ADMIN_UI_LOCALE_CODES.includes(String(code || "").trim().toLowerCase());
}

export function getAvailableUiLocales(countryCode = "GR") {
  const country = String(countryCode || "").trim().toUpperCase();
  if (country !== "ES") return ALL_UI_LOCALES;
  // Spanish version: Bulgarian + Serbian commented out for now.
  return ALL_UI_LOCALES.filter(
    (item) => !SPAIN_PAUSED_UI_LOCALES.includes(item.code)
  );
}

export function filterLocalesForCountry(codes, countryCode = "GR") {
  const country = String(countryCode || "").trim().toUpperCase();
  const list = Array.isArray(codes) ? codes : [];
  if (country !== "ES") return list;
  return list.filter(
    (code) => !SPAIN_PAUSED_UI_LOCALES.includes(String(code || "").toLowerCase())
  );
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
