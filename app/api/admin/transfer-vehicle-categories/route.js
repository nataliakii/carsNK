import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import TransferVehicleCategory, {
  DEFAULT_VEHICLE_CATEGORIES,
} from "@models/TransferVehicleCategory";
import { isSuperAdminUser } from "@/domain/owners/ownerScope";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

async function requireSuper(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return { errorResponse };
  if (!isSuperAdminUser(session.user)) {
    return {
      errorResponse: json({ success: false, message: "Forbidden" }, 403),
    };
  }
  return { session };
}

export async function GET(request) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();
  let items = await TransferVehicleCategory.find({})
    .sort({ sort: 1 })
    .lean();
  if (!items.length) {
    await TransferVehicleCategory.insertMany(
      DEFAULT_VEHICLE_CATEGORIES.map((c) => ({ ...c, isActive: true }))
    );
    items = await TransferVehicleCategory.find({}).sort({ sort: 1 }).lean();
  }
  return json({
    success: true,
    items: items.map((i) => ({ ...i, _id: String(i._id) })),
  });
}

export async function POST(request) {
  const gate = await requireSuper(request);
  if (gate.errorResponse) return gate.errorResponse;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }
  if (!payload?.code || !payload?.title) {
    return json({ success: false, message: "code and title required" }, 400);
  }
  await connectToDB();
  const doc = await TransferVehicleCategory.create({
    ...payload,
    code: String(payload.code).toUpperCase(),
  });
  return json(
    { success: true, item: { ...doc.toObject(), _id: String(doc._id) } },
    201
  );
}

export async function PATCH(request) {
  const gate = await requireSuper(request);
  if (gate.errorResponse) return gate.errorResponse;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }
  const id = payload?.id;
  if (!id) return json({ success: false, message: "id required" }, 400);
  await connectToDB();
  const { id: _id, ...updates } = payload;
  if (updates.code) updates.code = String(updates.code).toUpperCase();
  const doc = await TransferVehicleCategory.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true }
  ).lean();
  if (!doc) return json({ success: false, message: "Not found" }, 404);
  return json({ success: true, item: { ...doc, _id: String(doc._id) } });
}
