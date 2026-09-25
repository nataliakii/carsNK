import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import TransferPricingRule, {
  PRICING_RULE_KINDS,
} from "@models/TransferPricingRule";
import { isSuperAdminUser } from "@/domain/owners/ownerScope";
import { previewTransferQuote } from "@/domain/transfers/createTransferOrder";

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
  const gate = await requireSuper(request);
  if (gate.errorResponse) return gate.errorResponse;

  const { searchParams } = new URL(request.url);
  const country = String(searchParams.get("country") || "")
    .trim()
    .toUpperCase();
  const kind = String(searchParams.get("kind") || "").trim();

  await connectToDB();
  const filter = { deactivatedAt: null };
  if (country) filter.country = country;
  if (kind && Object.values(PRICING_RULE_KINDS).includes(kind)) {
    filter.kind = kind;
  }

  const items = await TransferPricingRule.find(filter)
    .sort({ priority: 1, createdAt: -1 })
    .limit(200)
    .lean();

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

  if (payload?.action === "preview") {
    await connectToDB();
    const result = await previewTransferQuote(payload, { includeInternal: true });
    if (!result.ok) {
      return json({ success: false, message: result.message }, 400);
    }
    return json({
      success: true,
      publicQuote: result.quote,
      fullQuote: result.internalQuote || null,
      route: result.route,
      vehicleCategory: result.vehicleCategory,
    });
  }

  if (payload?.action === "duplicate") {
    await connectToDB();
    const source = await TransferPricingRule.findById(payload.id).lean();
    if (!source) return json({ success: false, message: "Not found" }, 404);
    const { _id, createdAt, updatedAt, ...rest } = source;
    const copy = await TransferPricingRule.create({
      ...rest,
      name: `${rest.name || rest.kind} (copy)`,
      duplicatedFromId: _id,
      version: 1,
      isActive: false,
    });
    return json({ success: true, item: { ...copy.toObject(), _id: String(copy._id) } }, 201);
  }

  const kind = String(payload?.kind || "").trim();
  if (!Object.values(PRICING_RULE_KINDS).includes(kind)) {
    return json({ success: false, message: "Invalid kind" }, 400);
  }
  if (!payload?.country) {
    return json({ success: false, message: "country required" }, 400);
  }

  await connectToDB();
  const doc = await TransferPricingRule.create({
    ...payload,
    kind,
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

  if (payload?.action === "deactivate") {
    const doc = await TransferPricingRule.findByIdAndUpdate(
      id,
      {
        $set: {
          isActive: false,
          deactivatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { new: true }
    ).lean();
    if (!doc) return json({ success: false, message: "Not found" }, 404);
    return json({ success: true, item: { ...doc, _id: String(doc._id) } });
  }

  const { id: _id, action: _a, ...updates } = payload;
  if (updates.country) updates.country = String(updates.country).toUpperCase();
  updates.$inc = { version: 1 };

  const doc = await TransferPricingRule.findByIdAndUpdate(
    id,
    { $set: updates, $inc: { version: 1 } },
    { new: true }
  ).lean();

  if (!doc) return json({ success: false, message: "Not found" }, 404);
  return json({ success: true, item: { ...doc, _id: String(doc._id) } });
}
