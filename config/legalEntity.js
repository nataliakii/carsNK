/**
 * Single source of truth for the legal operator of the Rovaro platform.
 *
 * Rovaro is the product/brand. NK Platform Studio is ONLY the trading name of
 * the legal operator. Never rename the product to the trading name.
 *
 * Correct representation:
 *   "Nataliia Kirejeva, a sole trader established in Ireland, trading as
 *    NK Platform Studio."
 *
 * Unknown values (address, business name number, VAT, tax reference) are read
 * from configuration. They are NEVER invented and NEVER rendered as
 * "[INSERT …]" placeholders — when empty the corresponding sentence is omitted
 * from public output and reported as `missing` in the superadmin
 * Legal Configuration Status panel.
 *
 * Env (server; see .env.example)
 * -----------------------------
 *   LEGAL_TRADING_NAME / LEGAL_BRAND_NAME / LEGAL_BUSINESS_TYPE
 *   LEGAL_BUSINESS_ADDRESS / LEGAL_COUNTRY / LEGAL_COUNTRY_CODE
 *   LEGAL_EMAIL / LEGAL_SUPPORT_EMAIL / LEGAL_DOMAINS
 *   LEGAL_GOVERNING_LAW / LEGAL_CURRENCY / LEGAL_VAT_REGISTERED
 *   LEGAL_VAT_NUMBER / LEGAL_TAX_REFERENCE_NUMBER
 *
 * Public (may reach the browser bundle):
 *   NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS
 *   NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER
 *   NEXT_PUBLIC_LEGAL_JUR
 *
 * Legacy (still honoured):
 *   NEXT_PUBLIC_LEGAL_COMPANY_* / NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL / …
 */

import { getBrandName } from "@config/brand";
import { getBaseUrl } from "@config/domain";

function trimEnv(name) {
  return String(process.env[name] || "").trim();
}

function firstEnv(...names) {
  for (const name of names) {
    const value = trimEnv(name);
    if (value) return value;
  }
  return "";
}

/**
 * Reject placeholder / instruction text so it never appears in contracts.
 * e.g. "your full Irish business address"
 */
