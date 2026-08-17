import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { User, ROLE } from "@models/user";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function parseUserId(params) {
  const id = params?.userId;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
  return String(id);
}

/** PATCH — change admin email (and username if it matched old local part) */
export async function PATCH(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = parseUserId(params);
  if (!userId) return json({ success: false, message: "Invalid user id" }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json({ success: false, message: "valid email is required" }, 400);
  }

  await connectToDB();
  const user = await User.findById(userId);
  if (!user || !user.isAdmin) {
    return json({ success: false, message: "User not found" }, 404);
  }

  const duplicate = await User.findOne({
    _id: { $ne: user._id },
    $or: [{ email }, { username: email.split("@")[0] }],
  }).lean();
  if (duplicate) {
    return json(
      { success: false, message: "Another user already uses this email" },
      409
    );
  }

  user.email = email;
  if (body?.username != null) {
    const username = String(body.username).trim();
    if (username.length >= 3) user.username = username;
  }
  await user.save();

  return json({
    success: true,
    user: {
      _id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      ownerId: user.ownerId,
    },
  });
}

/** DELETE — remove company admin (not superadmin, not self) */
export async function DELETE(request, { params }) {
  const { errorResponse, session } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const userId = parseUserId(params);
  if (!userId) return json({ success: false, message: "Invalid user id" }, 400);

  if (session?.user?.id && String(session.user.id) === userId) {
    return json({ success: false, message: "You cannot delete your own account" }, 400);
  }

  await connectToDB();
  const user = await User.findById(userId);
  if (!user || !user.isAdmin) {
    return json({ success: false, message: "User not found" }, 404);
  }

  if (Number(user.role) === ROLE.SUPERADMIN) {
    const superCount = await User.countDocuments({
      isAdmin: true,
      role: ROLE.SUPERADMIN,
    });
    if (superCount <= 1) {
      return json(
        { success: false, message: "Cannot delete the only superadmin" },
        400
      );
    }
  }

  await User.findByIdAndDelete(userId);

  return json({ success: true, deletedUserId: userId });
}
