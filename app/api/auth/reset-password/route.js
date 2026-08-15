import { NextResponse } from "next/server";
import { hashSync } from "bcrypt";
import { connectToDB } from "@lib/database";
import { User } from "@models/user";
import { hashResetToken } from "@/domain/auth/passwordReset";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const token = String(body?.token || "").trim();
  const password = String(body?.password || "").trim();

  if (!token) {
    return json({ success: false, message: "Reset token is required" }, 400);
  }
  if (!password || password.length < 6) {
    return json(
      { success: false, message: "Password must be at least 6 characters" },
      400
    );
  }

  try {
    await connectToDB();
    const tokenHash = hashResetToken(token);
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
      isAdmin: true,
    });

    if (!user) {
      return json(
        {
          success: false,
          message: "Reset link is invalid or has expired",
        },
        400
      );
    }

    user.password = hashSync(password, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    return json({
      success: true,
      message: "Password updated. You can log in now.",
    });
  } catch (err) {
    console.error("[reset-password]", err?.message || err);
    return json(
      { success: false, message: "Could not reset password" },
      500
    );
  }
}
