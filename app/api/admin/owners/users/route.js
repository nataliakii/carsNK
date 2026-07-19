import { NextResponse } from "next/server";
import { hashSync } from "bcrypt";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { User, ROLE } from "@models/user";
import { normalizeOwnerId } from "@/domain/owners/ownerScope";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST: create admin user
 * { email, password, username?, role?: 1|2, ownerId? }
 * ADMIN requires ownerId. SUPERADMIN may omit ownerId.
 */
export async function POST(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "").trim();
  const username =
    String(body?.username || "").trim() || email.split("@")[0] || "admin";
  const role =
    Number(body?.role) === ROLE.SUPERADMIN ? ROLE.SUPERADMIN : ROLE.ADMIN;
  const ownerId = normalizeOwnerId(body?.ownerId);

  if (!email || !email.includes("@")) {
    return json({ success: false, message: "valid email is required" }, 400);
  }
  if (!password || password.length < 6) {
    return json(
      { success: false, message: "password must be at least 6 characters" },
      400
    );
  }
  if (role === ROLE.ADMIN && !ownerId) {
    return json(
      { success: false, message: "ownerId is required for ADMIN" },
      400
    );
  }

  await connectToDB();
  const existing = await User.findOne({
    $or: [{ email }, { username }],
  }).lean();
  if (existing) {
    return json(
      { success: false, message: "User with this email or username exists" },
      409
    );
  }

  const user = await User.create({
    email,
    username,
    password: hashSync(password, 10),
    isAdmin: true,
    role,
    ownerId: role === ROLE.SUPERADMIN ? ownerId : ownerId,
  });

  return json(
    {
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        ownerId: user.ownerId,
      },
    },
    201
  );
}
