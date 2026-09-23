import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { connectToDB } from "@lib/database";
import { expireOpenAlternativeOffers } from "@/domain/booking/alternativeVehicle";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * Protected alternative-offer expiry sweep. Mutation is POST-only.
 */
export async function GET() {
  return json(
    {
      success: false,
      message: "Use POST. This endpoint does not mutate on GET.",
    },
    405
  );
}

export async function POST(request) {
  let trigger = "cron";
  if (!isAuthorizedCronRequest(request)) {
    const { session, errorResponse } = await requireSuperAdmin(request);
    if (errorResponse) return errorResponse;
    trigger = `superadmin:${session.user?.email || session.user?.id || ""}`;
  }

  try {
    await connectToDB();
  } catch (err) {
    return json({ success: false, message: "Service unavailable" }, 503);
  }

  let limit = DEFAULT_LIMIT;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.limit != null) limit = Number(body.limit) || DEFAULT_LIMIT;
  } catch {
    limit = DEFAULT_LIMIT;
  }

  try {
    const result = await expireOpenAlternativeOffers({
      trigger,
      limit,
    });
    return json({
      success: true,
      scanned: result.scanned,
      expired: result.expired,
      emailed: result.emailed,
      failed: result.failed?.length || 0,
    });
  } catch (err) {
    await recordAuditEvent({
      action: "ALTERNATIVE_OFFER_EXPIRED",
      severity: "critical",
      result: "failure",
      metadata: { trigger, message: err?.message || String(err) },
      errorMessage: err?.message || String(err),
    });
    return json({ success: false, message: "Expiration failed" }, 500);
  }
}
