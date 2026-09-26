import { NextResponse } from "next/server";

import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { verifyCustomerProblemToken } from "@/domain/orders/customerProblemToken";
import { reportBookingProblem } from "@/domain/orders/closeCompletedRentals";
import {
  extractAuditContext,
  recordAuditEvent,
} from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const verified = verifyCustomerProblemToken(body?.token);
  if (!verified.ok) {
    return NextResponse.json(
      { success: false, message: verified.message || "Invalid token" },
      { status: 403 }
    );
  }

  await connectToDB();
  const order = await Order.findById(verified.orderId);
  if (!order) {
    return NextResponse.json(
      { success: false, message: "Booking not found" },
      { status: 404 }
    );
  }

  const marked = reportBookingProblem(order, {
    by: "customer",
    type: body?.type || "OTHER",
    note: body?.message || body?.note || "",
  });
  if (!marked.ok) {
    return NextResponse.json(
      {
        success: false,
        code: marked.code,
        message: "This booking cannot be reported",
      },
      { status: 409 }
    );
  }
  await order.save();
  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "RENTAL_DISPUTE_CREATED",
    userRole: "system",
    severity: "high",
    result: "success",
    reason: "Customer reported a booking issue",
    ipAddress,
    userAgent,
    orderData: { orderId: order._id, orderNumber: order.orderNumber },
    metadata: {
      issueId: marked.issue.issueId,
      type: marked.issue.type,
      reporter: "customer",
    },
  });
  return NextResponse.json({
    success: true,
    hasProblem: true,
    issue: marked.issue,
  });
}
