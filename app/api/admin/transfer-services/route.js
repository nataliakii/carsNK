import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * GET/PATCH company transferServices capabilities.
 * Suppliers cannot edit customer prices here.
 */
export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const isSuper = isSuperAdminUser(session.user);
  const companyId =
    (isSuper && searchParams.get("companyId")) || getSessionOwnerId(session.user);
  if (!companyId) return json({ success: false, message: "companyId required" }, 400);

  await connectToDB();
  const company = await Company.findById(companyId)
    .select("name email country transferServices")
    .lean();
  if (!company) return json({ success: false, message: "Not found" }, 404);

  return json({
    success: true,
    companyId: String(company._id),
    transferServices: company.transferServices || { enabled: false },
  });
}

export async function PATCH(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const isSuper = isSuperAdminUser(session.user);
  const companyId =
    (isSuper && payload.companyId) || getSessionOwnerId(session.user);
  if (!companyId) return json({ success: false, message: "companyId required" }, 400);

  // Strip any attempt to set customer prices
  const ts = { ...(payload.transferServices || {}) };
  delete ts.customerPrices;
  delete ts.pricingRules;

  if (!isSuper) {
    delete ts.blockedByAdmin;
    delete ts.suspended;
  }

  await connectToDB();
  const existing = await Company.findById(companyId)
    .select("transferServices")
    .lean();
  if (!existing) return json({ success: false, message: "Not found" }, 404);

  const merged = {
    ...(existing.transferServices || {}),
    ...ts,
    payments: {
      ...((existing.transferServices && existing.transferServices.payments) ||
        {}),
      ...(ts.payments || {}),
    },
  };

  const doc = await Company.findByIdAndUpdate(
    companyId,
    { $set: { transferServices: merged } },
    { new: true }
  )
    .select("name transferServices")
    .lean();

  if (!doc) return json({ success: false, message: "Not found" }, 404);
  return json({
    success: true,
    transferServices: doc.transferServices,
  });
}
