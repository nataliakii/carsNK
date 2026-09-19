import { isGreeceSite } from "@config/brand";
import { terms as termsGreece } from "@app/data/terms";
import { termsSpain } from "@app/data/termsSpain";

/** @returns {Record<string, object>} */
export function getRentalTermsByLocale() {
  return isGreeceSite() ? termsGreece : termsSpain;
}

/**
 * Resolve rental-terms language for the current site.
 * Greece: en / el / ru. Spain: en / es / ca / ru (+ fallback en).
 */
export function resolveRentalTermsLang(forcedLang) {
  const bundle = getRentalTermsByLocale();
  const supported = Object.keys(bundle);
  const normalized =
    typeof forcedLang === "string"
      ? forcedLang.toLowerCase().split("-")[0]
      : null;

  if (normalized && supported.includes(normalized)) return normalized;
  if (normalized === "uk" && supported.includes("ru")) return "ru";
  return supported.includes("en") ? "en" : supported[0];
}
