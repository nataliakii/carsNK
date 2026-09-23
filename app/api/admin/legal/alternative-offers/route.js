import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { ROLE } from "@models/user";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { extractAuditContext } from "@/domain/legal/auditTrail";
import {
  offerAlternativeVehicle,
  listOffersForOrder,
  listEligibleAlternativeCars,
  withdrawAlternativeOffer,
} from "@/domain/booking/alternativeVehicle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOrderInScope(session, orderId) {
  await connectToDB();
  const order = await Order.findById(orderId).select("ownerId bookingMode bookingStatus").lean();
  if (!order) return { ok: false, status: 404, message: "Order not found" };

  if (Number(session.user?.role) === ROLE.SUPERADMIN) return { ok: true, order };

  const own = session.user?.ownerId ? String(session.user.ownerId) : null;
  if (!own || String(order.ownerId || "") !== own) {
    return { ok: false, status: 403, message: "This booking belongs to another fleet" };
  }
  return { ok: true, order };
}

function actorFrom(session) {
  return {
    role: Number(session.user?.role),
    ownerId: session.user?.ownerId,
    email: session.user?.email || "",
    userId: session.user?.id,
    isSuperadmin: Number(session.user?.role) === ROLE.SUPERADMIN,
  };
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

  const actor = actorFrom(session);
  const [offers, eligible] = await Promise.all([
    listOffersForOrder(orderId),
    listEligibleAlternativeCars({ orderId, actor }),
  ]);

  return NextResponse.json({
    success: true,
    offers,
    eligibleCars: eligible.ok ? eligible.cars : [],
    excludedCars: eligible.ok ? eligible.excluded : [],
    eligibilityError: eligible.ok ? null : { code: eligible.code, message: eligible.message },
    paidOrderBlocked: eligible.code === "paid_requires_manual",
  });
}

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

  const actor = actorFrom(session);
  const { ipAddress, userAgent } = extractAuditContext(request);

  if (String(body?.action || "") === "withdraw") {
    const result = await withdrawAlternativeOffer({
      offerId: String(body.offerId || ""),
      orderId,
      reason: body.reason,
      actor,
      ipAddress,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, code: result.code },
        { status: result.status || 400 }
      );
    }
    return NextResponse.json({ success: true, status: result.status, offerId: result.offerId });
  }

  const result = await offerAlternativeVehicle({
    orderId,
    proposedCarId: body?.proposedCarId || body?.alternative?.carId,
    alternative: {
      reasonForReplacement:
        body?.reasonForReplacement || body?.alternative?.reasonForReplacement || "",
    },
    offeredByEmail: session.user?.email || "",
    actor,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message, code: result.code },
      { status: result.status || 400 }
    );
  }

  return NextResponse.json({
    success: true,
    offerId: result.offerId,
    holdCreated: false,
    stripeCreated: false,
  });
}
