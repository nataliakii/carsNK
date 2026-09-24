import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { deriveAdminStatus, ADMIN_STATUS } from "@/domain/admin/companyAdmins";
import { rowFromDoc, findCompanyAdminDoc } from "@/domain/admin/companyAdminsService";
import { sendAdminInviteEmailToUser } from "@/domain/auth/sendAdminInviteEmail";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST — resend an outstanding invitation. Superadmin only.
 *
 * Refused once the invitation has been accepted; an active admin gets a
 * password reset instead. Issues a fresh one-time link, never a password.
 */
export async function POST(request, { params }) {
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = params?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return json({ success: false, message: "Invalid user id" }, 400);
  }

  await connectToDB();
  const user = await findCompanyAdminDoc(userId);
  if (!user) {
    return json({ success: false, message: "User not found" }, 404);
  }

  const status = deriveAdminStatus({
    disabledAt: user.disabledAt,
    lastLoginAt: user.lastLoginAt,
    invitedAt: user.invitedAt,
    hasPassword: Boolean(user.password),
  });
  if (status !== ADMIN_STATUS.PENDING) {
    return json(
      {
        success: false,
        message: "This invitation has already been accepted",
        code: "invite_not_pending",
      },
      400
    );
  }

  try {
    const company = user.ownerId
      ? await Company.findById(user.ownerId).select("name").lean()
      : null;
    await sendAdminInviteEmailToUser(user, request, {
      companyName: company?.name || "",
    });
  } catch (err) {
    console.error("[admin invite resend]", err?.message || err);
    return json(
      {
        success: false,
        message: "Could not send the invitation. Check mail settings.",
      },
      500
    );
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "COMPANY_ADMIN_INVITE_RESENT",
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

  return json({ success: true, email: user.email, user: rowFromDoc(user) });
}
