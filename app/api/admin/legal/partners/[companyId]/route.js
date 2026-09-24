import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { requirePlatformAdmin } from "@lib/adminAuth";
import { applyPendingProfileChanges } from "@/domain/legal/verifiedProfileChanges";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import {
  applyVerificationTransition,
  evaluateProfileCompleteness,
  PARTNER_VERIFICATION_STATUS,
} from "@/domain/legal/partnerVerification";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import { terminateActiveAgreement } from "@/domain/legal/agreementService";
import {
  CHECKOUT_INVALIDATION_REASON,
  invalidateOpenMarketplaceCheckoutSessions,
  shouldInvalidateOnVerificationChange,
} from "@/domain/orders/invalidateMarketplaceCheckout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full profile + signed agreement snapshots for one partner. */
export async function GET(request, { params }) {
  const { errorResponse } = await requirePlatformAdmin(request);
  if (errorResponse) return errorResponse;

  const { companyId: rawId } = await params;
  const companyId = String(rawId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return NextResponse.json(
      { success: false, message: "Invalid companyId" },
      { status: 400 }
    );
  }

  await connectToDB();

  const company = await Company.findById(companyId).select("_id name country").lean();
  if (!company) {
    return NextResponse.json(
      { success: false, message: "Company not found" },
      { status: 404 }
    );
  }

  const [profile, agreements] = await Promise.all([
    PartnerLegalProfile.findOne({ companyId }).lean(),
    PartnerAgreementAcceptance.find({ companyId })
      .sort({ acceptedAt: -1 })
      .lean(),
  ]);

  return NextResponse.json({
    success: true,
    company: {
      companyId: String(company._id),
      companyName: company.name || "",
      country: company.country || "",
    },
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
 * SUSPENDED / REJECTED. A draft can be moved into review; it cannot be
 * approved in place. Invalid transitions are refused. Thin profiles may
 * still be verified once they are pending. This route does not email.
 */
export async function PATCH(request, { params }) {
  const { session, errorResponse } = await requirePlatformAdmin(request);
  if (errorResponse) return errorResponse;

  const { companyId: rawId } = await params;
  const companyId = String(rawId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return NextResponse.json(
      { success: false, message: "Invalid companyId" },
      { status: 400 }
    );
  }

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
  const { ipAddress, userAgent } = extractAuditContext(request);

  if (String(body?.action || "") === "apply_pending_changes") {
    const { applied } = applyPendingProfileChanges(profile);
    await profile.save();
    await recordAuditEvent({
      action: "PARTNER_VERIFICATION_CHANGED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "high",
      ipAddress,
      userAgent,
      metadata: { companyId: String(companyId), appliedPending: applied },
    });
    return NextResponse.json({
      success: true,
      verificationStatus: profile.verificationStatus,
      appliedPending: applied,
    });
  }

  if (String(body?.action || "") === "terminate_agreement") {
    const terminated = await terminateActiveAgreement({
      companyId,
      reason: String(body?.reason || ""),
      byEmail,
      ipAddress,
      userAgent,
    });
    if (!terminated.unchanged) {
      await invalidateOpenMarketplaceCheckoutSessions(companyId, {
        reason: CHECKOUT_INVALIDATION_REASON.AGREEMENT_MISSING,
        actorEmail: byEmail,
        actorRole: "superadmin",
        ipAddress,
        userAgent,
      }).catch((err) => {
        console.error("[partners] checkout invalidate failed", err?.message || err);
      });
    }
    return NextResponse.json({ success: true, ...terminated });
  }

  const nextStatus = String(body?.status || "");
  const reason = String(body?.reason || "").trim();
  if (
    profile.verificationStatus === PARTNER_VERIFICATION_STATUS.DRAFT &&
    nextStatus === PARTNER_VERIFICATION_STATUS.PENDING_VERIFICATION &&
    !reason
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "A reason is required to move a draft into review",
        code: "reason_required",
      },
      { status: 400 }
    );
  }

  if (
    nextStatus === PARTNER_VERIFICATION_STATUS.PENDING_VERIFICATION &&
    !String(profile.legalName || "").trim()
  ) {
    const company = await Company.findById(companyId).select("name").lean();
    const name = String(company?.name || "").trim();
    if (name) profile.legalName = name;
  }

  const result = applyVerificationTransition(profile, {
    to: nextStatus,
    byEmail,
    reason,
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

  if (
    !result.unchanged &&
    result.to === PARTNER_VERIFICATION_STATUS.PENDING_VERIFICATION &&
    !profile.submittedAt
  ) {
    profile.submittedAt = profile.verificationStatusAt || new Date();
  }

  await profile.save();

  await recordAuditEvent({
    action: "PARTNER_VERIFICATION_CHANGED",
    userRole: "superadmin",
    userEmail: byEmail,
    severity: "high",
    ipAddress,
    userAgent,
    reason,
    metadata: {
      companyId: String(companyId),
      from: result.from,
      to: result.to,
    },
  });

  if (
    !result.unchanged &&
    shouldInvalidateOnVerificationChange(result.from, result.to)
  ) {
    const reason =
      result.to === PARTNER_VERIFICATION_STATUS.SUSPENDED
        ? CHECKOUT_INVALIDATION_REASON.SUSPENDED
        : result.to === PARTNER_VERIFICATION_STATUS.REJECTED
          ? CHECKOUT_INVALIDATION_REASON.REJECTED
          : CHECKOUT_INVALIDATION_REASON.PROFILE_NOT_VERIFIED;
    await invalidateOpenMarketplaceCheckoutSessions(companyId, {
      reason,
      actorEmail: byEmail,
      actorRole: "superadmin",
      ipAddress,
      userAgent,
    }).catch((err) => {
      console.error("[partners] checkout invalidate failed", err?.message || err);
    });
  }

  return NextResponse.json({
    success: true,
    verificationStatus: profile.verificationStatus,
  });
}
