import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { getOrderAuditTrail } from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Superadmin-only chronological activity for one order (AuditLog trail).
 */
export async function GET(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  const id = String(orderId || "").trim();
  if (!id) {
    return NextResponse.json(
      { success: false, message: "Order id required" },
      { status: 400 }
    );
  }

  await connectToDB();
  const order = await Order.findById(id).select("_id orderNumber").lean();
  if (!order) {
    return NextResponse.json(
      { success: false, message: "Order not found" },
      { status: 404 }
    );
  }

  const trail = await getOrderAuditTrail(id);
  const events = (Array.isArray(trail) ? trail : []).map((row) => ({
    id: String(row._id),
    action: row.action || "",
    createdAt: row.createdAt || null,
    userEmail: row.userEmail || "",
    userRole: row.userRole || "",
    severity: row.severity || "",
    result: row.result || "",
    reason: row.reason || "",
    metadata: row.metadata || null,
    orderData: row.orderData || null,
  }));

  return NextResponse.json({
    success: true,
    orderId: String(order._id),
    orderNumber: order.orderNumber || "",
    events,
  });
}
