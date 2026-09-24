/**
 * Company-authored rental rules shown to the customer at booking.
 *
 * English is the source of truth. Other languages are Google Translate copies
 * stored on the company so the booking modal can open them without a live
 * Translate call on every request.
 *
 * Versions are immutable: each save that changes the English source bumps
 * publishedVersion. Clearing the source returns the company to Rovaro standard
 * rental terms for future bookings only.
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
import {
  SUPPLIER_TERMS_STATUS,
  validateSupplierRequirementsCopy,
} from "@/domain/legal/supplierTermsVersion";

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

function emptyStoredTerms(companyId = "") {
  return {
    documentId: companyId ? `supplier-terms-${companyId}` : "",
    sourceEn: "",
    translations: {},
    sourceHash: "",
    publishedVersion: 0,
    status: SUPPLIER_TERMS_STATUS.REMOVED,
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
  companyId = "",
} = {}) {
  const check = validateRentalTermsSource(raw);
  if (!check.ok) return { ok: false, message: check.message };

  const sourceEn = check.sourceEn;
  const documentId =
    String(previous?.documentId || "").trim() ||
    (companyId ? `supplier-terms-${companyId}` : "");

  if (!sourceEn) {
    return {
      ok: true,
      record: {
        ...emptyStoredTerms(companyId),
        documentId,
        updatedByEmail: String(byEmail || "").trim(),
      },
    };
  }

  const lawful = validateSupplierRequirementsCopy(sourceEn);
  if (!lawful.ok) {
    return { ok: false, message: lawful.message, code: lawful.code };
  }

  const sourceHash = hashRentalTermsSource(sourceEn);
  const previousHash = String(previous?.sourceHash || "");
  const previousTranslations = translationsToObject(previous?.translations);
  const previousVersion = Number(previous?.publishedVersion || 0) || 0;
  const publishedVersion =
    previousHash && previousHash === sourceHash && previousVersion
      ? previousVersion
      : previousVersion + 1;

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
      documentId,
      sourceEn,
      translations,
      sourceHash,
      publishedVersion,
      status: SUPPLIER_TERMS_STATUS.PUBLISHED,
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
    documentId: String(stored?.documentId || ""),
    version: Number(stored?.publishedVersion || 0) || 0,
    checksum: String(stored?.sourceHash || picked.sourceHash || ""),
  };
}
