import { connectToDB } from "@lib/database";
import { requireSuperAdmin } from "@/lib/adminAuth";
import { listMailLogs } from "@/domain/mail/queryMailLog";
import { MAIL_TYPE, MAIL_STATUS } from "@/domain/mail/mailTypes";

function parsePositiveInt(value, fallback, { min = 1, max = 200 } = {}) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * GET /api/admin/mail-log
 * Superadmin-only global correspondence log.
 * Query: orderId, companyId, recipient, type, status, page, limit
 */
export async function GET(request) {
  try {
    await connectToDB();
    const { errorResponse } = await requireSuperAdmin(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const data = await listMailLogs({
      orderId: searchParams.get("orderId"),
      companyId: searchParams.get("companyId"),
      recipient: searchParams.get("recipient"),
      type: searchParams.get("type"),
      status: searchParams.get("status"),
      page: parsePositiveInt(searchParams.get("page"), 1, {
        min: 1,
        max: 1000,
      }),
      limit: parsePositiveInt(searchParams.get("limit"), 50, {
        min: 1,
        max: 100,
      }),
    });

    return Response.json({
      success: true,
      data: {
        ...data,
        types: Object.values(MAIL_TYPE),
        statuses: Object.values(MAIL_STATUS),
      },
    });
  } catch (error) {
    console.error("[mail-log GET]", error);
    return Response.json(
      { success: false, message: error.message || "Failed to load mail log" },
      { status: 500 }
    );
  }
}