export function isUnsetLegalValue(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  if (lower.startsWith("your ")) return true;
  if (/^(tbd|todo|xxx|n\/?a|placeholder)\b/i.test(lower)) return true;
  if (/\[insert|<.*>/i.test(v)) return true;
  return false;
}

function envOrEmpty(name) {
  const value = trimEnv(name);
  return isUnsetLegalValue(value) ? "" : value;
}

/** Platform / tenant scope used for every Rovaro-owned legal document. */
export const LEGAL_PLATFORM_SCOPE = "rovaro";

/**
 * Confirmed identity defaults. Env LEGAL_* overlays can refine trading name,
 * brand, country, email and domains without inventing a different legal person.
 */
export const LEGAL_ENTITY_IDENTITY = Object.freeze({
  ownerLegalName: "Nataliia Kirejeva",
  legalStructure: "sole_trader",
  countryOfEstablishment: "Ireland",
  tradingName: "NK Platform Studio",
  platformBrand: "Rovaro",
  legalEmail: "admin@rovaro.autos",
  primaryDomain: "rovaro.autos",
  spanishDomain: "rovaro.es",
  /** Supervisory authority for GDPR complaints about the operator. */
  dataProtectionAuthority: "Irish Data Protection Commission",
  dataProtectionAuthorityUrl: "https://www.dataprotection.ie",
});

/**
 * Human-readable label for `legalStructure`, per language.
 *
 * Only the wording around the identity is translated. Legal names, the
 * trading name and the brand are never translated.
 */
export const LEGAL_STRUCTURE_LABEL = Object.freeze({
  en: { sole_trader: "sole trader" },
  es: { sole_trader: "empresaria individual (autónoma)" },
});

/**
 * Sentence templates per language. Add a language here to localise the
 * operator identification everywhere it appears — footer, legal pages,
 * emails — without touching a component.
 */
const OPERATOR_TEMPLATES = Object.freeze({
  en: {
    description: (e, structure) =>
      `${e.ownerLegalName}, a ${structure} established in ${e.countryOfEstablishment}, trading as ${e.tradingName}`,
    operatorLine: (e, description) =>
      `${e.platformBrand} is operated by ${description}.`,
    platformSentence: (e, description) =>
      `${e.platformBrand} is an online booking platform operated by ${description}.`,
    registration: (e) =>
      `Registered business name: ${e.tradingName} (${e.businessNameNumber}), ${e.countryOfEstablishment}.`,
    address: (e) => `Business address: ${e.businessAddress}`,
  },
  es: {
    description: (e, structure) =>
      `${e.ownerLegalName}, ${structure} establecida en ${translateCountry(e.countryOfEstablishment, "es")}, que opera bajo el nombre comercial ${e.tradingName}`,
    operatorLine: (e, description) =>
      `${e.platformBrand} es operado por ${description}.`,
    platformSentence: (e, description) =>
      `${e.platformBrand} es una plataforma de reservas online operada por ${description}.`,
    registration: (e) =>
      `Nombre comercial registrado: ${e.tradingName} (${e.businessNameNumber}), ${translateCountry(e.countryOfEstablishment, "es")}.`,
    address: (e) => `Dirección de la empresa: ${e.businessAddress}`,
  },
});

const COUNTRY_NAMES = Object.freeze({
  es: { Ireland: "Irlanda" },
});

function translateCountry(country, language) {
  return COUNTRY_NAMES[language]?.[country] || country;
}

/** Falls back to English for any language without a template. */
function templatesFor(language) {
  const lang = String(language || "en").toLowerCase().split("-")[0];
  return OPERATOR_TEMPLATES[lang] || OPERATOR_TEMPLATES.en;
}

function structureLabelFor(language, structure) {
  const lang = String(language || "en").toLowerCase().split("-")[0];
  return (
    LEGAL_STRUCTURE_LABEL[lang]?.[structure] ||
    LEGAL_STRUCTURE_LABEL.en[structure] ||
    structure
  );
}

function normalizeBusinessType(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!v) return "";
  if (v === "sole_trader" || v === "soletrader" || v === "autonomo") {
    return "sole_trader";
  }
  return v;
}

