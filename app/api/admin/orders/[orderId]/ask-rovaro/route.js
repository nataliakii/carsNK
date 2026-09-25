import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";

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
  const question = String(body?.question || "").trim();
  if (!question) {
    return NextResponse.json(
      { success: false, message: "A question is required" },
      { status: 400 }
    );
  }

  await connectToDB();
  const order = await Order.findById(orderId).select(
    "ownerId orderNumber carModel source my_order bookingStatus"
  );
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
  if (!isPlatformBooking(order)) {
    return NextResponse.json(
      { success: false, message: "Internal bookings do not use Rovaro messages" },
      { status: 409 }
    );
  }

  const orderNumber = order.orderNumber || String(order._id);
  await notifySuperadmin({
    title: `Question about order ${orderNumber}`,
    bodyLines: [
      `Company question about order ${orderNumber}`,
      question,
      `From: ${session.user?.email || "company admin"}`,
    ],
    telegramText: `Question about order ${orderNumber}: ${question}`,
    meta: { orderId: String(order._id), kind: "supplier_question" },
  });

  return NextResponse.json({ success: true });
}
