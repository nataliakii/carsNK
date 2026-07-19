import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Car } from "@models/car";
import { Order } from "@models/order";
import mongoose from "mongoose";
import { normalizeOwnerId } from "@/domain/owners/ownerScope";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * PATCH: assign cars to an owner
 * { carIds: string[], ownerId: string, updateOrders?: boolean }
 */
export async function PATCH(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const ownerId = normalizeOwnerId(body?.ownerId);
  if (!ownerId) {
    return json({ success: false, message: "ownerId is required" }, 400);
  }

  const carIds = Array.isArray(body?.carIds)
    ? body.carIds.map(String).filter((id) => mongoose.Types.ObjectId.isValid(id))
    : [];
  if (carIds.length === 0) {
    return json({ success: false, message: "carIds required" }, 400);
  }

  await connectToDB();
  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const carResult = await Car.updateMany(
    { _id: { $in: carIds } },
    { $set: { ownerId: ownerObjectId } }
  );

  let ordersModified = 0;
  if (body?.updateOrders !== false) {
    const orderResult = await Order.updateMany(
      { car: { $in: carIds } },
      { $set: { ownerId: ownerObjectId } }
    );
    ordersModified = orderResult.modifiedCount || 0;
  }

  return json({
    success: true,
    carsModified: carResult.modifiedCount || 0,
    ordersModified,
  });
}
