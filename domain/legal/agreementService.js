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
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { getPublicLegalEntity } from "@config/legalEntity";
import { getPlatformMarketplaceFeeSettings } from "@/domain/platform/platformSettingsService";

import {
  LEGAL_PLATFORM,
  MASTER_AGREEMENT_PACKAGE,
  LEGAL_AUTHORITATIVE_LANGUAGE,
  LEGAL_DEFAULT_JURISDICTION,
  normalizeLegalLanguage,
} from "./documentTypes";
import { getPublishedDocument } from "./documentService";
import { renderLegalDocument } from "./tokens";
import { buildDocumentRef } from "./documentKeys";
import { loadLegalSettingsWithTokens } from "./legalSettingsService";
import { resolveEsignProvider } from "./esign";
import { assertAgreementPackageAcceptable } from "./agreementSigning";
import {
  PARTNER_VERIFICATION_STATUS,
  canPartnerOperate,
} from "./partnerVerification";
import { recordAuditEvent } from "./auditTrail";
import {
  freezeCompanyCommercialTerms,
  resolveCompanyCommercialTerms,
} from "./companyCommercialTerms";
import { notifyAgreementAccepted } from "@/domain/mail/notificationPolicy";
import AuditLog from "@models/auditLog";
import {
  orderedPartnerManifest,
  normalizePartnerPackageType,
  partnerDocumentSlug,
  partnerPackageChecksum,
  resolvePartnerLegalState,
} from "./partnerLegalState";

/** Stable, non-guessable public identifier for one agreement instance. */
export function generateAgreementId() {
  return `AGR-${crypto.randomBytes(9).toString("hex").toUpperCase()}`;
}

/**
 * Resolve the commercial terms that apply to one partner company.
 * Returns null when there is no company context to resolve against.
 *
 * @param {string} companyId
 */
export async function loadCompanyCommercialTerms(companyId) {
  const id = String(companyId || "").trim();
  if (!id) return null;
  await connectToDB();
  const [company, platformSettings] = await Promise.all([
    Company.findById(id).select("marketplaceBookingFeeBps").lean(),
    getPlatformMarketplaceFeeSettings(),
  ]);
  if (!company) return null;
  return resolveCompanyCommercialTerms({ company, platformSettings });
}

/**
 * Build the exact package the partner must read and accept.
 *
 * `packageChecksum` covers the rendered shared text and is deliberately
 * company-independent: it is the value that decides whether a partner's
 * acceptance is still current, and an out-of-date acceptance hides the
 * partner's fleet and cancels open checkouts. `commercialTerms` travels beside
 * it so the partner's negotiated percentage can be displayed and frozen
 * without ever entering that checksum.
 *
 * @param {{ language?: string, companyId?: string }} [opts]
 * @returns {Promise<{
 *   documents: Array<object>,
 *   packageChecksum: string,
 *   templateChecksum: string,
 *   settings: object,
 *   commercialTerms: object|null,
 *   anyDraft: boolean,
 * }>}
 */
