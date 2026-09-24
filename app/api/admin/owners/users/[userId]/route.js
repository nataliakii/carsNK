import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { User } from "@models/user";
import { normalizeNotificationLanguage } from "@/domain/admin/companyAdmins";
import {
  getCompanyAdminRow,
  rowFromDoc,
  findCompanyAdminDoc,
  assertNotLastUsableAdmin,
} from "@/domain/admin/companyAdminsService";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function parseUserId(params) {
  const id = params?.userId;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
  return String(id);
}

/** GET — one admin for the detail view. Never exposes password or tokens. */
export async function GET(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = parseUserId(params);
  if (!userId) return json({ success: false, message: "Invalid user id" }, 400);

  const user = await getCompanyAdminRow(userId);
  if (!user) return json({ success: false, message: "User not found" }, 404);

  return json({ success: true, user });
}

/**
 * PATCH — profile and access state.
 * { name?, notificationLanguage?, disabled?: boolean }
 *
 * The login email is not editable here; it has its own audited endpoint at
 * /api/admin/owners/users/[userId]/email.
 */
export async function PATCH(request, { params }) {
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = parseUserId(params);
  if (!userId) return json({ success: false, message: "Invalid user id" }, 400);

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

  if (body?.name != null) user.name = String(body.name).trim().slice(0, 80);
  if (body?.notificationLanguage != null) {
    user.notificationLanguage = normalizeNotificationLanguage(
      body.notificationLanguage
    );
  }

  let accessAction = null;
  if (body?.disabled != null) {
    const disabled = body.disabled === true || body.disabled === "true";
    if (disabled && String(session.user?.id || "") === userId) {
      return json(
        { success: false, message: "You cannot disable your own account" },
        400
      );
    }
    if (disabled) {
      const lastAdmin = await assertNotLastUsableAdmin(user);
      if (lastAdmin) return json(lastAdmin, 409);
    }
    if (disabled !== Boolean(user.disabledAt)) {
      user.disabledAt = disabled ? new Date() : null;
      accessAction = disabled
        ? "COMPANY_ADMIN_ACCESS_DISABLED"
        : "COMPANY_ADMIN_ACCESS_ENABLED";
    }
  }

  await user.save();

  if (accessAction) {
    const { ipAddress, userAgent } = extractAuditContext(request);
    await recordAuditEvent({
      action: accessAction,
      userRole: "superadmin",
      userEmail: session.user?.email || "",
      severity: "high",
      metadata: {
        targetUserId: userId,
        targetEmail: user.email,
        companyId: user.ownerId ? String(user.ownerId) : "",
      },
      ipAddress,
      userAgent,
    });
  }

  return json({ success: true, user: rowFromDoc(user) });
}

/** DELETE — remove a company admin (not self, not the last usable admin). */
export async function DELETE(request, { params }) {
  const { errorResponse, session } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = parseUserId(params);
  if (!userId) return json({ success: false, message: "Invalid user id" }, 400);

  if (session?.user?.id && String(session.user.id) === userId) {
    return json({ success: false, message: "You cannot delete your own account" }, 400);
  }

  await connectToDB();
  const user = await findCompanyAdminDoc(userId);
  if (!user) {
    return json({ success: false, message: "User not found" }, 404);
  }

  const lastAdmin = await assertNotLastUsableAdmin(user);
  if (lastAdmin) return json(lastAdmin, 409);

  await User.findByIdAndDelete(userId);

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "COMPANY_ADMIN_REMOVED",
    userRole: "superadmin",
    userEmail: session.user?.email || "",
    severity: "high",
    metadata: {
      targetUserId: userId,
      targetEmail: user.email,
      companyId: user.ownerId ? String(user.ownerId) : "",
    },
    ipAddress,
    userAgent,
  });

  return json({ success: true, deletedUserId: userId });
}
