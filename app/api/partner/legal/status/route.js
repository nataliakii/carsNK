import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import Company from "@models/company";
import {
  buildAgreementPackage,
  getActiveAgreement,
} from "@/domain/legal/agreementService";
import { normalizeLegalLanguage } from "@/domain/legal/documentTypes";
import { evaluatePartnerOperatingGate } from "@/domain/legal/partnerGate";
import {
  companyTermsPublication,
  ownCompanyScope,
  withCustomAgreement,
} from "@/domain/legal/companyLegalPage";
import { companySetupReadiness } from "@/domain/legal/companySetupReadiness";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { evaluateProfileCompleteness } from "@/domain/legal/partnerVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const [profile, activeAgreement, pkg, company] = await Promise.all([
    PartnerLegalProfile.findOne({ companyId }).lean(),
    getActiveAgreement(companyId),
    buildAgreementPackage({ language }),
    Company.findById(companyId)
      .select("listedOnMarketplace country bookingMode")
      .lean(),
  ]);

  const terms = withCustomAgreement(pkg, profile?.customAgreement);
  const completeness = profile ? evaluateProfileCompleteness(profile) : null;
  const gate = evaluatePartnerOperatingGate({
    profile,
    completeness,
    activeAgreement,
    currentPackageChecksum: terms.packageChecksum,
  });

  const listedOnMarketplace = company?.listedOnMarketplace !== false;
  const publication = companyTermsPublication({
    documents: terms.documents || [],
    containsDrafts: Boolean(pkg.anyDraft),
    activeChecksum: activeAgreement?.packageChecksum || "",
    currentChecksum: terms.packageChecksum || "",
  });
  const readiness = companySetupReadiness({
    profile,
    completeness,
    termsPublication: publication.publication,
    listedOnMarketplace,
    agreementAccepted: publication.publication === "ACCEPTED",
  });

  return NextResponse.json({
    success: true,
    companyId,
    gate,
    completeness,
    listedOnMarketplace,
    canListPublicly: readiness.canReceiveBookings,
    readiness,
    currentPackageChecksum: terms.packageChecksum,
    containsDrafts: pkg.anyDraft,
    signedAgreement: activeAgreement
      ? {
          agreementId: activeAgreement.agreementId,
          acceptedAt: activeAgreement.acceptedAt,
          packageChecksum: activeAgreement.packageChecksum,
        }
      : null,
  });
}
