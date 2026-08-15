import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { ScopedAccessToken } from "@models/ScopedAccessToken";
import mongoose from "mongoose";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/** DELETE /api/admin/access-tokens/[id] — revoke */
export async function DELETE(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const id = params?.id;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return json({ success: false, message: "Invalid id" }, 400);
  }

  await connectToDB();
  const doc = await ScopedAccessToken.findByIdAndUpdate(
    id,
    { $set: { revokedAt: new Date() } },
    { new: true }
  ).lean();

  if (!doc) {
    return json({ success: false, message: "Token not found" }, 404);
  }

  return json({ success: true, token: { _id: doc._id, revokedAt: doc.revokedAt } });
}
