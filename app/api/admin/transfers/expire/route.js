import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import { isSuperAdminUser } from "@/domain/owners/ownerScope";
import { expireUnclaimedTransfers } from "@/domain/transfers/transferOps";

export const runtime = "nodejs";

/**
 * Cron / admin: expire unclaimed transfer offers.
 */
export async function POST(request) {
  const cronSecret = String(process.env.TRANSFER_CRON_SECRET || "").trim();
  const headerSecret = String(
    request.headers.get("x-transfer-cron-secret") || ""
  ).trim();

  if (cronSecret && headerSecret && headerSecret === cronSecret) {
    await connectToDB();
    const result = await expireUnclaimedTransfers();
    return NextResponse.json({ success: true, ...result });
  }

  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  if (!isSuperAdminUser(session.user)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, 403);
  }

  await connectToDB();
  const result = await expireUnclaimedTransfers();
  return NextResponse.json({ success: true, ...result });
}
