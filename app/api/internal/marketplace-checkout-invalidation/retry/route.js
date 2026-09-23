import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { connectToDB } from "@lib/database";
import {
  clampInvalidationRetryBatchSize,
  retryMarketplaceCheckoutInvalidations,
} from "@/domain/orders/invalidateMarketplaceCheckout";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * Protected retry of failed Spain marketplace Checkout invalidations.
 * Mutation is POST-only. External schedulers POST with
 * `Authorization: Bearer $CRON_SECRET`. Superadmin may also run it by hand.
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
  let actorEmail = "";
  if (!isAuthorizedCronRequest(request)) {
    const { session, errorResponse } = await requireSuperAdmin(request);
    if (errorResponse) return errorResponse;
    actorEmail = session.user?.email || "";
    trigger = `superadmin:${actorEmail || session.user?.id || ""}`;
  }

  try {
    await connectToDB();
  } catch (err) {
    return json({ success: false, message: "Service unavailable" }, 503);
  }

  let limit = DEFAULT_LIMIT;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.limit != null) limit = clampInvalidationRetryBatchSize(body.limit);
  } catch {
    limit = DEFAULT_LIMIT;
  }

  try {
    const result = await retryMarketplaceCheckoutInvalidations({
      trigger,
      limit,
      actorEmail,
      actorRole: trigger.startsWith("superadmin") ? "superadmin" : "system",
    });
    return json({
      success: true,
      processed: result.processed,
      invalidated: result.invalidated,
      skippedPaid: result.skippedPaid,
      stillRetryable: result.stillRetryable,
      failed: result.failed,
    });
  } catch (err) {
    await recordAuditEvent({
      action: "RENTAL_CHECKOUT_INVALIDATE_RETRY",
      severity: "critical",
      result: "failure",
      metadata: { trigger, message: String(err?.message || err).slice(0, 200) },
    });
    return json({ success: false, message: "Retry failed" }, 500);
  }
}
