import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { findCompanyAdminDoc } from "@/domain/admin/companyAdminsService";
import {
  adminPasswordResetRateLimitKey,
  adminPasswordResetRateLimitOptions,
} from "@/domain/admin/companyAdmins";
import { sendPasswordResetEmailToUser } from "@/domain/auth/sendPasswordResetEmail";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import { consumeFor } from "@/services/rateLimitService";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST — superadmin sends a reset link to ANOTHER admin's current email.
 *
 * The recipient is always the stored address of the user in the path; the body
 * is ignored. Reuses the shared reset-token helper, so expiry semantics match
 * self-service. The response carries the recipient address only — never a
 * password, a hash or the raw token.
 *
 * Rate-limited per (actor, target). Does not share a bucket with
 * /api/admin/account/send-password-reset.
 */
export async function POST(request, { params }) {
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = params?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return json({ success: false, message: "Invalid user id" }, 400);
  }

  try {
    await connectToDB();

    try {
      await consumeFor(
        adminPasswordResetRateLimitKey({
          actorId: session.user?.id || session.user?.email,
          targetUserId: userId,
        }),
        adminPasswordResetRateLimitOptions()
      );
    } catch (err) {
      if (err && err.message === "RATE_LIMIT") {
        return json(
          {
            success: false,
            message: "Too many password reset emails. Try again later.",
            errors: { reset: "admin.partnerAdmins.errors.rateLimited" },
            code: "RATE_LIMIT",
          },
          429
        );
      }
      throw err;
    }

    const user = await findCompanyAdminDoc(userId);
    if (!user) {
      return json({ success: false, message: "User not found" }, 404);
    }

    await sendPasswordResetEmailToUser(user, request);

    const { ipAddress, userAgent } = extractAuditContext(request);
    await recordAuditEvent({
      action: "COMPANY_ADMIN_PASSWORD_RESET_SENT",
      userRole: "superadmin",
      userEmail: session.user?.email || "",
      metadata: {
        targetUserId: String(user._id),
        targetEmail: user.email,
        companyId: user.ownerId ? String(user.ownerId) : "",
      },
      ipAddress,
      userAgent,
    });

    return json({
      success: true,
      email: user.email,
      message: `Password reset email sent to ${user.email}.`,
    });
  } catch (err) {
    console.error("[admin reset-password]", err?.message || err);
    return json(
      {
        success: false,
        message: "Could not send reset email. Check mail settings.",
      },
      500
    );
  }
}
