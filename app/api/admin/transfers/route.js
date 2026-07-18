import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { connectToDB } from "@lib/database";
import Transfer, { TRANSFER_STATUS } from "@models/Transfer";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET(request) {
  const session = await requireAdmin();
  if (!session) return json({ success: false, message: "Unauthorized" }, 401);

  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get("status") || "").trim();
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

  const filter = {};
  if (status && Object.values(TRANSFER_STATUS).includes(status)) {
    filter.status = status;
  }

  try {
    await connectToDB();
    const items = await Transfer.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return json({
      success: true,
      items: items.map((item) => ({
        ...item,
        _id: item._id.toString(),
      })),
    });
  } catch (error) {
    console.error("[admin/transfers] list failed", error);
    return json({ success: false, message: error.message }, 500);
  }
}
