import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { connectToDB } from "@lib/database";
import { closeCompletedRentals } from "@/domain/orders/closeCompletedRentals";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

async function run(request, trigger) {
  try {
    await connectToDB();
  } catch {
    return json({ success: false, message: "Service unavailable" }, 503);
  }

  let limit = 100;
  try {
    const url = new URL(request.url);
    const fromQuery = Number(url.searchParams.get("limit"));
    if (Number.isFinite(fromQuery) && fromQuery > 0) limit = fromQuery;
  } catch {
    limit = 100;
  }

  try {
    const result = await closeCompletedRentals({ trigger, limit });
    return json({ success: true, ...result });
  } catch (err) {
    await recordAuditEvent({
      action: "BOOKING_AUTO_CLOSE_FAILED",
      severity: "critical",
      result: "failure",
      metadata: { trigger, message: err?.message || String(err) },
      errorMessage: err?.message || String(err),
    });
    return json({ success: false, message: "Close job failed" }, 500);
  }
}

/**
 * Vercel Cron is GET-only and sends Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request) {
  if (isAuthorizedCronRequest(request)) {
    return run(request, "cron");
  }
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;
  return run(request, `superadmin:${session.user?.email || ""}`);
}

export async function POST(request) {
  return GET(request);
}
