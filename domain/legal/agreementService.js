/**
 * Master Partner Agreement onboarding flow.
 *
 * Sequence enforced here:
 *   1. partner fills in the legal profile and uploads evidence
 *   2. superadmin verifies (partnerVerification)
 *   3. the system builds an immutable agreement snapshot
 *   4. the partner reads the full package
 *   5. the partner confirms the signer's authority
 *   6. the partner ticks an explicit acceptance checkbox
 *   7. the configured e-sign provider records the signature
 *
 * The snapshot is built server-side from published (or, before go-live,
 * built-in draft) document versions. The partner can never influence which
 * version or which text is recorded.
 */

import crypto from "crypto";

import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import { connectToDB } from "@lib/database";
import { getPublicLegalEntity } from "@config/legalEntity";

import {
  LEGAL_PLATFORM,
  MASTER_AGREEMENT_PACKAGE,
  normalizeLegalLanguage,
} from "./documentTypes";
import { resolveDocumentForDisplay } from "./documentService";
import { renderLegalDocument } from "./tokens";
import { computeSnapshotChecksum } from "./checksum";
import { buildDocumentRef } from "./documentKeys";
import { loadLegalSettingsWithTokens } from "./legalSettingsService";
import { resolveEsignProvider } from "./esign";
import {
  PARTNER_VERIFICATION_STATUS,
  canPartnerOperate,
} from "./partnerVerification";
import { recordAuditEvent } from "./auditTrail";

/** Stable, non-guessable public identifier for one agreement instance. */
export function generateAgreementId() {
  return `AGR-${crypto.randomBytes(9).toString("hex").toUpperCase()}`;
}

/**
 * Build the exact package the partner must read and accept.
 *
 * @param {{ language?: string }} [opts]
 * @returns {Promise<{
 *   documents: Array<object>,
 *   packageChecksum: string,
 *   settings: object,
 *   anyDraft: boolean,
 * }>}
 */
export async function buildAgreementPackage({ language = "en" } = {}) {
  const lang = normalizeLegalLanguage(language);
  const { settings, tokens } = await loadLegalSettingsWithTokens({
    language: lang,
  });

  const documents = [];
  let anyDraft = false;

  for (const documentType of MASTER_AGREEMENT_PACKAGE) {
    const { doc, source } = await resolveDocumentForDisplay({
      documentType,
      language: lang,
    });
    if (!doc) continue;
    if (source !== "published") anyDraft = true;

    const rendered = renderLegalDocument(doc, { settings: tokens });
    documents.push({
      documentType: doc.documentType,
      language: doc.language,
      jurisdiction: doc.jurisdiction,
      version: doc.version,
      effectiveFrom: doc.effectiveFrom || null,
      checksum: doc.checksum,
      pk: doc.pk,
      sk: doc.sk,
      ref: buildDocumentRef(doc),
      source,
      renderedTitle: rendered.title,
      renderedSections: rendered.sections,
    });
  }

  return {
    documents,
    packageChecksum: computeSnapshotChecksum(
      documents.map((d) => ({
        documentType: d.documentType,
        language: d.language,
        version: d.version,
        checksum: d.checksum,
        renderedTitle: d.renderedTitle,
        renderedSections: d.renderedSections,
      }))
    ),
    settings,
    anyDraft,
  };
}

/** Wording the partner must explicitly tick. */
export const CLICKWRAP_ACCEPTANCE_STATEMENT =
  "I have read the Partner Agreement, the Partner Operating Rules and the Data Protection Schedule, " +
  "I am authorised to sign on behalf of the company named above, and I accept these documents on its behalf.";

/**
 * Record an acceptance.
 *
 * @param {{
 *   companyId: string,
 *   language?: string,
 *   signerName: string,
 *   signerRole: string,
 *   signerEmail: string,
 *   confirmationOfAuthority: boolean,
 *   acceptedCheckbox: boolean,
 *   authenticatedUserId: string,
 *   ipAddress?: string,
 *   userAgent?: string,
 *   evidenceStorageRef?: string,
 * }} input
 */
