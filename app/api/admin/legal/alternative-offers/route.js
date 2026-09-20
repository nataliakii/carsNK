import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { ROLE } from "@models/user";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import {
  offerAlternativeVehicle,
  listOffersForOrder,
} from "@/domain/booking/alternativeVehicle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supplier-side alternative vehicle offers.
 *
 * A partner admin may only touch orders belonging to their own fleet. The
 * ownership check is done against the stored order, never against a value in
 * the request body.
 */
async function assertOrderInScope(session, orderId) {
  await connectToDB();
  const order = await Order.findById(orderId).select("ownerId").lean();
  if (!order) return { ok: false, status: 404, message: "Order not found" };

  if (Number(session.user?.role) === ROLE.SUPERADMIN) return { ok: true, order };

  const own = session.user?.ownerId ? String(session.user.ownerId) : null;
  if (!own || String(order.ownerId || "") !== own) {
    return { ok: false, status: 403, message: "This booking belongs to another fleet" };
  }
  return { ok: true, order };
}

export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const orderId = request.nextUrl.searchParams.get("orderId") || "";
  const scope = await assertOrderInScope(session, orderId);
  if (!scope.ok) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status }
    );
  }

  return NextResponse.json({
    success: true,
    offers: await listOffersForOrder(orderId),
  });
}

/**
 * POST — propose an alternative vehicle.
 *
 * The offer is a proposal only; the booking is not modified until the
 * customer accepts. Downgrades and price increases are refused by the domain
 * layer, so a supplier cannot quietly worsen the deal.
 */
export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const orderId = String(body?.orderId || "");
  const scope = await assertOrderInScope(session, orderId);
  if (!scope.ok) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status }
    );
  }

  const result = await offerAlternativeVehicle({
    orderId,
    alternative: body?.alternative || {},
    offeredByEmail: session.user?.email || "",
    expiresInHours: body?.expiresInHours,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message, code: result.code },
      { status: result.status || 400 }
    );
  }

  return NextResponse.json({ success: true, offerId: result.offerId });
}
