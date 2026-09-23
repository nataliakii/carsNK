import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { ScopedAccessToken } from "@models/ScopedAccessToken";
import Company from "@models/company";
import {
  ACCESS_SCOPE,
  ACCESS_SCOPE_LABELS,
  ADMIN_ACCESS_TTL_DAYS,
  ALL_ACCESS_SCOPES,
  adminAccessExpiresAt,
  isAdminConsoleScope,
  isValidAccessScope,
} from "@/domain/auth/accessScopes";
import {
  buildAccessLink,
  createRawAccessToken,
  hashAccessToken,
  toObjectIdOrNull,
} from "@/domain/auth/scopedAccessToken";
import { accessPathSuffixForScopes, assertAdminForCompanyLink } from "@/domain/auth/adminAccessLink";
import { User } from "@models/user";
import { getRequestOrigin } from "@/domain/auth/passwordReset";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/** GET — list tokens (superadmin). */
export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();
  const tokens = await ScopedAccessToken.find({})
    .sort({ createdAt: -1 })
    .lean();
  const companies = await Company.find({})
    .select("_id name voucherStampSrc")
    .lean();
  const nameById = Object.fromEntries(
    (companies || []).map((c) => [String(c._id), c.name])
  );
  const adminUserIds = [
    ...new Set(
      (tokens || [])
        .map((t) => (t.userId ? String(t.userId) : ""))
        .filter(Boolean)
    ),
  ];
  const adminUsers = adminUserIds.length
    ? await User.find({ _id: { $in: adminUserIds } })
        .select("_id email")
        .lean()
    : [];
  const emailByUserId = Object.fromEntries(
    adminUsers.map((u) => [String(u._id), u.email])
  );

  return json({
    success: true,
    adminAccessTtlDays: ADMIN_ACCESS_TTL_DAYS,
    scopes: ALL_ACCESS_SCOPES.map((s) => ({
      id: s,
      label: ACCESS_SCOPE_LABELS[s] || s,
    })),
    tokens: (tokens || []).map((t) => ({
      _id: t._id,
      label: t.label,
      tokenPrefix: t.tokenPrefix,
      ownerId: t.ownerId,
      userId: t.userId || null,
      userEmail: t.userId ? emailByUserId[String(t.userId)] || "—" : "",
      companyName: nameById[String(t.ownerId)] || "—",
      scopes: t.scopes,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      lastUsedAt: t.lastUsedAt,
      createdAt: t.createdAt,
      createdByEmail: t.createdByEmail,
      active:
        !t.revokedAt &&
        (!t.expiresAt || new Date(t.expiresAt).getTime() > Date.now()),
    })),
  });
}

/**
 * POST — create token
 * { ownerId, scopes?: string[], label?, expiresInDays?: number|null }
 * Returns rawToken + link once.
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

  const ownerObjectId = toObjectIdOrNull(body?.ownerId);
  if (!ownerObjectId) {
    return json({ success: false, message: "ownerId is required" }, 400);
  }

  const scopesRaw = Array.isArray(body?.scopes) ? body.scopes : [];
  const scopes = scopesRaw.map(String).filter(isValidAccessScope);
  const finalScopes =
    scopes.length > 0 ? scopes : [ACCESS_SCOPE.VOUCHERS_TRANSFER];
  const isAdminLogin = isAdminConsoleScope(finalScopes);

  const label = String(body?.label || "").trim().slice(0, 120);
  let expiresAt = null;
  if (isAdminLogin) {
    expiresAt = adminAccessExpiresAt();
  } else {
    const expiresInDays =
      body?.expiresInDays == null || body?.expiresInDays === ""
        ? null
        : Number(body.expiresInDays);
    if (Number.isFinite(expiresInDays) && expiresInDays > 0) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }
  }

  await connectToDB();
  const company = await Company.findById(ownerObjectId).lean();
  if (!company) {
    return json({ success: false, message: "Company not found" }, 404);
  }

  let userObjectId = null;
  if (isAdminLogin) {
    userObjectId = toObjectIdOrNull(body?.userId);
    if (!userObjectId) {
      return json(
        {
          success: false,
          message: "Pick a company admin for this login link",
        },
        400
      );
    }
    const adminUser = await User.findById(userObjectId);
    const check = assertAdminForCompanyLink(adminUser, ownerObjectId);
    if (!check.ok) {
      return json({ success: false, message: check.message }, 400);
    }
  }

  const rawToken = createRawAccessToken();
  const tokenHash = hashAccessToken(rawToken);
  const tokenPrefix = rawToken.slice(0, 8);

  const doc = await ScopedAccessToken.create({
    tokenHash,
    tokenPrefix,
    label:
      label ||
      (isAdminLogin
        ? `${company.name} admin login`
        : `${company.name} vouchers`),
    ownerId: ownerObjectId,
    userId: userObjectId,
    scopes: finalScopes,
    expiresAt,
    createdByAdminId: session?.user?.id || null,
    createdByEmail: session?.user?.email || null,
  });

  const origin = getRequestOrigin(request);
  const link = buildAccessLink(
    origin,
    rawToken,
    accessPathSuffixForScopes(finalScopes)
  );

  return json(
    {
      success: true,
      rawToken,
      link,
      token: {
        _id: doc._id,
        label: doc.label,
        tokenPrefix: doc.tokenPrefix,
        ownerId: doc.ownerId,
        userId: doc.userId,
        companyName: company.name,
        scopes: doc.scopes,
        expiresAt: doc.expiresAt,
      },
      warning:
        "Copy the link now — the full token is shown only once and cannot be recovered.",
    },
    201
  );
}