export async function buildAgreementPackage({
  language = "en",
  companyId = "",
} = {}) {
  const lang = normalizeLegalLanguage(language);
  const [settingsData, commercialTerms] = await Promise.all([
    loadLegalSettingsWithTokens({ language: lang }),
    loadCompanyCommercialTerms(companyId),
  ]);
  const { settings, tokens } = settingsData;
  const sourceDocuments = [];
  const documents = [];
  const missingDocumentTypes = [];

  for (const documentType of MASTER_AGREEMENT_PACKAGE) {
    const source = await getPublishedDocument({
      documentType,
      language: LEGAL_AUTHORITATIVE_LANGUAGE,
      jurisdiction: LEGAL_DEFAULT_JURISDICTION,
    });
    if (
      !source.doc ||
      String(source.doc.status).toLowerCase() !== "published"
    ) {
      missingDocumentTypes.push(documentType);
      continue;
    }
    sourceDocuments.push({ type: documentType, doc: source.doc });

    // Presentation locale is independent of the binding package identity. A
    // published translation may be displayed; otherwise the published source
    // language is displayed and clearly labelled. Drafts are never selected.
    const presented = await getPublishedDocument({
      documentType,
      language: lang,
      jurisdiction: LEGAL_DEFAULT_JURISDICTION,
    });
    const displayDoc =
      presented.doc &&
      String(presented.doc.status).toLowerCase() === "published"
        ? presented.doc
        : source.doc;
    const rendered = renderLegalDocument(displayDoc, { settings: tokens });
    documents.push({
      documentType,
      documentId: String(displayDoc._id),
      presentedDocumentId: String(displayDoc._id),
      bindingDocumentId: String(source.doc._id),
      bindingVersion: source.doc.version,
      bindingChecksum: source.doc.checksum,
      bindingLanguage: source.doc.language,
      language: displayDoc.language,
      requestedLanguage: lang,
      fellBackToSourceLanguage: displayDoc.language !== lang,
      jurisdiction: displayDoc.jurisdiction,
      version: displayDoc.version,
      effectiveFrom: displayDoc.effectiveFrom || null,
      publishedAt: displayDoc.publishedAt || null,
      checksum: displayDoc.checksum,
      pk: displayDoc.pk,
      sk: displayDoc.sk,
      ref: buildDocumentRef(displayDoc),
      source: "published",
      publicationChangeClass: source.doc.publicationChangeClass || "material",
      renderedTitle: rendered.title,
      renderedSections: rendered.sections,
    });
  }

  const manifest = sourceDocuments.map(({ type, doc }) => ({
    type,
    documentId: String(doc._id),
    version: Number(doc.version),
    checksum: String(doc.checksum),
  }));
  const complete =
    missingDocumentTypes.length === 0 &&
    manifest.length === MASTER_AGREEMENT_PACKAGE.length;
  const packageChecksum = complete ? partnerPackageChecksum(manifest) : "";
  return {
    documents,
    manifest: orderedPartnerManifest(manifest),
    packageChecksum,
    templateChecksum: packageChecksum,
    settings,
    commercialTerms,
    anyDraft: !complete,
    complete,
    missingDocumentTypes,
  };
}

/**
 * Single server resolver for the binding package, latest acceptance and legal
 * state. Navbar tasks and the Company Legal page must consume this result.
 */
export async function resolveCurrentPartnerPackage({
  companyId,
  requestedLocale = "en",
  company = null,
  latestAcceptance = undefined,
} = {}) {
  await connectToDB();
  const pkg = await buildAgreementPackage({
    language: requestedLocale,
    companyId,
  });
  const acceptance =
    latestAcceptance === undefined
      ? await getActiveAgreement(companyId)
      : latestAcceptance;

  const mismatchedTypes = pkg.complete
    ? pkg.manifest.filter((current) => {
        const accepted = (acceptance?.documents || []).find(
          (doc) =>
            normalizePartnerPackageType(doc.type || doc.documentType) ===
            current.type
        );
        if (!accepted) return true;
        const acceptedBindingId = String(
          accepted.bindingDocumentId || accepted.documentId || ""
        );
        return (
          (acceptedBindingId && acceptedBindingId !== current.documentId) ||
          Number(accepted.bindingVersion ?? accepted.version) !==
            current.version ||
          String(accepted.bindingChecksum || accepted.checksum || "") !==
            current.checksum
        );
      })
    : [];

  let materialTypes = [];
  if (acceptance && mismatchedTypes.length) {
    const publishedAfterAcceptance = await AuditLog.find({
      action: "LEGAL_DOCUMENT_PUBLISHED",
      createdAt: { $gt: acceptance.acceptedAt },
      "metadata.documentType": {
        $in: mismatchedTypes.map((doc) => partnerDocumentSlug(doc.type)),
      },
      "metadata.language": LEGAL_AUTHORITATIVE_LANGUAGE,
    })
      .select("metadata createdAt")
      .sort({ createdAt: 1 })
      .lean();
    materialTypes = mismatchedTypes
      .filter((current) => {
        const events = publishedAfterAcceptance.filter(
          (event) =>
            event.metadata?.documentType ===
              partnerDocumentSlug(current.type) &&
            Number(event.metadata?.version) <= current.version
        );
        // Missing legacy classification is conservatively material.
        return (
          !events.length ||
          events.some((event) => event.metadata?.changeClass !== "editorial")
        );
      })
      .map((doc) => doc.type);
  }

  const pendingLegalTask = materialTypes.length
    ? { required: true, documentTypes: materialTypes }
    : null;
  const legalState = resolvePartnerLegalState({
    currentPackage: pkg,
    latestAcceptance: acceptance,
    pendingLegalTask,
  });

  return {
    ...pkg,
    latestAcceptance: acceptance || null,
    pendingLegalTask,
    legalState,
    publication:
      legalState.state === "ACCEPTANCE_REQUIRED"
        ? "READY_TO_ACCEPT"
        : legalState.state === "REACCEPTANCE_REQUIRED"
        ? "UPDATE_REQUIRED"
        : legalState.state === "ACCEPTED_CURRENT"
        ? "ACCEPTED"
        : "NOT_PUBLISHED",
    company: company || null,
  };
}

