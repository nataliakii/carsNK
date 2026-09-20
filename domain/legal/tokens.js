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
 */

import {
  getPublicLegalEntity,
  getOperatorLegalDescription,
  getPlatformOperatorSentence,
  getOperatorLine,
} from "@config/legalEntity";

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/**
 * Values available to document content. Only non-sensitive fields — tax
 * identifiers are deliberately absent so they can never leak into a rendered
 * public document.
 *
 * @param {{ settings?: Record<string, unknown>, language?: string }} [opts]
 */
export function buildTokenValues({ settings = {}, language = "en" } = {}) {
  const e = getPublicLegalEntity(language);
  return {
    "operator.legalName": e.ownerLegalName,
    "operator.legalStructure": e.legalStructureLabel,
    "operator.country": e.countryOfEstablishment,
    "operator.tradingName": e.tradingName,
    "operator.platformBrand": e.platformBrand,
    "operator.legalEmail": e.legalEmail,
    "operator.primaryDomain": e.primaryDomain,
    "operator.spanishDomain": e.spanishDomain,
    "operator.businessAddress": e.businessAddress,
    "operator.businessNameNumber": e.businessNameNumber,
    "operator.description": getOperatorLegalDescription(language),
    "operator.platformSentence": getPlatformOperatorSentence(language),
    "operator.footerLine": getOperatorLine(language),
    "operator.dpa": e.dataProtectionAuthority,
    "operator.dpaUrl": e.dataProtectionAuthorityUrl,
    ...Object.fromEntries(
      Object.entries(settings).map(([key, value]) => [
        `settings.${key}`,
        value == null ? "" : String(value),
      ])
    ),
  };
}

/** Configurable values that a section may declare in `requires`. */
export function getRequirableValues() {
  const e = getPublicLegalEntity();
  return {
    businessAddress: e.businessAddress,
    businessNameNumber: e.businessNameNumber,
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
 * @param {{ settings?: Record<string, unknown>, language?: string }} [opts]
 * @returns {{ title: string, sections: Array<{ id: string, heading: string, text: string }> }}
 */
export function renderLegalDocument(doc, { settings = {}, language } = {}) {
  const values = buildTokenValues({
    settings,
    language: language || doc?.language || "en",
  });
  const requirable = getRequirableValues();
  const sections = (doc?.content?.sections || [])
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
 * Sections hidden from output because configuration is incomplete.
 * Used by the superadmin panel only.
 */
export function findSuppressedSections(doc) {
  const requirable = getRequirableValues();
  return (doc?.content?.sections || [])
    .filter((section) => !sectionRequirementsMet(section, requirable))
    .map((section) => ({
      id: section.id,
      heading: section.heading || "",
      requires: section.requires || [],
    }));
}
