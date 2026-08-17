import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import { User } from "@models/user";
import { sendPasswordResetEmailToUser } from "@/domain/auth/sendPasswordResetEmail";

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

    await sendPasswordResetEmailToUser(user, request);

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
