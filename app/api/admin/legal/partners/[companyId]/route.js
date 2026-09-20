import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import {
  applyVerificationTransition,
  evaluateProfileCompleteness,
} from "@/domain/legal/partnerVerification";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full profile + signed agreement snapshots for one partner. */
export async function GET(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const { companyId } = await params;
  await connectToDB();

  const [profile, agreements] = await Promise.all([
    PartnerLegalProfile.findOne({ companyId }).lean(),
    PartnerAgreementAcceptance.find({ companyId })
      .sort({ acceptedAt: -1 })
      .lean(),
  ]);

  return NextResponse.json({
    success: true,
    profile: profile || null,
    completeness: profile ? evaluateProfileCompleteness(profile) : null,
    /** Read-only. There is no endpoint that edits a signed snapshot. */
    agreements,
  });
}

/**
 * PATCH { status, reason }
 *
 * Moves the partner through DRAFT → PENDING_VERIFICATION → VERIFIED /
 * SUSPENDED / REJECTED. Invalid transitions and incomplete profiles are
 * refused, so an unverified partner can never be switched on by accident.
 */
export async function PATCH(request, { params }) {
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const { companyId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  await connectToDB();
  const profile = await PartnerLegalProfile.findOne({ companyId });
  if (!profile) {
    return NextResponse.json(
      { success: false, message: "Partner legal profile not found" },
      { status: 404 }
    );
  }

  const byEmail = session.user?.email || "";
  const result = applyVerificationTransition(profile, {
    to: String(body?.status || ""),
    byEmail,
    reason: String(body?.reason || ""),
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        code: result.code,
        completeness: result.completeness,
      },
      { status: 409 }
    );
  }

  await profile.save();

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "PARTNER_VERIFICATION_CHANGED",
    userRole: "superadmin",
    userEmail: byEmail,
    severity: "high",
    ipAddress,
    userAgent,
    reason: body?.reason || "",
    metadata: {
      companyId: String(companyId),
      from: result.from,
      to: result.to,
    },
  });

  return NextResponse.json({
    success: true,
    verificationStatus: profile.verificationStatus,
  });
}
