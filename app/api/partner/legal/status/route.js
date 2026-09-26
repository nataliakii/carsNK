import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import Company from "@models/company";
import { resolveCurrentPartnerPackage } from "@/domain/legal/agreementService";
import { normalizeLegalLanguage } from "@/domain/legal/documentTypes";
import { evaluatePartnerOperatingGate } from "@/domain/legal/partnerGate";
import { ownCompanyScope } from "@/domain/legal/companyLegalPage";
import { companySetupReadiness } from "@/domain/legal/companySetupReadiness";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { evaluateProfileCompleteness } from "@/domain/legal/partnerVerification";
import { partnerLegalStateToPublication } from "@/domain/legal/partnerLegalState";
import { CLICKWRAP_ACCEPTANCE_STATEMENT } from "@/domain/legal/agreementService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PARTNER_DOCUMENT_HREFS = Object.freeze({
  "partner-agreement": "/partner-agreement",
  "partner-operating-rules": "/partner-operating-rules",
  "data-protection-schedule": "/data-protection-schedule",
});

function resolveCompanyId(session, requested) {
  const scope = ownCompanyScope(session, requested);
  if (scope.forbidden) return "";
  return scope.companyId || resolvePartnerCompanyId(session, requested);
}

/**
 * GET — compliance summary for the partner area.
 *
 * Exists so the UI can render one server-computed answer to "may I trade?"
 * instead of re-deriving the rule from separate profile and agreement calls.
 * Unlike the agreement endpoint this is a cheap status poll and deliberately
 * writes no audit entry: it is not a view of the agreement text.
 */
export async function GET(request) {
  try {
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const companyId = resolveCompanyId(
      session,
      request.nextUrl.searchParams.get("companyId")
    );
    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "No partner company is associated with this account",
        },
        { status: 403 }
      );
    }

    const language = normalizeLegalLanguage(
      request.nextUrl.searchParams.get("lang")
    );

    await connectToDB();
    const [profile, pkg, company] = await Promise.all([
      PartnerLegalProfile.findOne({ companyId }).lean(),
      resolveCurrentPartnerPackage({ companyId, requestedLocale: language }),
      Company.findById(companyId)
        .select("listedOnMarketplace country bookingMode")
        .lean(),
    ]);

    const activeAgreement = pkg.latestAcceptance;
    const publicationValue = partnerLegalStateToPublication(pkg.legalState.state);
    const completeness = profile ? evaluateProfileCompleteness(profile) : null;
    const gate = evaluatePartnerOperatingGate({
      profile,
      completeness,
      activeAgreement,
      currentPackageChecksum: pkg.packageChecksum,
      legalState: pkg.legalState.state,
    });

    const listedOnMarketplace = company?.listedOnMarketplace !== false;
    const readiness = companySetupReadiness({
      profile,
      completeness,
      termsPublication: publicationValue,
      listedOnMarketplace,
      agreementAccepted: publicationValue === "ACCEPTED",
    });

    return NextResponse.json({
      success: true,
      companyId,
      gate,
      completeness,
      listedOnMarketplace,
      canListPublicly: readiness.canReceiveBookings,
      readiness,
      /**
       * The one publication state. The Terms tab, the Documents tab and the
       * readiness gate above all read this value; no client re-derives it.
       */
      legalState: pkg.legalState.state,
      legalActionCount: pkg.legalState.legalActionCount,
      legalManifest: pkg.manifest,
      missingDocumentTypes: pkg.legalState.missingDocumentTypes,
      changedDocumentTypes: pkg.legalState.changedDocumentTypes || [],
      termsPublication: publicationValue,
      terms: {
        publication: publicationValue,
        canAccept:
          pkg.legalState.state === "ACCEPTANCE_REQUIRED" ||
          pkg.legalState.state === "REACCEPTANCE_REQUIRED",
        links: pkg.documents.map((doc) => ({
          documentType: doc.documentType,
          href: PARTNER_DOCUMENT_HREFS[doc.documentType] || "",
        })),
        label: "standard",
        message:
          pkg.legalState.state === "ACCEPTANCE_REQUIRED"
            ? "ready"
            : pkg.legalState.state === "REACCEPTANCE_REQUIRED"
              ? "updated"
              : pkg.legalState.state === "ACCEPTED_CURRENT"
                ? "accepted"
                : "preparing",
      },
      currentPackageChecksum: pkg.packageChecksum,
      manifest: pkg.manifest,
      documents: pkg.documents.map((doc) => ({
        documentType: doc.documentType,
        documentId: doc.documentId,
        version: doc.version,
        presentedVersion: doc.version,
        checksum: doc.checksum,
        bindingDocumentId: doc.bindingDocumentId,
        bindingVersion: doc.bindingVersion,
        bindingChecksum: doc.bindingChecksum,
        language: doc.language,
        requestedLanguage: doc.requestedLanguage,
        fellBackToSourceLanguage: doc.fellBackToSourceLanguage,
        publicationChangeClass: doc.publicationChangeClass,
        publishedAt: doc.publishedAt,
        ref: doc.ref,
        title: doc.renderedTitle,
        sections: doc.renderedSections,
      })),
      acceptanceStatement: CLICKWRAP_ACCEPTANCE_STATEMENT,
      containsDrafts: pkg.anyDraft,
      signedAgreement: activeAgreement
        ? {
            agreementId: activeAgreement.agreementId,
            acceptedAt: activeAgreement.acceptedAt,
            packageChecksum: activeAgreement.packageChecksum,
            manifest: activeAgreement.manifest || [],
            documents: (activeAgreement.documents || []).map((doc) => ({
              documentType: doc.documentType,
              documentId: doc.bindingDocumentId || doc.documentId || "",
              version: doc.bindingVersion || doc.version,
              checksum: doc.bindingChecksum || doc.checksum,
              language: doc.language,
              presentedVersion: doc.presentedVersion || doc.version,
              presentedChecksum: doc.presentedChecksum || doc.checksum,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error("[partner/legal/status]", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Could not load legal package status",
      },
      { status: 500 }
    );
  }
}
