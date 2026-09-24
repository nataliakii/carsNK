/**
 * One canonical customer Terms route.
 *
 * `/rental-terms` and `/booking-terms` are legacy aliases that redirect here.
 * Supplier agreement routes are unrelated and keep their own paths.
 */

export const CUSTOMER_TERMS_SEGMENT = "/terms";

/** Legacy customer-terms segments that must redirect to the canonical route. */
export const LEGACY_CUSTOMER_TERMS_SEGMENTS = Object.freeze([
  "/rental-terms",
  "/booking-terms",
]);

export function isLegacyCustomerTermsPath(pathWithoutLocale) {
  return LEGACY_CUSTOMER_TERMS_SEGMENTS.includes(String(pathWithoutLocale || ""));
}

function queryString(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  const entries =
    typeof query.entries === "function"
      ? [...query.entries()]
      : Object.entries(query);
  for (const [key, value] of entries) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * @param {string} locale
 * @param {Record<string, string|string[]>|URLSearchParams} [query] preserved as-is
 */
export function canonicalTermsPath(locale, query) {
  const lang = String(locale || "en").trim() || "en";
  return `/${lang}${CUSTOMER_TERMS_SEGMENT}${queryString(query)}`;
}
