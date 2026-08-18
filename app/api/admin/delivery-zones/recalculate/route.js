import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import { recalculateZoneDistancesFromBase } from "@/domain/delivery/recalculateZoneDistancesFromBase";
import { sortDeliveryZones } from "@/domain/delivery/sortDeliveryZones";
import { DeliveryZone } from "@models/DeliveryZone";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function parseCoord(value, kind) {
  const num = Number(String(value ?? "").trim());
  if (!Number.isFinite(num)) {
    return { ok: false, message: `${kind} must be a number` };
  }
  if (kind === "lat" && (num < -90 || num > 90)) {
    return { ok: false, message: "lat must be between -90 and 90" };
  }
  if (kind === "lon" && (num < -180 || num > 180)) {
    return { ok: false, message: "lon must be between -180 and 180" };
  }
  return { ok: true, value: String(num) };
}

function resolveCompanyId(user) {
  if (isSuperAdminUser(user)) return String(COMPANY_ID);
  return getSessionOwnerId(user) || String(COMPANY_ID);
}

export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const parsedLat = parseCoord(body?.lat ?? body?.coords?.lat, "lat");
  const parsedLon = parseCoord(
    body?.lon ?? body?.lng ?? body?.coords?.lon ?? body?.coords?.lng,
    "lon"
  );
  if (!parsedLat.ok) return json({ success: false, message: parsedLat.message }, 400);
  if (!parsedLon.ok) return json({ success: false, message: parsedLon.message }, 400);

  const coords = { lat: parsedLat.value, lon: parsedLon.value };
  const companyId = resolveCompanyId(session.user);

  try {
    await connectToDB();
    const company = await Company.findByIdAndUpdate(
      companyId,
      { $set: { coords } },
      { new: true }
    ).lean();

    if (!company) {
      return json({ success: false, message: "Company not found" }, 404);
    }

    const { updated, failed } = await recalculateZoneDistancesFromBase(coords);
    const zones = await DeliveryZone.find().lean();

    return json({
      success: true,
      company: {
        _id: String(company._id),
        name: company.name,
        coords: company.coords,
      },
      updatedCount: updated.length,
      failedCount: failed.length,
      failed,
      data: sortDeliveryZones(zones),
    });
  } catch (error) {
    console.error("[delivery-zones recalculate]", error);
    return json(
      { success: false, message: error.message || "Failed to recalculate" },
      500
    );
  }
}
