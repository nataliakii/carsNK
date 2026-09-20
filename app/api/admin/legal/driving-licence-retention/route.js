import crypto from "crypto";

import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { runDrivingLicenceRetention } from "@/domain/legal/drivingLicenceRetention";
import {
  consumePublicPostOrError,
  retentionJobRateLimitOptions,
} from "@/services/publicPostRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Header used by non-Vercel schedulers, matching /api/admin/transfers/expire. */
const CRON_SECRET_HEADER = "x-retention-cron-secret";

/**
 * The scheduler's secret. `CRON_SECRET` is what Vercel Cron sends as a bearer
 * token; `DOCUMENT_RETENTION_CRON_SECRET` lets this one job be rotated on its
 * own. There is deliberately no fallback to a weaker or derived value: with
 * neither variable set, no unauthenticated caller can ever run the job.
 */
function expectedCronSecret() {
  return (
    String(process.env.DOCUMENT_RETENTION_CRON_SECRET || "").trim() ||
    String(process.env.CRON_SECRET || "").trim()
  );
}

function presentedSecret(request) {
  const authorization = String(
    request.headers.get("authorization") || ""
  ).trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization);
  if (bearer) return bearer[1].trim();
  return String(request.headers.get(CRON_SECRET_HEADER) || "").trim();
}

function isScheduler(request) {
  const expected = expectedCronSecret();
  if (!expected) return false;
  const presented = presentedSecret(request);
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function wantsDryRun(request) {
  const value = request.nextUrl
    ? request.nextUrl.searchParams.get("dryRun")
    : new URL(request.url).searchParams.get("dryRun");
  return value === "1" || value === "true";
}

/**
 * @param {Request} request
 * @param {{ forceDryRunForHumans: boolean }} options
 */
async function handle(request, { forceDryRunForHumans }) {
  try {
    await connectToDB();
  } catch (err) {
    console.error(
      "[driving-licence-retention] db connect failed",
      err?.message || err
    );
    return NextResponse.json(
      { success: false, message: "Service unavailable" },
      { status: 503 }
    );
  }

  // Before authentication: the limiter also caps attempts at guessing the
  // scheduler secret.
  const limited = await consumePublicPostOrError(
    request,
    retentionJobRateLimitOptions()
  );
  if (limited) {
    return NextResponse.json(limited.body, { status: limited.status });
  }

  let trigger = "cron";
  let dryRun = wantsDryRun(request);

  if (!isScheduler(request)) {
    const { session, errorResponse } = await requireSuperAdmin(request);
    if (errorResponse) return errorResponse;
    trigger = `superadmin:${session.user?.email || session.user?.id || ""}`;
    if (forceDryRunForHumans) dryRun = true;
  }

  const summary = await runDrivingLicenceRetention({ dryRun, trigger });
  return NextResponse.json({ success: true, summary });
}

/**
 * GET — the scheduled entry point. Vercel Cron can only issue GET requests,
 * and sends `Authorization: Bearer $CRON_SECRET`.
 *
 * A superadmin may also open this in a browser, but then it is forced into
 * dry-run: no URL someone can follow by accident is allowed to erase
 * documents. Use POST for a real manual run.
 */
export async function GET(request) {
  return handle(request, { forceDryRunForHumans: true });
}

/** POST — manual run by a superadmin, or a scheduler that prefers POST. */
export async function POST(request) {
  return handle(request, { forceDryRunForHumans: false });
}