export async function resolveCompanyPartnerLegalState({
  companyId,
  requestedLocale = "en",
} = {}) {
  await connectToDB();
  const [profile, company] = await Promise.all([
    PartnerLegalProfile.findOne({ companyId })
      .select("verificationStatus customAgreement documents")
      .lean(),
    Company.findById(companyId).lean(),
  ]);
  const currentPackage = await resolveCurrentPartnerPackage({
    companyId,
    requestedLocale,
    company,
  });
  return { profile, company, ...currentPackage };
}

/**
 * Immutable copy of the three published documents at the moment of acceptance.
 * Later edits to the live package must not change this array.
 */
export function snapshotAcceptedDocuments(documents) {
  return (Array.isArray(documents) ? documents : []).map((d) => ({
    documentId: d.documentId || d.ref,
    bindingDocumentId: d.bindingDocumentId || d.documentId || d.ref,
    bindingVersion: Number(d.bindingVersion ?? d.version),
    bindingChecksum: d.bindingChecksum || d.checksum,
    presentedDocumentId: d.presentedDocumentId || d.documentId || d.ref,
    presentedVersion: Number(d.version),
    presentedChecksum: d.checksum,
    documentType: d.documentType,
    language: d.language,
    jurisdiction: d.jurisdiction,
    version: d.version,
    checksum: d.checksum,
    pk: d.pk,
    sk: d.sk,
    renderedTitle: d.renderedTitle,
    renderedSections: Array.isArray(d.renderedSections)
      ? d.renderedSections.map((section) => ({ ...section }))
      : [],
  }));
}