function parseLegalDomains(raw) {
  const parts = String(raw || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return { primaryDomain: "", spanishDomain: "" };
  const spanishDomain = parts.find((d) => d.endsWith(".es")) || "";
  const primaryDomain =
    parts.find((d) => d.endsWith(".autos") || !d.endsWith(".es")) || parts[0];
  return { primaryDomain, spanishDomain: spanishDomain || primaryDomain };
}

/**
 * Overlay from LEGAL_* env used by platform legal data and My business defaults.
 * Empty / placeholder values are omitted.
 */
export function readLegalEnvOverlay() {
  const tradingName = envOrEmpty("LEGAL_TRADING_NAME");
  const platformBrand = envOrEmpty("LEGAL_BRAND_NAME");
  const legalStructure = normalizeBusinessType(envOrEmpty("LEGAL_BUSINESS_TYPE"));
  const countryOfEstablishment = envOrEmpty("LEGAL_COUNTRY");
  const countryCode = envOrEmpty("LEGAL_COUNTRY_CODE").toUpperCase();
  const legalEmail = envOrEmpty("LEGAL_EMAIL");
  const supportEmail = envOrEmpty("LEGAL_SUPPORT_EMAIL");
  const governingLaw = envOrEmpty("LEGAL_GOVERNING_LAW");
  const currency = envOrEmpty("LEGAL_CURRENCY").toUpperCase();
  const businessAddress = envOrEmpty("LEGAL_BUSINESS_ADDRESS");
  const domains = parseLegalDomains(envOrEmpty("LEGAL_DOMAINS"));
  const vatRegisteredRaw = trimEnv("LEGAL_VAT_REGISTERED");

  return {
    ...(tradingName ? { tradingName } : {}),
    ...(platformBrand ? { platformBrand } : {}),
    ...(legalStructure ? { legalStructure } : {}),
    ...(countryOfEstablishment ? { countryOfEstablishment } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(legalEmail ? { legalEmail } : {}),
    ...(supportEmail ? { supportEmail } : {}),
    ...(governingLaw ? { governingLaw } : {}),
    ...(currency ? { currency } : {}),
    ...(businessAddress ? { businessAddress } : {}),
    ...(domains.primaryDomain ? { primaryDomain: domains.primaryDomain } : {}),
    ...(domains.spanishDomain ? { spanishDomain: domains.spanishDomain } : {}),
    ...(vatRegisteredRaw
      ? { vatRegistered: vatRegisteredRaw.toLowerCase() === "true" }
      : {}),
  };
}

/**
 * Defaults for PlatformSettings.legal.businessProfile from LEGAL_* env.
 * Used when SUPERADMIN has not saved a DB override yet.
 */
export function getEnvBusinessProfileDefaults() {
  const overlay = readLegalEnvOverlay();
  return {
    businessAddress: overlay.businessAddress || "",
    country: overlay.countryOfEstablishment || "",
    businessNameNumber: firstEnv("NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER"),
    taxRegistrationNumber: envOrEmpty("LEGAL_TAX_REFERENCE_NUMBER"),
    vatNumber: envOrEmpty("LEGAL_VAT_NUMBER"),
    vatRegistered: Boolean(overlay.vatRegistered),
    businessEmail: overlay.legalEmail || "",
    supportEmail: overlay.supportEmail || "",
    telephone: "",
    website: firstEnv(
      "NEXT_PUBLIC_LEGAL_WEBSITE",
      "NEXT_PUBLIC_SITE_URL"
    ),
    governingJurisdiction:
      overlay.countryCode ||
      (overlay.governingLaw === "Ireland" ? "IE" : "") ||
      "",
    stripeStatementName: overlay.platformBrand || "",
    proprietorName: LEGAL_ENTITY_IDENTITY.ownerLegalName,
  };
}

/**
 * Configurable legal values. Empty string means "not confirmed yet" — callers
 * must omit the value rather than substitute anything.
 *
 * @returns {{ businessAddress: string, businessNameNumber: string }}
 */
function readPublicConfigurable() {
  const fromNextPublic = firstEnv(
    "NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS",
    "NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS"
  );
  const fromLegal = envOrEmpty("LEGAL_BUSINESS_ADDRESS");
  return {
    businessAddress: isUnsetLegalValue(fromNextPublic)
      ? fromLegal
      : fromNextPublic,
    businessNameNumber: firstEnv("NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER"),
  };
}

function resolvedIdentity() {
  const overlay = readLegalEnvOverlay();
  return {
    ...LEGAL_ENTITY_IDENTITY,
    ...(overlay.tradingName ? { tradingName: overlay.tradingName } : {}),
    ...(overlay.platformBrand ? { platformBrand: overlay.platformBrand } : {}),
    ...(overlay.legalStructure
      ? { legalStructure: overlay.legalStructure }
      : {}),
    ...(overlay.countryOfEstablishment
      ? { countryOfEstablishment: overlay.countryOfEstablishment }
      : {}),
    ...(overlay.legalEmail ? { legalEmail: overlay.legalEmail } : {}),
    ...(overlay.primaryDomain ? { primaryDomain: overlay.primaryDomain } : {}),
    ...(overlay.spanishDomain ? { spanishDomain: overlay.spanishDomain } : {}),
  };
}

/**
 * Publicly renderable legal entity data.
 * Contains no tax identifiers and no personal data beyond what must legally be
 * published by a trading sole trader.
 */
export function getPublicLegalEntity(language = "en") {
  const identity = resolvedIdentity();
  const configurable = readPublicConfigurable();
  const overlay = readLegalEnvOverlay();
  return Object.freeze({
    ...identity,
    ...configurable,
    supportEmail: overlay.supportEmail || "",
    governingLaw: overlay.governingLaw || identity.countryOfEstablishment,
    currency: overlay.currency || "EUR",
    countryCode: overlay.countryCode || getLegalJurisdiction(),
    legalStructureLabel: structureLabelFor(language, identity.legalStructure),
  });
}

/**
 * Server-side legal entity data. Adds tax identifiers that must never be
 * bundled into public frontend output.
 *
 * Only call from route handlers / server components.
 */
export function getServerLegalEntity(language = "en") {
  const overlay = readLegalEnvOverlay();
  return Object.freeze({
    ...getPublicLegalEntity(language),
    vatNumber: envOrEmpty("LEGAL_VAT_NUMBER"),
    taxReferenceNumber: envOrEmpty("LEGAL_TAX_REFERENCE_NUMBER"),
    vatRegistered:
      overlay.vatRegistered != null
        ? Boolean(overlay.vatRegistered)
        : trimEnv("LEGAL_VAT_REGISTERED").toLowerCase() === "true",
    supportEmail: overlay.supportEmail || "",
  });
}

/**
 * "Nataliia Kirejeva, a sole trader established in Ireland, trading as
 *  NK Platform Studio."
 *
 * @param {string} [language]
 */
export function getOperatorLegalDescription(language = "en") {
  const e = getPublicLegalEntity(language);
  return templatesFor(language).description(e, e.legalStructureLabel);
}

/**
 * Footer / legal-page operator sentence.
 * @param {string} [language]
 */
export function getOperatorLine(language = "en") {
  const e = getPublicLegalEntity(language);
  return templatesFor(language).operatorLine(
    e,
    getOperatorLegalDescription(language)
  );
}

/**
 * Longer variant used on customer-facing legal pages.
 * @param {string} [language]
 */
export function getPlatformOperatorSentence(language = "en") {
  const e = getPublicLegalEntity(language);
  return templatesFor(language).platformSentence(
    e,
    getOperatorLegalDescription(language)
  );
}

/**
 * Registration sentence — rendered ONLY when the business name number has been
 * confirmed. Returns "" otherwise so that no invented number and no
 * "registered business name" wording is shown.
 *
 * @param {string} [language]
 */
export function getRegistrationLine(language = "en") {
  const e = getPublicLegalEntity(language);
  if (!e.businessNameNumber) return "";
  return templatesFor(language).registration(e);
}

/**
 * Address sentence — "" until the address is configured.
 * @param {string} [language]
 */
export function getBusinessAddressLine(language = "en") {
  const e = getPublicLegalEntity(language);
  if (!e.businessAddress) return "";
  return templatesFor(language).address(e);
}

/**
 * Fields tracked by the superadmin Legal Configuration Status panel.
 *
 * severity:
 *   required     — production must not run without it
 *   recommended  — strongly advised, blocks some features
 *   optional     — only relevant once the obligation applies
 */
export const LEGAL_CONFIG_FIELDS = Object.freeze([
  {
    key: "businessAddress",
    label: "Business address",
    env: "LEGAL_BUSINESS_ADDRESS / NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS",
    severity: "required",
    public: true,
    note: "Required on invoices and consumer-facing legal pages in the EU.",
  },
  {
    key: "businessNameNumber",
    label: "CRO business name number",
    env: "NEXT_PUBLIC_LEGAL_BUSINESS_NAME_NUMBER",
    severity: "recommended",
    public: true,
    note: 'Until confirmed, no "registered business name" wording is published.',
  },
  {
    key: "vatNumber",
    label: "VAT number",
    env: "LEGAL_VAT_NUMBER",
    severity: "optional",
    public: false,
    note: "Only required once the VAT registration threshold applies. Never shown publicly.",
  },
  {
    key: "taxReferenceNumber",
    label: "Tax Reference Number",
    env: "LEGAL_TAX_REFERENCE_NUMBER",
    severity: "optional",
    public: false,
    note: "Internal only. Never rendered in any customer or partner output.",
  },
]);

/**
 * Legal configuration status for the superadmin panel.
 * Missing values are reported here and NOWHERE else — regular users and
 * partners never see the missing state.
 *
 * @returns {{
 *   ok: boolean,
 *   hasBlockingIssues: boolean,
 *   fields: Array<{ key: string, label: string, env: string, severity: string,
 *                   public: boolean, note: string, status: "ok"|"missing" }>,
 *   missingRequired: string[],
 *   missingRecommended: string[],
 * }}
 */
export function getLegalConfigStatus() {
  const entity = getServerLegalEntity();
  const fields = LEGAL_CONFIG_FIELDS.map((field) => ({
    ...field,
    status: entity[field.key] ? "ok" : "missing",
  }));

  const missingRequired = fields
    .filter((f) => f.status === "missing" && f.severity === "required")
    .map((f) => f.key);
  const missingRecommended = fields
    .filter((f) => f.status === "missing" && f.severity === "recommended")
    .map((f) => f.key);

  return {
    ok: missingRequired.length === 0 && missingRecommended.length === 0,
    hasBlockingIssues: missingRequired.length > 0,
    fields,
    missingRequired,
    missingRecommended,
  };
}

/**
 * Production warning string for superadmin. Returns "" when nothing is missing.
 * Intentionally never surfaced to non-superadmin users.
 */
export function getLegalConfigWarning() {
  const status = getLegalConfigStatus();
  if (status.ok) return "";
  const parts = [];
  if (status.missingRequired.length) {
    parts.push(`missing required: ${status.missingRequired.join(", ")}`);
  }
  if (status.missingRecommended.length) {
    parts.push(`missing recommended: ${status.missingRecommended.join(", ")}`);
  }
  return `Legal configuration incomplete — ${parts.join("; ")}.`;
}

/**
 * @returns {{
 *   company: {
 *     legalName: string,
 *     tradingName: string,
 *     country: string,
 *     address: string,
 *     privacyEmail: string,
 *     website: string,
 *   },
 *   service: { name: string },
 * }}
 */
export function getLegalTemplateContext() {
  const entity = getPublicLegalEntity();
  const tradingName =
    firstEnv(
      "LEGAL_TRADING_NAME",
      "NEXT_PUBLIC_LEGAL_COMPANY_TRADING_NAME"
    ) || getBrandName();
  const website =
    trimEnv("NEXT_PUBLIC_LEGAL_WEBSITE") ||
    trimEnv("NEXT_PUBLIC_SITE_URL") ||
    getBaseUrl();

  return {
    company: {
      legalName:
        firstEnv("NEXT_PUBLIC_LEGAL_COMPANY_LEGAL_NAME") ||
        entity.ownerLegalName ||
        tradingName,
      tradingName,
      country:
        firstEnv("LEGAL_COUNTRY", "NEXT_PUBLIC_LEGAL_COMPANY_COUNTRY") ||
        "Ireland",
      address: entity.businessAddress,
      privacyEmail:
        firstEnv(
          "LEGAL_EMAIL",
          "NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL",
          "NEXT_PUBLIC_LEGAL_COMPANY_EMAIL"
        ) || "",
      website,
    },
    service: {
      name:
        firstEnv("LEGAL_BRAND_NAME", "NEXT_PUBLIC_LEGAL_SERVICE_NAME") ||
        tradingName,
    },
  };
}

/** Default jurisdiction for legal docs (Ireland operator). */
export function getLegalJurisdiction() {
  const fromCode = envOrEmpty("LEGAL_COUNTRY_CODE").toUpperCase();
  if (fromCode === "EU" || fromCode === "IE" || fromCode === "UA") return fromCode;
  const raw = trimEnv("NEXT_PUBLIC_LEGAL_JUR").toUpperCase();
  if (raw === "EU" || raw === "IE" || raw === "UA") return raw;
  return "IE";
}
