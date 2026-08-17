import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { User } from "@models/user";
import { sendPasswordResetEmailToUser } from "@/domain/auth/sendPasswordResetEmail";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/** POST — superadmin sends password-reset email to an admin user */
export async function POST(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = params?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return json({ success: false, message: "Invalid user id" }, 400);
  }

  try {
    await connectToDB();
    const user = await User.findById(userId);
    if (!user || !user.isAdmin) {
      return json({ success: false, message: "User not found" }, 404);
    }

    await sendPasswordResetEmailToUser(user, request);

    return json({
      success: true,
      message: `Password reset email sent to ${user.email}`,
    });
  } catch (err) {
    console.error("[admin reset-password]", err?.message || err);
    return json(
      {
        success: false,
        message: "Could not send reset email. Check mail settings.",
      },
      500
    );
  }
}
