import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import { recordSupplierRemainingPaid } from "@/domain/orders/closeCompletedRentals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The supplier records that the customer paid the remaining rental amount
 * to the company. This is not the Stripe Booking Fee.
 */
export async function POST(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
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

  const recorded = recordSupplierRemainingPaid(order);
  if (!recorded.ok) {
    return NextResponse.json(
      { success: false, code: recorded.code, message: "The remaining amount cannot be recorded yet" },
      { status: 409 }
    );
  }
  await order.save();
  return NextResponse.json({
    success: true,
    supplierRemainingPaidAt: order.supplierRemainingPaidAt,
  });
}
