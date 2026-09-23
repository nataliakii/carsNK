/**
 * Company-authored rental rules shown to the customer at booking.
 *
 * English is the source of truth. Other languages are Google Translate copies
 * stored on the company so the booking modal can open them without a live
 * Translate call on every request.
 */

import crypto from "crypto";

import {
  isGoogleTranslateConfigured,
  translateToLocales,
} from "@/domain/geo/googleTranslate";
import {
  CUSTOMER_RENTAL_TERMS_MAX_CHARS,
  CUSTOMER_RENTAL_TERMS_TARGET_LOCALES,
} from "./customerRentalTermsConstants";

export {
  CUSTOMER_RENTAL_TERMS_MAX_CHARS,
  CUSTOMER_RENTAL_TERMS_TARGET_LOCALES,
};

export function normalizeRentalTermsSource(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function hashRentalTermsSource(value) {
  return crypto
    .createHash("sha256")
    .update(normalizeRentalTermsSource(value), "utf8")
    .digest("hex");
}

export function translationsToObject(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === "function") return value.toObject();
  if (typeof value === "object") return { ...value };
  return {};
}

export function validateRentalTermsSource(value) {
  const sourceEn = normalizeRentalTermsSource(value);
  if (sourceEn.length > CUSTOMER_RENTAL_TERMS_MAX_CHARS) {
    return {
      ok: false,
      message: `Rental rules must be at most ${CUSTOMER_RENTAL_TERMS_MAX_CHARS} characters`,
    };
  }
  return { ok: true, sourceEn };
}

/**
 * Body the customer should read for `lang`, falling back to English.
 */
export function pickCompanyRentalTermsForLanguage(stored, lang) {
  const sourceEn = normalizeRentalTermsSource(stored?.sourceEn);
  if (!sourceEn) {
    return {
      available: false,
      body: "",
      language: "en",
      sourceHash: "",
      fellBackToEnglish: false,
    };
  }
  const sourceHash = stored?.sourceHash || hashRentalTermsSource(sourceEn);
  const code = String(lang || "en")
    .toLowerCase()
    .split("-")[0]
    .trim();
  if (!code || code === "en") {
    return {
      available: true,
      body: sourceEn,
      language: "en",
      sourceHash,
      fellBackToEnglish: false,
    };
  }
  const translations = translationsToObject(stored?.translations);
  const translated = normalizeRentalTermsSource(translations[code]);
  if (translated) {
    return {
      available: true,
      body: translated,
      language: code,
      sourceHash,
      fellBackToEnglish: false,
    };
  }
  return {
    available: true,
    body: sourceEn,
    language: "en",
    sourceHash,
    fellBackToEnglish: true,
  };
}

function emptyStoredTerms() {
  return {
    sourceEn: "",
    translations: {},
    sourceHash: "",
    translatedAt: null,
    updatedAt: new Date(),
    updatedByEmail: "",
    failed: [],
    translateConfigured: isGoogleTranslateConfigured(),
  };
}

/**
 * Persist English source and (when a key is present) fill every UI locale.
 */
export async function buildCustomerRentalTermsRecord({
  sourceEn: raw,
  previous = {},
  byEmail = "",
} = {}) {
  const check = validateRentalTermsSource(raw);
  if (!check.ok) return { ok: false, message: check.message };

  const sourceEn = check.sourceEn;
  if (!sourceEn) {
    return {
      ok: true,
      record: {
        ...emptyStoredTerms(),
        updatedByEmail: String(byEmail || "").trim(),
      },
    };
  }

  const sourceHash = hashRentalTermsSource(sourceEn);
  const previousHash = String(previous?.sourceHash || "");
  const previousTranslations = translationsToObject(previous?.translations);

  let translations = {};
  let failed = [];
  let translatedAt = previous?.translatedAt || null;

  if (previousHash === sourceHash && Object.keys(previousTranslations).length) {
    translations = previousTranslations;
  } else if (isGoogleTranslateConfigured()) {
    const result = await translateToLocales({
      text: sourceEn,
      targets: CUSTOMER_RENTAL_TERMS_TARGET_LOCALES,
      source: "en",
    });
    translations = result.translations;
    failed = result.failed;
    translatedAt = new Date();
  }

  return {
    ok: true,
    record: {
      sourceEn,
      translations,
      sourceHash,
      translatedAt,
      updatedAt: new Date(),
      updatedByEmail: String(byEmail || "").trim(),
    },
    failed,
    translateConfigured: isGoogleTranslateConfigured(),
  };
}

export function publicCompanyRentalTermsView(stored, lang, companyName = "") {
  const picked = pickCompanyRentalTermsForLanguage(stored, lang);
  return {
    ...picked,
    companyName: String(companyName || "").trim(),
  };
}
