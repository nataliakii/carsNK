/**
 * Company-level review readiness for the superadmin Legal review tab.
 *
 * Documents are supporting evidence. Final decisions approve / request changes /
 * reject the company as one application. Optional documents never block.
 */

import {
  REQUIRED_PROFILE_FIELDS,
  evaluateProfileCompleteness,
} from "./partnerVerification";
import {
  DOCUMENT_REQUIREMENT,
  listOptionalDocumentKinds,
  listRequiredDocumentKinds,
  listReviewDocumentKinds,
  requirementForKind,
  resolveDocumentRequirements,
} from "./partnerDocumentRequirements";
import {
  DOCUMENT_REVIEW_STATE,
  documentProblemLabel,
  resolveDocumentReviewState,
} from "./partnerDocumentReview";
import { agreementDisplayStatus } from "./partnerReviewWorkspace";

/** Human labels for required profile fields (exact missing copy). */
export const PROFILE_FIELD_LABEL = Object.freeze({
  legalName: "Legal name",
  tradingName: "Trading name",
  nifCif: "Tax ID (NIF/CIF)",
  registrationNumber: "Registration number",
  signatoryName: "Signatory name",
  businessEmail: "Business email",
  registeredAddress: "Registered address",
  insuranceProvider: "Insurance provider",
});

/** Human labels for document kinds. */
export const DOCUMENT_KIND_LABEL = Object.freeze({
  company_registration: "Company registration extract",
  insurance_certificate: "Insurance certificate",
  vehicle_authority: "Proof of authority to rent the vehicles",
  tax_identification: "Tax identification",
  vat_certificate: "VAT certificate",
  licence_permit: "Licence or permit",
  payout_bank_proof: "Payout bank proof",
  signatory_authority: "Signatory authority",
});

export function labelForField(key) {
  return PROFILE_FIELD_LABEL[key] || key;
}

export function labelForDocumentKind(kind) {
  return DOCUMENT_KIND_LABEL[kind] || kind;
}

function uploadedDocs(profile) {
  return (profile?.documents || []).filter((doc) => doc && doc.storageRef);
}

function docsByKind(profile) {
  const map = new Map();
  for (const doc of uploadedDocs(profile)) {
    map.set(doc.kind, doc);
  }
  return map;
}

function platformAgreementState({ activeAgreement, agreementHistory }) {
  const status = agreementDisplayStatus({
    active: activeAgreement,
    history: agreementHistory || [],
  });
  if (status === "current" || status === "outdated") return "accepted";
  if (status === "terminated") return "not_accepted";
  return "not_available";
}

function rentalTermsState(profile) {
  const custom = profile?.customAgreement;
  if (custom && String(custom.documentId || "").trim()) return "added";
  return "standard";
}

/**
 * Build the full review-readiness summary for one company application.
 *
 * @param {{
 *   profile?: object|null,
 *   country?: string,
 *   entityType?: string,
 *   serviceType?: string,
 *   requirementOverrides?: Record<string, string>|null,
 *   activeAgreement?: object|null,
 *   agreementHistory?: object[],
 *   listedOnMarketplace?: boolean,
 * }} input
 */
