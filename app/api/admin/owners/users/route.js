import { NextResponse } from "next/server";
import { requireAdmin, requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { User } from "@models/user";
import {
  getSessionOwnerId,
  isSuperAdminUser,
  normalizeOwnerId,
} from "@/domain/owners/ownerScope";
import {
  normalizeNotificationLanguage,
  resolveInviteRole,
  usernameFromEmail,
  validateAddAdminInput,
} from "@/domain/admin/companyAdmins";
import {
  ensureUniqueUsername,
  isEmailTaken,
  listCompanyAdmins,
  rowFromDoc,
} from "@/domain/admin/companyAdminsService";
import { sendAdminInviteEmailToUser } from "@/domain/auth/sendAdminInviteEmail";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import Company from "@models/company";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * GET: list company admins (no passwords, no reset tokens).
 * Superadmin: any ownerId. Company admin: own company only.
 */
export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const requestedOwnerId = normalizeOwnerId(url.searchParams.get("ownerId"));
  const canManage = isSuperAdminUser(session.user);
  const ownerId = canManage ? requestedOwnerId : getSessionOwnerId(session.user);

  if (!ownerId) {
    return json({ success: false, message: "ownerId is required" }, 400);
  }

  const users = await listCompanyAdmins(ownerId);

  return json({ success: true, users, canManage });
}

/**
 * POST: invite a company admin.
 * { name, email, role?, notificationLanguage?, ownerId }
 *
 * Superadmin only. No password is accepted or generated here — the invited
 * person sets their own through the emailed one-time link.
 */
export async function POST(request) {
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const { valid, errors, value } = validateAddAdminInput(body);
  if (!valid) {
    return json(
      { success: false, message: "Invalid admin details", errors },
      400
    );
  }

  const ownerId = normalizeOwnerId(body?.ownerId);
  const role = resolveInviteRole({ role: value.role, ownerId });
  if (!ownerId) {
    return json({ success: false, message: "ownerId is required" }, 400);
  }

  await connectToDB();

  if (await isEmailTaken(value.email)) {
    return json(
      {
        success: false,
        message: "This email already belongs to another user",
        errors: { email: "admin.partnerAdmins.errors.emailTaken" },
      },
      409
    );
  }

  const username = await ensureUniqueUsername(usernameFromEmail(value.email));
  const company = await Company.findById(ownerId).select("name").lean();
  if (!company) {
    return json({ success: false, message: "Company not found" }, 404);
  }

  const user = await User.create({
    email: value.email,
    username,
    name: value.name,
    isAdmin: true,
    role,
    ownerId,
    notificationLanguage: normalizeNotificationLanguage(
      value.notificationLanguage
    ),
    invitedAt: new Date(),
  });

  try {
    await sendAdminInviteEmailToUser(user, request, {
      companyName: company?.name || "",
    });
  } catch (err) {
    console.error("[admin invite]", err?.message || err);
    return json(
      {
        success: true,
        user: rowFromDoc(user),
        inviteSent: false,
        message: "Admin created, but the invitation email could not be sent",
      },
      201
    );
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "COMPANY_ADMIN_INVITED",
    userRole: "superadmin",
    userEmail: session.user?.email || "",
    metadata: {
      companyId: String(ownerId),
      invitedUserId: String(user._id),
      invitedEmail: user.email,
    },
    ipAddress,
    userAgent,
  });

  return json({ success: true, user: rowFromDoc(user), inviteSent: true }, 201);
}
