import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import TransferZone from "@models/TransferZone";
import { isSuperAdminUser } from "@/domain/owners/ownerScope";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function slugify(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "zone";
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
  const gate = await requireSuper(request);
  if (gate.errorResponse) return gate.errorResponse;

  const country = String(
    new URL(request.url).searchParams.get("country") || ""
  )
    .trim()
    .toUpperCase();

  await connectToDB();
  const filter = {};
  if (country) filter.country = country;
  const items = await TransferZone.find(filter).sort({ name: 1 }).lean();
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

  if (!payload?.name || !payload?.country) {
    return json({ success: false, message: "name and country required" }, 400);
  }

  await connectToDB();
  const doc = await TransferZone.create({
    ...payload,
    slug: payload.slug || slugify(payload.name),
    country: String(payload.country).toUpperCase(),
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
  if (updates.country) updates.country = String(updates.country).toUpperCase();
  const doc = await TransferZone.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true }
  ).lean();
  if (!doc) return json({ success: false, message: "Not found" }, 404);
  return json({ success: true, item: { ...doc, _id: String(doc._id) } });
}
