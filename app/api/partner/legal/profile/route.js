import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import {
  PARTNER_VERIFICATION_STATUS,
  evaluateProfileCompleteness,
  applyVerificationTransition,
} from "@/domain/legal/partnerVerification";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partner-facing legal profile.
 *
 * A partner admin may only ever read and write the profile of their own
 * company; the company id comes from the session, never from the request
 * body. A superadmin may target another company explicitly.
 */
function resolveCompanyId(session, requested) {
  return resolvePartnerCompanyId(session, requested);
}

/** Fields the partner may set. Verification state is not among them. */
const EDITABLE_FIELDS = [
  "legalName",
  "tradingName",
  "entityType",
  "countryOfRegistration",
  "registrationNumber",
  "nifCif",
  "vatNumber",
  "registeredAddress",
  "businessAddress",
  "signatoryName",
  "signatoryRole",
  "signatoryAuthorityBasis",
  "businessEmail",
  "businessPhone",
  "emergencyPhone",
  "payoutAccountReference",
  "insuranceProvider",
  "insurancePolicyReference",
];

const EDITABLE_BOOLEANS = [
  "signatoryAuthorityConfirmed",
  "vehicleAuthorityConfirmed",
];

export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const companyId = resolveCompanyId(
    session,
    request.nextUrl.searchParams.get("companyId")
  );
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "No partner company is associated with this account" },
      { status: 403 }
    );
  }

  await connectToDB();
  const profile = await PartnerLegalProfile.findOne({ companyId }).lean();

  return NextResponse.json({
    success: true,
    profile: profile || null,
    completeness: profile ? evaluateProfileCompleteness(profile) : null,
    statuses: PARTNER_VERIFICATION_STATUS,
  });
}

/**
 * PUT — create or update the partner's own legal data.
 *
 * Editing a VERIFIED profile moves it back to PENDING_VERIFICATION: changed
 * legal identifiers must be re-checked before the partner keeps trading.
 */
export async function PUT(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const companyId = resolveCompanyId(session, body?.companyId);
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "No partner company is associated with this account" },
      { status: 403 }
    );
  }

  await connectToDB();
  let profile = await PartnerLegalProfile.findOne({ companyId });
  if (!profile) {
    profile = new PartnerLegalProfile({ companyId });
  }

  const wasVerified =
    profile.verificationStatus === PARTNER_VERIFICATION_STATUS.VERIFIED;
  const changed = [];

  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    const value = String(body[field] ?? "").trim();
    if (profile[field] !== value) changed.push(field);
    profile[field] = value;
  }
  for (const field of EDITABLE_BOOLEANS) {
    if (!(field in body)) continue;
    const value = Boolean(body[field]);
    if (profile[field] !== value) changed.push(field);
    profile[field] = value;
  }
  if (body.insuranceValidUntil) {
    profile.insuranceValidUntil = new Date(body.insuranceValidUntil);
    changed.push("insuranceValidUntil");
  }
  if (Array.isArray(body.licences)) {
    profile.licences = body.licences.map((l) => String(l).trim()).filter(Boolean);
    changed.push("licences");
  }

  const email = session.user?.email || "";

  if (profile.verificationStatus === PARTNER_VERIFICATION_STATUS.REJECTED) {
    applyVerificationTransition(profile, {
      to: PARTNER_VERIFICATION_STATUS.DRAFT,
      byEmail: email,
      reason: "Partner updated the profile after rejection",
    });
  }

  if (wasVerified && changed.length) {
    applyVerificationTransition(profile, {
      to: PARTNER_VERIFICATION_STATUS.SUSPENDED,
      byEmail: email,
      reason: `Legal data changed after verification: ${changed.join(", ")}`,
    });
  }

  if (
    body.submitForVerification &&
    profile.verificationStatus === PARTNER_VERIFICATION_STATUS.DRAFT
  ) {
    const transition = applyVerificationTransition(profile, {
      to: PARTNER_VERIFICATION_STATUS.PENDING_VERIFICATION,
      byEmail: email,
    });
    if (!transition.ok) {
      return NextResponse.json(
        { success: false, message: transition.message },
        { status: 409 }
      );
    }
  }

  await profile.save();

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "PARTNER_PROFILE_UPDATED",
    userRole: "admin",
    userEmail: email,
    severity: changed.length ? "medium" : "low",
    ipAddress,
    userAgent,
    metadata: {
      companyId,
      changedFields: changed,
      verificationStatus: profile.verificationStatus,
    },
  });

  return NextResponse.json({
    success: true,
    profile: profile.toObject(),
    completeness: evaluateProfileCompleteness(profile),
  });
}
