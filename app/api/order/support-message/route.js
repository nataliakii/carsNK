import { NextResponse } from "next/server";
import { getAdminSession } from "@lib/adminAuth";
import { extractAuditContext } from "@/domain/legal/auditTrail";
import {
  consumePublicPostOrError,
  supportMessageRateLimitOptions,
} from "@/services/publicPostRateLimit";
import {
  assertPartnerOwnsOrder,
  listSupportMessagesForOrder,
  loadOrderForSupport,
  resolvePartnerSupportAccess,
  sendPartnerSupportMessage,
} from "@/domain/orders/partnerSupportMessage";
import { isSuperAdminUser, canAccessOwnedDoc } from "@/domain/owners/ownerScope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * GET ?orderId= — partner (own booking) or superadmin order history.
 */
export async function GET(request) {
  const session = await getAdminSession(request);
  if (!session?.user) {
    return json({ success: false, message: "Unauthorized" }, 401);
  }

  const orderId = request.nextUrl.searchParams.get("orderId") || "";
  if (!orderId) {
    return json({ success: false, message: "orderId is required" }, 400);
  }

  const order = await loadOrderForSupport(orderId);
  if (!order) {
    return json({ success: false, message: "Order not found" }, 404);
  }

  if (!isSuperAdminUser(session.user) && !canAccessOwnedDoc(session.user, order)) {
    return json({ success: false, message: "Forbidden" }, 403);
  }

  const items = await listSupportMessagesForOrder(order._id);
  return json({ success: true, items });
}

/**
 * POST — session partner (own booking) or signed company-email-action message token.
 * Ignores client `to`, `recipient`, and `companyId`.
 */
export async function POST(request) {
  const limited = await consumePublicPostOrError(
    request,
    supportMessageRateLimitOptions()
  );
  if (limited) {
    return json(limited.body, limited.status);
  }

  let body = {};
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await request.json().catch(() => ({}));
  } else {
    const form = await request.formData().catch(() => null);
    if (form) {
      body = {
        token: form.get("token"),
        orderId: form.get("orderId"),
        message: form.get("message"),
        reason: form.get("reason"),
        idempotencyKey: form.get("idempotencyKey"),
        lang: form.get("lang"),
      };
    }
  }

  const session = await getAdminSession(request);
  const access = await resolvePartnerSupportAccess({
    token: body.token,
    orderId: body.orderId,
    sessionUser: session?.user || null,
  });
  if (!access.ok) {
    return json({ success: false, message: access.message }, access.status || 401);
  }

  const order = await loadOrderForSupport(access.orderId);
  if (!order) {
    return json({ success: false, message: "Order not found" }, 404);
  }

  const owned = await assertPartnerOwnsOrder(access.user, order);
  if (!owned.ok) {
    return json({ success: false, message: owned.message }, owned.status || 403);
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  const result = await sendPartnerSupportMessage({
    order,
    message: body.message,
    reason: body.reason,
    locale: body.lang,
    actor: {
      source: access.source,
      user: access.user,
      idempotencyKey: body.idempotencyKey,
      ipAddress,
      userAgent,
    },
  });

  if (!result.ok) {
    return json({ success: false, message: result.message }, result.status || 400);
  }

  return json({
    success: true,
    message: result.message,
    duplicate: Boolean(result.duplicate),
    messageId: result.messageId,
    orderId: result.orderId,
  });
}
