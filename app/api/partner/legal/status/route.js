import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import {
  buildAgreementPackage,
  getActiveAgreement,
} from "@/domain/legal/agreementService";
import { normalizeLegalLanguage } from "@/domain/legal/documentTypes";
import { evaluatePartnerOperatingGate } from "@/domain/legal/partnerGate";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { evaluateProfileCompleteness } from "@/domain/legal/partnerVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveCompanyId(session, requested) {
  return resolvePartnerCompanyId(session, requested);
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
  const [profile, activeAgreement, pkg] = await Promise.all([
    PartnerLegalProfile.findOne({ companyId }).lean(),
    getActiveAgreement(companyId),
    buildAgreementPackage({ language }),
  ]);

  const completeness = profile ? evaluateProfileCompleteness(profile) : null;
  const gate = evaluatePartnerOperatingGate({
    profile,
    completeness,
    activeAgreement,
    currentPackageChecksum: pkg.packageChecksum,
  });

  return NextResponse.json({
    success: true,
    companyId,
    gate,
    completeness,
    currentPackageChecksum: pkg.packageChecksum,
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
