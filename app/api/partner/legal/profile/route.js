import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import {
  PARTNER_VERIFICATION_STATUS,
  evaluateProfileCompleteness,
  applyVerificationTransition,
} from "@/domain/legal/partnerVerification";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { ownCompanyScope } from "@/domain/legal/companyLegalPage";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import { absoluteUrl } from "@config/domain";
import { planVerifiedProfileSave } from "@/domain/legal/verifiedProfileChanges";

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
  const scope = ownCompanyScope(session, requested);
  if (scope.forbidden) return "";
  return scope.companyId || resolvePartnerCompanyId(session, requested);
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
    companyId,
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

  const company = await Company.findById(companyId).select("name").lean();

  const patch = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    patch[field] = String(body[field] ?? "").trim();
  }
  for (const field of EDITABLE_BOOLEANS) {
    if (!(field in body)) continue;
    patch[field] = Boolean(body[field]);
  }
  if (body.insuranceValidUntil) {
    patch.insuranceValidUntil = new Date(body.insuranceValidUntil);
  }
  if (Array.isArray(body.licences)) {
    patch.licences = body.licences.map((l) => String(l).trim()).filter(Boolean);
  }

  const plan = planVerifiedProfileSave(profile, patch);
  const changed = [
    ...Object.keys(plan.applyNow),
    ...Object.keys(plan.pending || {}),
  ];
  for (const [field, value] of Object.entries(plan.applyNow)) {
    profile[field] = value;
  }
  if (plan.pending) {
    profile.pendingChanges = {
      fields: { ...(profile.pendingChanges?.fields || {}), ...plan.pending },
      submittedAt: new Date(),
      submittedByEmail: session.user?.email || "",
    };
  }

  const email = session.user?.email || "";
  let submittedForReview = false;

  if (profile.verificationStatus === PARTNER_VERIFICATION_STATUS.REJECTED) {
    applyVerificationTransition(profile, {
      to: PARTNER_VERIFICATION_STATUS.DRAFT,
      byEmail: email,
      reason: "Partner updated the profile after rejection",
    });
  }

  if (
    body.submitForVerification &&
    profile.verificationStatus === PARTNER_VERIFICATION_STATUS.DRAFT
  ) {
    // Thin KYB is allowed: fill legalName from company name when the partner
    // submitted evidence but left the identity field blank.
    if (!String(profile.legalName || "").trim() && company?.name) {
      profile.legalName = String(company.name).trim();
      if (!changed.includes("legalName")) changed.push("legalName");
    }

    const transition = applyVerificationTransition(profile, {
      to: PARTNER_VERIFICATION_STATUS.PENDING_VERIFICATION,
      byEmail: email,
      reason: "Partner submitted profile for review",
    });
    if (!transition.ok) {
      return NextResponse.json(
        { success: false, message: transition.message },
        { status: 409 }
      );
    }
    if (!profile.submittedAt) {
      profile.submittedAt = profile.verificationStatusAt || new Date();
    }
    submittedForReview = true;
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

  if (submittedForReview) {
    try {
      await notifySuperadmin({
        title: `📋 Partner submitted legal profile for review — ${profile.legalName || companyId}`,
        bodyLines: [
          `Company ID: ${companyId}`,
          `Legal name: ${profile.legalName || "—"}`,
          `Status: ${profile.verificationStatus}`,
          `Submitted by: ${email}`,
          changed.length ? `Changed fields: ${changed.join(", ")}` : null,
          `Review: ${absoluteUrl(`/admin/partners?tab=review&companyId=${encodeURIComponent(companyId)}`)}`,
        ].filter(Boolean),
      });
    } catch (err) {
      console.error(
        "[partner-profile] superadmin notify failed:",
        err?.message || err
      );
    }
  }

  return NextResponse.json({
    success: true,
    profile: profile.toObject(),
    completeness: evaluateProfileCompleteness(profile),
  });
}
