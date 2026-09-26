import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import { reportBookingProblem } from "@/domain/orders/closeCompletedRentals";
import {
  BOOKING_CAPABILITY,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";
import {
  extractAuditContext,
  recordAuditEvent,
} from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  await connectToDB();
  const order = await Order.findById(orderId);
  if (!order) {
    return NextResponse.json(
      { success: false, message: "Booking not found" },
      { status: 404 }
    );
  }

  const isSuperadmin = Number(session.user?.role) === ROLE.SUPERADMIN;
  const owner = String(session.user?.ownerId || "");
  if (!isSuperadmin && (!owner || String(order.ownerId || "") !== owner)) {
    return NextResponse.json(
      { success: false, message: "This booking belongs to another company" },
      { status: 403 }
    );
  }

  const capabilities = resolveOrderCapabilities(order, session.user);
  if (!capabilities[BOOKING_CAPABILITY.REPORT_PROBLEM]) {
    return NextResponse.json(
      {
        success: false,
        message: "A problem can be reported only for a paid booking",
        code: "CAPABILITY_DENIED",
      },
      { status: 403 }
    );
  }

  const marked = reportBookingProblem(order, {
    by: session.user?.email || "",
    type: body?.type || "OTHER",
    note: body?.message || body?.note || "",
  });
  if (!marked.ok) {
    return NextResponse.json(
      {
        success: false,
        message: "Only a platform booking can be reported",
        code: marked.code,
      },
      { status: 409 }
    );
  }
  await order.save();
  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "RENTAL_DISPUTE_CREATED",
    userRole: isSuperadmin ? "superadmin" : "admin",
    userId: session.user?.id,
    userEmail: session.user?.email || "",
    severity: "high",
    result: "success",
    reason: `Booking issue reported: ${marked.issue.type}`,
    ipAddress,
    userAgent,
    orderData: { orderId: order._id, orderNumber: order.orderNumber },
    metadata: { issueId: marked.issue.issueId, type: marked.issue.type },
  });
  return NextResponse.json({
    success: true,
    hasProblem: true,
    issue: marked.issue,
  });
}