export async function acceptMasterAgreement(input) {
  await connectToDB();

  const profile = await PartnerLegalProfile.findOne({
    companyId: input.companyId,
  }).lean();

  if (!profile) {
    return {
      ok: false,
      status: 400,
      code: "no_profile",
      message: "Partner legal profile has not been created",
    };
  }
  if (!canPartnerOperate(profile.verificationStatus)) {
    return {
      ok: false,
      status: 409,
      code: "not_verified",
      message: `Partner must be ${PARTNER_VERIFICATION_STATUS.VERIFIED} before signing the agreement (currently ${profile.verificationStatus})`,
    };
  }

  const pkg = await buildAgreementPackage({ language: input.language });
  if (!pkg.documents.length) {
    return {
      ok: false,
      status: 500,
      code: "no_documents",
      message: "No agreement documents are available",
    };
  }

  const { mode, provider } = resolveEsignProvider(pkg.settings.esignProvider);
  const context = {
    authenticatedUserId: input.authenticatedUserId,
    signerName: input.signerName,
    signerRole: input.signerRole,
    signerEmail: input.signerEmail,
    confirmationOfAuthority: Boolean(input.confirmationOfAuthority),
    acceptedCheckbox: Boolean(input.acceptedCheckbox),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    evidenceStorageRef: input.evidenceStorageRef,
    renderedDocuments: pkg.documents,
  };

  const validation = provider.validate(context);
  if (!validation.ok) {
    return { ok: false, status: 400, ...validation };
  }

  const signature = await provider.sign(context);
  const operator = getPublicLegalEntity();
  const agreementId = generateAgreementId();
  const acceptedAt = new Date();

  const acceptance = await PartnerAgreementAcceptance.create({
    platform: LEGAL_PLATFORM,
    agreementId,
    companyId: input.companyId,
    partnerLegalName: profile.legalName,
    partnerTradingName: profile.tradingName || "",
    partnerRegistrationNumber: profile.registrationNumber || "",
    partnerNifCif: profile.nifCif || "",
    signerName: input.signerName,
    signerRole: input.signerRole,
    signerEmail: String(input.signerEmail || "").toLowerCase(),
    confirmationOfAuthority: Boolean(input.confirmationOfAuthority),
    authorityStatement: CLICKWRAP_ACCEPTANCE_STATEMENT,
    documents: pkg.documents.map((d) => ({
      documentType: d.documentType,
      language: d.language,
      jurisdiction: d.jurisdiction,
      version: d.version,
      checksum: d.checksum,
      pk: d.pk,
      sk: d.sk,
      renderedTitle: d.renderedTitle,
      renderedSections: d.renderedSections,
    })),
    packageChecksum: pkg.packageChecksum,
    acceptanceMethod: signature.acceptanceMethod,
    esignProvider: signature.esignProvider,
    esignEnvelopeId: signature.esignEnvelopeId,
    esignStatus: signature.esignStatus,
    acceptedAt,
    ipAddress: input.ipAddress || "",
    userAgent: input.userAgent || "",
    authenticatedUserId: String(input.authenticatedUserId || ""),
    operatorSnapshot: {
      ownerLegalName: operator.ownerLegalName,
      tradingName: operator.tradingName,
      countryOfEstablishment: operator.countryOfEstablishment,
      platformBrand: operator.platformBrand,
      legalEmail: operator.legalEmail,
      businessAddress: operator.businessAddress,
      businessNameNumber: operator.businessNameNumber,
    },
    settingsSnapshot: pkg.settings,
  });

  // Mark any earlier agreement as superseded (lifecycle field, not an edit).
  await PartnerAgreementAcceptance.updateMany(
    {
      companyId: input.companyId,
      agreementId: { $ne: agreementId },
      supersededAt: null,
    },
    { $set: { supersededAt: acceptedAt, supersededByAgreementId: agreementId } }
  ).catch((err) => {
    console.error("[agreement] supersede failed", err?.message || err);
  });

  await recordAuditEvent({
    action: "PARTNER_AGREEMENT_ACCEPTED",
    userRole: "admin",
    userId: input.authenticatedUserId,
    userEmail: input.signerEmail,
    severity: "critical",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      agreementId,
      companyId: String(input.companyId),
      acceptanceMethod: signature.acceptanceMethod,
      esignMode: mode,
      packageChecksum: pkg.packageChecksum,
      documents: pkg.documents.map((d) => ({
        ref: d.ref,
        checksum: d.checksum,
      })),
    },
  });

  return { ok: true, agreementId, acceptance: acceptance.toObject() };
}

/**
 * The agreement currently in force for a partner, if any.
 * @param {string} companyId
 */
export async function getActiveAgreement(companyId) {
  await connectToDB();
  return PartnerAgreementAcceptance.findOne({
    companyId,
    supersededAt: null,
    terminatedAt: null,
  })
    .sort({ acceptedAt: -1 })
    .lean();
}

/** Full history, newest first. Superadmin view. */
export async function listAgreements(companyId) {
  await connectToDB();
  const filter = companyId ? { companyId } : {};
  return PartnerAgreementAcceptance.find(filter)
    .sort({ acceptedAt: -1 })
    .lean();
}

/**
 * Version reference recorded on each booking so a dispute can be resolved
 * against the exact agreement text in force at the time.
 *
 * @param {string} companyId
 */
export async function getAgreementVersionRef(companyId) {
  const agreement = await getActiveAgreement(companyId);
  if (!agreement) return null;
  return {
    agreementId: agreement.agreementId,
    packageChecksum: agreement.packageChecksum,
    acceptedAt: agreement.acceptedAt,
    documents: (agreement.documents || []).map((d) => ({
      documentType: d.documentType,
      language: d.language,
      version: d.version,
      checksum: d.checksum,
    })),
  };
}
