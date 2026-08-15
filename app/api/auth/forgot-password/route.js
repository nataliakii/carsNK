import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import { User } from "@models/user";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import {
  createPasswordResetToken,
  getRequestOrigin,
} from "@/domain/auth/passwordReset";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always returns a generic success message (no email enumeration).
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const generic = {
    success: true,
    message:
      "If an account exists for this email, a reset link has been sent.",
  };

  if (!email || !email.includes("@")) {
    return json(generic);
  }

  try {
    await connectToDB();
    const user = await User.findOne({
      email: new RegExp(
        `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      ),
      isAdmin: true,
    });

    if (!user) {
      return json(generic);
    }

    const { rawToken, tokenHash, expiresAt } = createPasswordResetToken();
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    const origin = getRequestOrigin(request);
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await sendEmailDirect({
      title: "CarsNK — Password reset",
      message: [
        "You requested a password reset for your CarsNK admin account.",
        "",
        `Open this link within 1 hour:`,
        resetUrl,
        "",
        "If you did not request this, ignore this email.",
      ].join("\n"),
      html: `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;color:#1a1a1a">
  <p>You requested a password reset for your CarsNK admin account.</p>
  <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#0B1F3A;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p>
  <p style="font-size:13px;color:#555">Or copy this link:<br/><a href="${resetUrl}">${resetUrl}</a></p>
  <p style="font-size:12px;color:#777">Link expires in 1 hour. If you did not request this, ignore the email.</p>
</body></html>`,
      to: [user.email],
    });

    return json(generic);
  } catch (err) {
    console.error("[forgot-password]", err?.message || err);
    return json(
      {
        success: false,
        message: "Could not send reset email. Please try again later.",
      },
      500
    );
  }
}
