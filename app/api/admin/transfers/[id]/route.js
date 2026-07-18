import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { connectToDB } from "@lib/database";
import Transfer, { TRANSFER_STATUS } from "@models/Transfer";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return json({ success: false, message: "Unauthorized" }, 401);
  }

  const id = params?.id;
  if (!id) return json({ success: false, message: "id required" }, 400);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const status = String(payload?.status || "").trim();
  if (!Object.values(TRANSFER_STATUS).includes(status)) {
    return json({ success: false, message: "Invalid status" }, 400);
  }

  try {
    await connectToDB();
    const doc = await Transfer.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).lean();

    if (!doc) return json({ success: false, message: "Not found" }, 404);

    return json({
      success: true,
      item: { ...doc, _id: doc._id.toString() },
    });
  } catch (error) {
    console.error("[admin/transfers] patch failed", error);
    return json({ success: false, message: error.message }, 500);
  }
}
