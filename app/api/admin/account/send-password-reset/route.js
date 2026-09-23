import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { User } from "@models/user";
import { sendPasswordResetEmailToUser } from "@/domain/auth/sendPasswordResetEmail";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/admin/account/send-password-reset
 * Signed-in admin emails themselves a set-new-password link.
 * Any email in the request body is ignored. The mailbox is the session user.
 */
export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    await connectToDB();
    // A posted email is never the recipient. Only the signed-in user is.
    try {
      const posted = await request.clone().json();
      void posted?.email;
    } catch {
      // Empty or non-JSON bodies are valid for this route.
    }
    const id = session.user?.id;
    const email = String(session.user?.email || "").trim();
    let user = null;
    if (id && mongoose.Types.ObjectId.isValid(String(id))) {
      user = await User.findById(id);
    }
    if (!user && email) {
      user = await User.findOne({
        email: new RegExp(
          `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
        isAdmin: true,
      });
    }
    if (!user || !user.isAdmin) {
      return json(
        {
          success: false,
          message:
            "This login has no admin mailbox in the database, so a reset email cannot be sent.",
        },
        400
      );
    }

    await sendPasswordResetEmailToUser(user, request);

    return json({
      success: true,
      message: `Password reset email sent to ${user.email}`,
      email: user.email,
    });
  } catch (err) {
    console.error("[account send-password-reset]", err?.message || err);
    return json(
      {
        success: false,
        message: "Could not send reset email. Check mail settings.",
      },
      500
    );
  }
}
