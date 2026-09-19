/**
 * Deployment country — drives timezone, currency, default languages, and
 * whether the Greece SEO location tree is shown.
 *
 * Env:
 *   NEXT_PUBLIC_SITE_COUNTRY  GR | ES  (default GR)
 *   SITE_TIMEZONE             optional override (e.g. Europe/Madrid)
 *   NEXT_PUBLIC_SITE_CURRENCY optional override (EUR)
 */

const COUNTRY_PRESETS = {
  GR: {
    country: "GR",
    countryName: "Greece",
    timezone: "Europe/Athens",
    currency: "EUR",
    currencySymbol: "€",
    callingCode: "30",
    defaultLocales: ["en", "el", "ru", "uk", "de", "bg", "ro", "sr", "pl"],
    showLegacySeoLocations: true,
    defaultAddress: "Greece",
    defaultCoords: { lat: "40.311273589340836", lon: "23.06426516796098" },
    defaultTel: "+30 000 000 0000",
  },
  ES: {
    country: "ES",
    countryName: "Spain",
    timezone: "Europe/Madrid",
    currency: "EUR",
    currencySymbol: "€",
    callingCode: "34",
    defaultLocales: [
      "en",
      "es",
      "ca",
      "ru",
      "uk",
      "de",
      "fr",
      "it",
      "sv",
      "no",
    ],
    showLegacySeoLocations: false,
    defaultAddress: "Spain",
    defaultCoords: { lat: "40.4168", lon: "-3.7038" },
    defaultTel: "+34 000 000 000",
  },
};

export const COUNTRY_CODES = Object.keys(COUNTRY_PRESETS);

export function getSiteCountryCode() {
  const raw = String(
    process.env.NEXT_PUBLIC_SITE_COUNTRY || process.env.SITE_COUNTRY || "GR"
  )
    .trim()
    .toUpperCase();
  return COUNTRY_PRESETS[raw] ? raw : "GR";
}

export function getSiteCountryConfig() {
  const code = getSiteCountryCode();
  const preset = COUNTRY_PRESETS[code];
  const timezone = String(process.env.SITE_TIMEZONE || "").trim() || preset.timezone;
  const currency =
    String(process.env.NEXT_PUBLIC_SITE_CURRENCY || "").trim() || preset.currency;
  return { ...preset, timezone, currency };
}

export function getCountryPreset(code) {
  const key = String(code || "").trim().toUpperCase();
  return COUNTRY_PRESETS[key] || COUNTRY_PRESETS.GR;
}