export function buildPartnerReviewReadiness({
  profile = null,
  country = "",
  entityType = "",
  serviceType = "",
  requirementOverrides = null,
  activeAgreement = null,
  agreementHistory = [],
  listedOnMarketplace = true,
} = {}) {
  const requirements = resolveDocumentRequirements({
    country: country || profile?.countryOfRegistration || "",
    entityType: entityType || profile?.entityType || "",
    serviceType,
    overrides: requirementOverrides,
  });

  const completeness = evaluateProfileCompleteness(profile);
  const missingRequiredFields = [...(completeness.missingFields || [])];
  const byKind = docsByKind(profile);
  const requiredKinds = listRequiredDocumentKinds(requirements);
  const optionalKinds = listOptionalDocumentKinds(requirements);
  const reviewKinds = listReviewDocumentKinds(requirements);

  const missingRequiredDocuments = requiredKinds.filter((kind) => !byKind.has(kind));
  const optionalUploaded = optionalKinds.filter((kind) => byKind.has(kind));

  const documentProblems = [];
  for (const kind of reviewKinds) {
    const doc = byKind.get(kind);
    if (!doc) continue;
    if (resolveDocumentReviewState(doc) === DOCUMENT_REVIEW_STATE.PROBLEM) {
      documentProblems.push({
        kind,
        label: labelForDocumentKind(kind),
        reason: documentProblemLabel(doc) || "Problem found",
        problemReason: String(doc.problemReason || ""),
      });
    }
  }

  const missingItems = [
    ...missingRequiredFields.map((key) => ({
      type: "field",
      key,
      label: labelForField(key),
    })),
    ...missingRequiredDocuments.map((kind) => ({
      type: "document",
      key: kind,
      label: labelForDocumentKind(kind),
    })),
    ...documentProblems.map((problem) => ({
      type: "document_problem",
      key: problem.kind,
      label: `${problem.label}: ${problem.reason}`,
    })),
  ];

  const companyDetailsComplete = missingRequiredFields.length === 0;
  const requiredDocumentsComplete = missingRequiredDocuments.length === 0;
  const canApprove = missingItems.length === 0;

  const approveBlockedReasons = [];
  for (const field of missingRequiredFields) {
    approveBlockedReasons.push(
      `${labelForField(field)} is required and missing.`
    );
  }
  for (const kind of missingRequiredDocuments) {
    approveBlockedReasons.push(
      `${labelForDocumentKind(kind)} is required and missing.`
    );
  }
  for (const problem of documentProblems) {
    approveBlockedReasons.push(
      `${problem.label} has a problem: ${problem.reason}.`
    );
  }

  const agreement = platformAgreementState({ activeAgreement, agreementHistory });
  const rentalTerms = rentalTermsState(profile);

  const documents = reviewKinds.map((kind) => {
    const doc = byKind.get(kind) || null;
    const level = requirementForKind(kind, requirements);
    return {
      kind,
      label: labelForDocumentKind(kind),
      requirement: level,
      required: level === DOCUMENT_REQUIREMENT.REQUIRED,
      uploaded: Boolean(doc),
      filename: doc?.label || "",
      uploadedAt: doc?.uploadedAt || null,
      uploadedByUserId: doc?.uploadedByUserId || "",
      uploadedByEmail: doc?.uploadedByEmail || "",
      reviewState: doc
        ? resolveDocumentReviewState(doc)
        : DOCUMENT_REVIEW_STATE.NOT_CHECKED,
      problemReason: doc?.problemReason || "",
      note: doc?.note || "",
      reviewedAt: doc?.reviewedAt || null,
      reviewedByEmail: doc?.reviewedByEmail || "",
    };
  });

  return {
    requirements,
    companyDetails: {
      complete: companyDetailsComplete,
      missingFields: missingRequiredFields.map((key) => ({
        key,
        label: labelForField(key),
      })),
    },
    requiredDocuments: {
      requiredCount: requiredKinds.length,
      missingCount: missingRequiredDocuments.length,
      complete: requiredDocumentsComplete,
      noneRequired: requiredKinds.length === 0,
      missing: missingRequiredDocuments.map((kind) => ({
        kind,
        label: labelForDocumentKind(kind),
      })),
    },
    optionalDocuments: {
      uploadedCount: optionalUploaded.length,
      kinds: optionalUploaded,
    },
    platformAgreement: agreement,
    rentalTerms,
    listedOnMarketplace: listedOnMarketplace !== false,
    documentProblems,
    missingItems,
    canApprove,
    approveBlockedReasons,
    readyCopy: canApprove
      ? "Ready for your decision."
      : "Cannot be approved yet. The company still needs to provide:",
    documents,
  };
}

/**
 * Checklist items for the Request changes modal, seeded from readiness.
 */
export function requestChangesChecklistFromReadiness(readiness) {
  const items = [];
  for (const field of readiness?.companyDetails?.missingFields || []) {
    items.push({ type: "field", key: field.key, label: field.label, selected: true });
  }
  for (const doc of readiness?.requiredDocuments?.missing || []) {
    items.push({ type: "document", key: doc.kind, label: doc.label, selected: true });
  }
  for (const problem of readiness?.documentProblems || []) {
    items.push({
      type: "document_problem",
      key: problem.kind,
      label: `${problem.label}: ${problem.reason}`,
      selected: true,
    });
  }
  return items;
}
