/**
 * Central document-requirements config for partner KYB review.
 *
 * Every document kind is Required, Optional, or Not applicable for a given
 * country + company/service type. Optional uploads never count as missing and
 * never block Approve company.
 */

import {
  ALL_PARTNER_DOCUMENT_KINDS,
  PARTNER_DOCUMENT_KIND,
} from "./partnerDocuments";

export const DOCUMENT_REQUIREMENT = Object.freeze({
  REQUIRED: "required",
  OPTIONAL: "optional",
  NOT_APPLICABLE: "not_applicable",
});

const R = DOCUMENT_REQUIREMENT;
const K = PARTNER_DOCUMENT_KIND;

/** Default when no country-specific rule matches. All evidence is optional. */
const DEFAULT_REQUIREMENTS = Object.freeze({
  [K.COMPANY_REGISTRATION]: R.OPTIONAL,
  [K.INSURANCE_CERTIFICATE]: R.OPTIONAL,
  [K.VEHICLE_AUTHORITY]: R.OPTIONAL,
  [K.TAX_IDENTIFICATION]: R.OPTIONAL,
  [K.VAT_CERTIFICATE]: R.OPTIONAL,
  [K.LICENCE_PERMIT]: R.OPTIONAL,
  [K.PAYOUT_BANK_PROOF]: R.OPTIONAL,
  [K.SIGNATORY_AUTHORITY]: R.OPTIONAL,
});

/**
 * Country overrides. Add kinds as Required only when operational policy
 * actually needs them before Approve. Optional never blocks.
 */
const BY_COUNTRY = Object.freeze({
  ES: DEFAULT_REQUIREMENTS,
  GR: DEFAULT_REQUIREMENTS,
});

/**
 * Optional service-type overlays (fleet rental vs transfers). Empty today —
 * kept so a future rule can flip one kind without rewriting callers.
 */
const BY_SERVICE_TYPE = Object.freeze({
  fleet: Object.freeze({}),
  transfer: Object.freeze({}),
});

function normalizeCountry(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

function normalizeServiceType(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "transfer" || raw === "transfers") return "transfer";
  if (raw === "fleet" || raw === "rental" || raw === "cars") return "fleet";
  return "";
}

/**
 * Resolve the requirement map for one company context.
 *
 * @param {{
 *   country?: string,
 *   entityType?: string,
 *   serviceType?: string,
 *   overrides?: Record<string, string>,
 * }} [input]
 * @returns {Record<string, string>} kind → required | optional | not_applicable
 */
export function resolveDocumentRequirements({
  country = "",
  entityType: _entityType = "",
  serviceType = "",
  overrides = null,
} = {}) {
  const base = { ...(BY_COUNTRY[normalizeCountry(country)] || DEFAULT_REQUIREMENTS) };
  const serviceOverlay = BY_SERVICE_TYPE[normalizeServiceType(serviceType)] || {};
  Object.assign(base, serviceOverlay);
  if (overrides && typeof overrides === "object") {
    for (const [kind, level] of Object.entries(overrides)) {
      if (ALL_PARTNER_DOCUMENT_KINDS.includes(kind) && Object.values(R).includes(level)) {
        base[kind] = level;
      }
    }
  }
  return base;
}

export function requirementForKind(kind, requirements) {
  const level = requirements?.[kind];
  if (level === R.REQUIRED || level === R.OPTIONAL || level === R.NOT_APPLICABLE) {
    return level;
  }
  return R.OPTIONAL;
}

export function isRequiredDocumentKind(kind, requirements) {
  return requirementForKind(kind, requirements) === R.REQUIRED;
}

export function isOptionalDocumentKind(kind, requirements) {
  return requirementForKind(kind, requirements) === R.OPTIONAL;
}

export function isApplicableDocumentKind(kind, requirements) {
  return requirementForKind(kind, requirements) !== R.NOT_APPLICABLE;
}

/** Kinds the reviewer must see uploaded before Approve may be enabled. */
export function listRequiredDocumentKinds(requirements) {
  return ALL_PARTNER_DOCUMENT_KINDS.filter((kind) =>
    isRequiredDocumentKind(kind, requirements)
  );
}

/** Kinds shown as optional evidence rows (not N/A). */
export function listOptionalDocumentKinds(requirements) {
  return ALL_PARTNER_DOCUMENT_KINDS.filter((kind) =>
    isOptionalDocumentKind(kind, requirements)
  );
}

/** Rows the Documents checklist should render (required + optional, skip N/A). */
export function listReviewDocumentKinds(requirements) {
  return ALL_PARTNER_DOCUMENT_KINDS.filter((kind) =>
    isApplicableDocumentKind(kind, requirements)
  );
}
