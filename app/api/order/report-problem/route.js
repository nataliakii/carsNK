import { NextResponse } from "next/server";

import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { verifyCustomerProblemToken } from "@/domain/orders/customerProblemToken";
import { reportBookingProblem } from "@/domain/orders/closeCompletedRentals";

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

  const marked = reportBookingProblem(order, { by: "customer" });
  if (!marked.ok) {
    return NextResponse.json(
      { success: false, code: marked.code, message: "This booking cannot be reported" },
      { status: 409 }
    );
  }
  await order.save();
  return NextResponse.json({ success: true, hasProblem: true });
}
