import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { connectToDB } from "@lib/database";
import {
  clampCleanupBatchSize,
  runExpiredHoldCleanup,
} from "@/domain/booking/expiredHoldCleanup";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * Protected expired-hold sweep. Mutation is POST-only.
 * Vercel Cron is GET-only, so this job is intended for a scheduler that
 * can POST with `Authorization: Bearer $CRON_SECRET`. Superadmin may also
 * run it by hand.
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
    if (body?.limit != null) limit = clampCleanupBatchSize(body.limit);
  } catch {
    limit = DEFAULT_LIMIT;
  }

  try {
    const result = await runExpiredHoldCleanup({
      trigger,
      limit,
    });
    return json({
      success: true,
      scanned: result.scanned,
      released: result.released,
      skippedConfirmed: result.skippedConfirmed,
      failed: result.failed,
    });
  } catch (err) {
    await recordAuditEvent({
      action: "BOOKING_HOLD_CLEANUP_FAILED",
      severity: "critical",
      result: "failure",
      metadata: { trigger, message: err?.message || String(err) },
      errorMessage: err?.message || String(err),
    });
    return json({ success: false, message: "Cleanup failed" }, 500);
  }
}
