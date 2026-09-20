import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveCompanyId(session, requested) {
  return resolvePartnerCompanyId(session, requested);
}

/**
 * GET — the immutable snapshot the partner signed, for reading and for
 * downloading their own copy.
 *
 * The record is returned exactly as stored. There is no write method here,
 * and the model refuses edits to everything but the lifecycle fields, so a
 * signed copy can be shown without any risk of it being altered on the way.
 */
export async function GET(request, { params }) {
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

  const { agreementId } = await params;

  await connectToDB();
  const agreement = await PartnerAgreementAcceptance.findOne({
    agreementId,
    companyId,
  }).lean();

  if (!agreement) {
    return NextResponse.json(
      { success: false, message: "Agreement not found" },
      { status: 404 }
    );
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "PARTNER_AGREEMENT_SNAPSHOT_ACCESSED",
    userRole: "admin",
    userId: session.user?.id,
    userEmail: session.user?.email || "",
    severity: "medium",
    ipAddress,
    userAgent,
    metadata: {
      companyId,
      agreementId: agreement.agreementId,
      packageChecksum: agreement.packageChecksum,
    },
  });

  return NextResponse.json({
    success: true,
    agreement: {
      agreementId: agreement.agreementId,
      partnerLegalName: agreement.partnerLegalName,
      partnerTradingName: agreement.partnerTradingName,
      partnerRegistrationNumber: agreement.partnerRegistrationNumber,
      partnerNifCif: agreement.partnerNifCif,
      signerName: agreement.signerName,
      signerRole: agreement.signerRole,
      signerEmail: agreement.signerEmail,
      confirmationOfAuthority: agreement.confirmationOfAuthority,
      authorityStatement: agreement.authorityStatement,
      documents: agreement.documents,
      packageChecksum: agreement.packageChecksum,
      acceptanceMethod: agreement.acceptanceMethod,
      esignProvider: agreement.esignProvider,
      esignStatus: agreement.esignStatus,
      acceptedAt: agreement.acceptedAt,
      ipAddress: agreement.ipAddress,
      userAgent: agreement.userAgent,
      authenticatedUserId: agreement.authenticatedUserId,
      operatorSnapshot: agreement.operatorSnapshot,
      supersededAt: agreement.supersededAt,
      supersededByAgreementId: agreement.supersededByAgreementId,
      terminatedAt: agreement.terminatedAt,
    },
  });
}
