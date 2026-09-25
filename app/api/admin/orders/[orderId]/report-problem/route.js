import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import { reportBookingProblem } from "@/domain/orders/closeCompletedRentals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const marked = reportBookingProblem(order, {
    by: session.user?.email || "",
  });
  if (!marked.ok) {
    return NextResponse.json(
      { success: false, message: "Only a platform booking can be reported", code: marked.code },
      { status: 409 }
    );
  }
  await order.save();
  return NextResponse.json({ success: true, hasProblem: true });
}
