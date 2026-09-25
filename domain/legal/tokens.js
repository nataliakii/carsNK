/**
 * Token substitution for legal document content.
 *
 * Stored content keeps `{{token}}` placeholders so the checksum stays stable
 * across deployments and across changes to configured values. Substitution
 * happens at render time only.
 *
 * A section may declare `requires: ["businessAddress"]`. When any required
 * value is unset the whole section is dropped from public/partner output — we
 * never render "[INSERT ADDRESS]" or an invented value. The superadmin Legal
 * Configuration Status panel reports what is missing.
 *
 * `{{company.*}}` tokens are the per-company commercial terms and resolve only
 * when a caller supplies `commercialTerms`. Without that context the token is
 * unresolved and any section declaring `requires: ["bookingFeePercent"]` is
 * dropped, which is what keeps the shared documents — and therefore the shared
 * package checksum — free of one partner's negotiated percentage.
 */

import {
  getPublicLegalEntity,
  getOperatorLegalDescription,
  getPlatformOperatorSentence,
  getOperatorLine,
} from "@config/legalEntity";
import { PAYMENT_PROCESSOR_NAME } from "@config/stripe";
import { repairAccidentalHeadingSections } from "@/domain/legal/documentMarkup";
import {
  COMPANY_COMMERCIAL_TOKEN_KEYS,
  buildCompanyCommercialTokens,
  companyCommercialRequirables,
} from "@/domain/legal/companyCommercialTerms";

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/**
 * Values available to document content. Only non-sensitive fields — tax
 * identifiers are deliberately absent so they can never leak into a rendered
 * public document.
 *
 * @param {{
 *   settings?: Record<string, unknown>,
 *   language?: string,
 *   commercialTerms?: object|null,
 * }} [opts]
 */
export function buildTokenValues({
  settings = {},
  language = "en",
  commercialTerms = null,
} = {}) {
  const e = getPublicLegalEntity(language);
  const profile =
    settings?.businessProfile && typeof settings.businessProfile === "object"
      ? settings.businessProfile
      : {};
  const businessAddress = profile.businessAddress || e.businessAddress;
  const businessNameNumber =
    profile.businessNameNumber || e.businessNameNumber;
  const legalEmail = profile.businessEmail || e.legalEmail;
  return {
    "operator.legalName": e.ownerLegalName,
    "operator.legalStructure": e.legalStructureLabel,
    "operator.country": profile.country || e.countryOfEstablishment,
    "operator.tradingName": e.tradingName,
    "operator.platformBrand": e.platformBrand,
    "operator.legalEmail": legalEmail,
    "operator.primaryDomain": e.primaryDomain,
    "operator.spanishDomain": e.spanishDomain,
    "operator.businessAddress": businessAddress,
    "operator.businessNameNumber": businessNameNumber,
    "operator.description": getOperatorLegalDescription(language),
    "operator.platformSentence": getPlatformOperatorSentence(language),
    "operator.footerLine": getOperatorLine(language),
    "operator.dpa": e.dataProtectionAuthority,
    "operator.dpaUrl": e.dataProtectionAuthorityUrl,
    "operator.paymentProcessorName": PAYMENT_PROCESSOR_NAME,
    ...buildCompanyCommercialTokens(commercialTerms),
    ...Object.fromEntries(
      Object.entries(settings)
        .filter(([, value]) => value == null || typeof value !== "object")
        .map(([key, value]) => [
          `settings.${key}`,
          value == null ? "" : String(value),
        ])
    ),
  };
}

/** Configurable values that a section may declare in `requires`. */
export function getRequirableValues(settings = {}, commercialTerms = null) {
  const e = getPublicLegalEntity();
  const profile =
    settings?.businessProfile && typeof settings.businessProfile === "object"
      ? settings.businessProfile
      : {};
  return {
    businessAddress: profile.businessAddress || e.businessAddress,
    businessNameNumber: profile.businessNameNumber || e.businessNameNumber,
    ...companyCommercialRequirables(commercialTerms),
  };
}

/**
 * @param {string} text
 * @param {Record<string, string>} values
 */
export function substituteTokens(text, values) {
  return String(text ?? "").replace(TOKEN_RE, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * True when every configurable value the section depends on is filled in.
 * @param {{ requires?: string[] }} section
 */
export function sectionRequirementsMet(section, requirable = getRequirableValues()) {
  const requires = Array.isArray(section?.requires) ? section.requires : [];
  return requires.every((key) => Boolean(requirable[key]));
}

/**
 * Render a stored document into display form.
 *
 * @param {object} doc               registry/db document
 * @param {{
 *   settings?: Record<string, unknown>,
 *   language?: string,
 *   commercialTerms?: object|null,
 * }} [opts]
 * @returns {{ title: string, sections: Array<{ id: string, heading: string, text: string }> }}
 */
export function renderLegalDocument(
  doc,
  { settings = {}, language, commercialTerms = null } = {}
) {
  const values = buildTokenValues({
    settings,
    language: language || doc?.language || "en",
    commercialTerms,
  });
  const requirable = getRequirableValues(settings, commercialTerms);
  // Repair select-all→Heading damage at read time so published pages recover
  // without requiring every language to be re-saved.
  const sections = repairAccidentalHeadingSections(doc?.content?.sections || [])
    .filter((section) => sectionRequirementsMet(section, requirable))
    .map((section, index) => ({
      id: section.id || `s${index + 1}`,
      heading: substituteTokens(section.heading || "", values),
      text: substituteTokens(section.body ?? section.text ?? "", values),
    }));

  return {
    title: substituteTokens(doc?.content?.title || "", values),
    sections,
  };
}

/**
 * Sections hidden from output because platform configuration is incomplete.
 * Used by the superadmin panel only.
 *
 * Per-company commercial values are not platform configuration, so a section
 * that only depends on them is not reported as missing here.
 */
export function findSuppressedSections(doc) {
  const requirable = {
    ...getRequirableValues(),
    ...Object.fromEntries(
      COMPANY_COMMERCIAL_TOKEN_KEYS.map((key) => [key, "per-company"])
    ),
  };
  return (doc?.content?.sections || [])
    .filter((section) => !sectionRequirementsMet(section, requirable))
    .map((section) => ({
      id: section.id,
      heading: section.heading || "",
      requires: section.requires || [],
    }));
}
