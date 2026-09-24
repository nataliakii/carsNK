import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { requirePlatformAdmin } from "@lib/adminAuth";
import {
  applyPendingProfileChanges,
  discardPendingProfileChanges,
  pendingProfileChangeSummary,
} from "@/domain/legal/verifiedProfileChanges";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import {
  applyVerificationTransition,
  evaluateProfileCompleteness,
  PARTNER_VERIFICATION_STATUS,
  REJECTION_DECISION,
} from "@/domain/legal/partnerVerification";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import { terminateActiveAgreement } from "@/domain/legal/agreementService";
import {
  CHECKOUT_INVALIDATION_REASON,
  invalidateOpenMarketplaceCheckoutSessions,
  shouldInvalidateOnVerificationChange,
} from "@/domain/orders/invalidateMarketplaceCheckout";
import { buildPartnerReviewReadiness } from "@/domain/legal/partnerReviewReadiness";
import {
  applyDocumentChecked,
  applyDocumentProblem,
  DOCUMENT_REVIEW_STATE,
} from "@/domain/legal/partnerDocumentReview";
import { notifyCompanyLegalReviewDecision } from "@/domain/legal/notifyCompanyLegalReview";
import {
  reviewDisplayStatus,
  reviewDisplayStatusLabel,
} from "@/domain/legal/partnerReviewWorkspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeAuditMetadata(extra = {}) {
  const out = { ...extra };
  delete out.url;
  delete out.signedUrl;
  delete out.storageRef;
  delete out.content;
  delete out.documentContent;
  return out;
}

async function loadCompanyOrError(companyId) {
  const company = await Company.findById(companyId)
    .select("_id name country email listedOnMarketplace")
    .lean();
  if (!company) {
    return {
      error: NextResponse.json(
        { success: false, message: "Company not found" },
        { status: 404 }
      ),
    };
  }
  return { company };
}

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

  const { company, error } = await loadCompanyOrError(companyId);
  if (error) return error;

  const [profile, agreements] = await Promise.all([
    PartnerLegalProfile.findOne({ companyId }).lean(),
    PartnerAgreementAcceptance.find({ companyId })
      .sort({ acceptedAt: -1 })
      .lean(),
  ]);

  const active = (agreements || []).find(
    (a) => !a.supersededAt && !a.terminatedAt
  );
  const readiness = buildPartnerReviewReadiness({
    profile,
    country: company.country || "",
    activeAgreement: active || null,
    agreementHistory: agreements || [],
    listedOnMarketplace: company.listedOnMarketplace !== false,
  });

  return NextResponse.json({
    success: true,
    company: {
      companyId: String(company._id),
      companyName: company.name || "",
      country: company.country || "",
    },
    profile: profile || null,
    completeness: profile ? evaluateProfileCompleteness(profile) : null,
    readiness,
    displayStatus: reviewDisplayStatus(profile),
    displayStatusLabel: reviewDisplayStatusLabel(profile),
    /** Only the fields the partner proposed — the verified values stay live. */
    pendingChanges: pendingProfileChangeSummary(profile),
    /** Read-only. There is no endpoint that edits a signed snapshot. */
    agreements,
  });
}