/** Wording the partner must explicitly tick. */
export const CLICKWRAP_ACCEPTANCE_STATEMENT =
  "I am authorised to accept the Partner Agreement, Partner Operating Rules and Data Protection Schedule on behalf of the company.";

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

  const built = await buildAgreementPackage({
    language: input.language,
    companyId: input.companyId,
  });
  const pkg = built;
  const packageOk = assertAgreementPackageAcceptable(pkg);
  if (!packageOk.ok) return packageOk;

  // The negotiated percentage is resolved once, here, and frozen below. An
  // unusable stored rate throws: nobody is recorded as agreeing to a
  // percentage the platform cannot state.
  let commercialTermsSnapshot;
  try {
    commercialTermsSnapshot = freezeCompanyCommercialTerms({
      company: await Company.findById(input.companyId)
        .select("marketplaceBookingFeeBps")
        .lean(),
      platformSettings: await getPlatformMarketplaceFeeSettings(),
    });
  } catch (err) {
    return {
      ok: false,
      status: 409,
      code: "commercial_terms_unusable",
      message: err?.message || "The negotiated Rovaro Booking Fee is unusable",
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
    documents: snapshotAcceptedDocuments(pkg.documents),
    manifest: orderedPartnerManifest(pkg.manifest),
    packageChecksum: pkg.packageChecksum,
    templateChecksum: pkg.templateChecksum || "",
    commercialTermsSnapshot,
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
      platform: LEGAL_PLATFORM,
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
      bookingFeeBps: commercialTermsSnapshot.bookingFeeBps,
      bookingFeeRateSource: commercialTermsSnapshot.rateSource,
      commercialTermsChecksum: commercialTermsSnapshot.checksum,
      documents: pkg.documents.map((d) => ({
        ref: d.ref,
        checksum: d.checksum,
      })),
    },
  });

  await notifyAgreementAccepted({
    companyId: String(input.companyId),
    companyName: profile.legalName || profile.tradingName || "",
    agreementId,
    packageChecksum: pkg.packageChecksum,
    actorEmail: input.signerEmail,
    actorName: input.signerName,
    previousStatus: profile.verificationStatus || "",
    newVersion: pkg.packageChecksum,
    timestamp: acceptedAt,
  }).catch((err) => {
    console.error("[agreement] notify failed:", err?.message || err);
  });

  return { ok: true, agreementId, acceptance: acceptance.toObject() };
}

/**
 * Checksum of the currently published (or draft fallback) master package.
 * Company-independent by construction — see {@link buildAgreementPackage}.
 */
export async function getCurrentPackageChecksum(language = "en") {
  const pkg = await buildAgreementPackage({ language });
  return pkg.packageChecksum || "";
}

/**
 * The agreement currently in force for a partner, if any.
 * @param {string} companyId
 */
export async function getActiveAgreement(companyId) {
  await connectToDB();
  return PartnerAgreementAcceptance.findOne({
    platform: LEGAL_PLATFORM,
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
  const filter = companyId
    ? { platform: LEGAL_PLATFORM, companyId }
    : { platform: LEGAL_PLATFORM };
  return PartnerAgreementAcceptance.find(filter)
    .sort({ acceptedAt: -1 })
    .lean();
}

/**
 * Superadmin lifecycle marker. Does not edit the signed snapshot.
 */
export async function terminateActiveAgreement({
  companyId,
  reason = "",
  byEmail = "",
  ipAddress = "",
  userAgent = "",
} = {}) {
  await connectToDB();
  const active = await PartnerAgreementAcceptance.findOne({
    platform: LEGAL_PLATFORM,
    companyId,
    supersededAt: null,
    terminatedAt: null,
  }).sort({ acceptedAt: -1 });
  if (!active) {
    return { ok: true, unchanged: true };
  }
  const now = new Date();
  active.terminatedAt = now;
  active.terminationReason = String(reason || "").slice(0, 1000);
  await active.save();
  await recordAuditEvent({
    action: "PARTNER_AGREEMENT_TERMINATED",
    userRole: "superadmin",
    userEmail: byEmail,
    severity: "critical",
    ipAddress,
    userAgent,
    reason: String(reason || "").slice(0, 1000),
    metadata: {
      companyId: String(companyId),
      agreementId: active.agreementId,
      packageChecksum: active.packageChecksum,
    },
  });
  return {
    ok: true,
    unchanged: false,
    agreementId: active.agreementId,
    companyId: String(companyId),
  };
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
    templateChecksum: agreement.templateChecksum || "",
    /** The percentage this partner actually agreed to, frozen at signing. */
    commercialTerms: agreement.commercialTermsSnapshot || null,
    acceptedAt: agreement.acceptedAt,
    documents: (agreement.documents || []).map((d) => ({
      documentType: d.documentType,
      language: d.language,
      version: d.version,
      checksum: d.checksum,
    })),
  };
}
