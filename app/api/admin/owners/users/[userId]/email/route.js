import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { validateEmailChangeInput } from "@/domain/admin/companyAdmins";
import {
  isEmailTaken,
  rowFromDoc,
  findCompanyAdminDoc,
} from "@/domain/admin/companyAdminsService";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST — change an admin's LOGIN email. Superadmin only.
 *
 * Body: { email, confirmEmail }
 *
 * The two fields must match, and the address must be free across all users
 * (case-insensitive). A collision answers 409 with a translatable error key,
 * never a 500. Security-sensitive, so it writes an audit event.
 */
export async function POST(request, { params }) {
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = params?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return json({ success: false, message: "Invalid user id" }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  await connectToDB();
  const user = await findCompanyAdminDoc(userId);
  if (!user) {
    return json({ success: false, message: "User not found" }, 404);
  }

  const { valid, errors, value } = validateEmailChangeInput({
    email: body?.email,
    confirmEmail: body?.confirmEmail,
    currentEmail: user.email,
  });
  if (!valid) {
    return json({ success: false, message: "Invalid email", errors }, 400);
  }

  if (await isEmailTaken(value.email, user._id)) {
    return json(
      {
        success: false,
        message: "This email already belongs to another user",
        errors: { email: "admin.partnerAdmins.errors.emailTaken" },
      },
      409
    );
  }

  const previousEmail = user.email;
  user.email = value.email;
  await user.save();

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "COMPANY_ADMIN_EMAIL_CHANGED",
    userRole: "superadmin",
    userEmail: session.user?.email || "",
    severity: "high",
    metadata: {
      targetUserId: String(user._id),
      previousEmail,
      newEmail: user.email,
      companyId: user.ownerId ? String(user.ownerId) : "",
    },
    ipAddress,
    userAgent,
  });

  return json({ success: true, user: rowFromDoc(user) });
}