/**
 * PATCH — company-level review actions and document check/problem.
 *
 * Actions:
 *   review_document | approve | request_changes | reject | suspend |
 *   apply_pending_changes | discard_pending_changes | terminate_agreement |
 *   legacy { status, reason }
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
  const action = String(body?.action || "").trim();

  if (action === "review_document") {
    const kind = String(body?.kind || "").trim();
    const reviewState = String(body?.reviewState || "").trim();
    const doc = (profile.documents || []).find(
      (item) => item.kind === kind && item.storageRef
    );
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Document not found", code: "missing_document" },
        { status: 404 }
      );
    }
    if (reviewState === DOCUMENT_REVIEW_STATE.CHECKED) {
      applyDocumentChecked(doc, { byEmail });
    } else if (reviewState === DOCUMENT_REVIEW_STATE.PROBLEM) {
      const result = applyDocumentProblem(doc, {
        reason: body?.problemReason,
        note: body?.note,
        byEmail,
      });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, message: result.message, code: result.code },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "reviewState must be checked or problem",
          code: "invalid_review_state",
        },
        { status: 400 }
      );
    }
    profile.markModified("documents");
    await profile.save();
    await recordAuditEvent({
      action: "PARTNER_VERIFICATION_CHANGED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "medium",
      ipAddress,
      userAgent,
      metadata: safeAuditMetadata({
        companyId: String(companyId),
        documentKind: kind,
        reviewState,
        problemReason: doc.problemReason || "",
      }),
    });
    const company = await Company.findById(companyId)
      .select("country listedOnMarketplace")
      .lean();
    const agreements = await PartnerAgreementAcceptance.find({ companyId })
      .sort({ acceptedAt: -1 })
      .lean();
    const active = agreements.find((a) => !a.supersededAt && !a.terminatedAt);
    return NextResponse.json({
      success: true,
      document: {
        kind: doc.kind,
        reviewState: doc.reviewState,
        problemReason: doc.problemReason || "",
        note: doc.note || "",
      },
      readiness: buildPartnerReviewReadiness({
        profile: profile.toObject ? profile.toObject() : profile,
        country: company?.country || "",
        activeAgreement: active || null,
        agreementHistory: agreements,
        listedOnMarketplace: company?.listedOnMarketplace !== false,
      }),
    });
  }

  if (action === "apply_pending_changes") {
    const { applied } = applyPendingProfileChanges(profile);
    await profile.save();
    await recordAuditEvent({
      action: "PARTNER_VERIFICATION_CHANGED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "high",
      ipAddress,
      userAgent,
      metadata: safeAuditMetadata({
        companyId: String(companyId),
        appliedPending: applied,
      }),
    });
    return NextResponse.json({
      success: true,
      verificationStatus: profile.verificationStatus,
      appliedPending: applied,
    });
  }

  if (action === "discard_pending_changes") {
    const { discarded } = discardPendingProfileChanges(profile);
    await profile.save();
    await recordAuditEvent({
      action: "PARTNER_VERIFICATION_CHANGED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "high",
      ipAddress,
      userAgent,
      reason: String(body?.reason || ""),
      metadata: safeAuditMetadata({
        companyId: String(companyId),
        discardedPending: discarded,
      }),
    });
    return NextResponse.json({
      success: true,
      verificationStatus: profile.verificationStatus,
      discardedPending: discarded,
    });
  }

  if (action === "terminate_agreement") {
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

  let nextStatus = String(body?.status || "").trim();
  let reason = String(body?.reason || body?.message || "").trim();
  let rejectionDecision = String(body?.rejectionDecision || "").trim();
  let requestedChanges = Array.isArray(body?.requestedChanges)
    ? body.requestedChanges
    : null;
  const internalNote = String(body?.internalNote || "").trim();

  if (action === "approve") {
    nextStatus = PARTNER_VERIFICATION_STATUS.VERIFIED;
    const { company, error } = await loadCompanyOrError(companyId);
    if (error) return error;
    const agreements = await PartnerAgreementAcceptance.find({ companyId })
      .sort({ acceptedAt: -1 })
      .lean();
    const active = agreements.find((a) => !a.supersededAt && !a.terminatedAt);
    const readiness = buildPartnerReviewReadiness({
      profile: profile.toObject ? profile.toObject() : profile,
      country: company.country || "",
      activeAgreement: active || null,
      agreementHistory: agreements,
      listedOnMarketplace: company.listedOnMarketplace !== false,
    });
    if (!readiness.canApprove) {
      return NextResponse.json(
        {
          success: false,
          message: readiness.approveBlockedReasons[0] || "Cannot approve yet",
          code: "not_ready",
          approveBlockedReasons: readiness.approveBlockedReasons,
          missingItems: readiness.missingItems,
        },
        { status: 409 }
      );
    }
  } else if (action === "request_changes") {
    nextStatus = PARTNER_VERIFICATION_STATUS.REJECTED;
    rejectionDecision = REJECTION_DECISION.CHANGES_REQUESTED;
    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message: "A message to the company is required",
          code: "reason_required",
        },
        { status: 400 }
      );
    }
    if (!requestedChanges?.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Select at least one item that needs changes",
          code: "items_required",
        },
        { status: 400 }
      );
    }
  } else if (action === "reject") {
    nextStatus = PARTNER_VERIFICATION_STATUS.REJECTED;
    rejectionDecision = REJECTION_DECISION.REJECTED;
    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message: "A rejection reason is required",
          code: "reason_required",
        },
        { status: 400 }
      );
    }
  } else if (action === "suspend") {
    nextStatus = PARTNER_VERIFICATION_STATUS.SUSPENDED;
    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message: "A suspension reason is required",
          code: "reason_required",
        },
        { status: 400 }
      );
    }
  }

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

  if (
    (nextStatus === PARTNER_VERIFICATION_STATUS.REJECTED ||
      nextStatus === PARTNER_VERIFICATION_STATUS.SUSPENDED) &&
    !reason &&
    !action
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "A reason is required",
        code: "reason_required",
      },
      { status: 400 }
    );
  }

  const result = applyVerificationTransition(profile, {
    to: nextStatus,
    byEmail,
    reason,
    rejectionDecision,
    requestedChanges,
    internalNote,
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
    metadata: safeAuditMetadata({
      companyId: String(companyId),
      from: result.from,
      to: result.to,
      decision: action || rejectionDecision || "",
      rejectionDecision: profile.rejectionDecision || "",
      requestedChangeKeys: (profile.requestedChanges || []).map((item) => item.key),
    }),
  });

  if (
    !result.unchanged &&
    result.to === PARTNER_VERIFICATION_STATUS.REJECTED &&
    (action === "request_changes" || action === "reject")
  ) {
    const company = await Company.findById(companyId).select("name").lean();
    await notifyCompanyLegalReviewDecision({
      companyId,
      companyName: company?.name || profile.legalName || "",
      decision: profile.rejectionDecision || REJECTION_DECISION.REJECTED,
      message: reason,
      items: profile.requestedChanges || [],
    }).catch((err) => {
      console.error("[partners] company notify failed", err?.message || err);
    });
  }

  if (
    !result.unchanged &&
    shouldInvalidateOnVerificationChange(result.from, result.to)
  ) {
    const invalidateReason =
      result.to === PARTNER_VERIFICATION_STATUS.SUSPENDED
        ? CHECKOUT_INVALIDATION_REASON.SUSPENDED
        : result.to === PARTNER_VERIFICATION_STATUS.REJECTED
          ? CHECKOUT_INVALIDATION_REASON.REJECTED
          : CHECKOUT_INVALIDATION_REASON.PROFILE_NOT_VERIFIED;
    await invalidateOpenMarketplaceCheckoutSessions(companyId, {
      reason: invalidateReason,
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
    rejectionDecision: profile.rejectionDecision || "",
    displayStatus: reviewDisplayStatus(profile),
    displayStatusLabel: reviewDisplayStatusLabel(profile),
    verifiedByEmail: profile.verifiedByEmail || "",
    verificationStatusAt: profile.verificationStatusAt || null,
  });
}
