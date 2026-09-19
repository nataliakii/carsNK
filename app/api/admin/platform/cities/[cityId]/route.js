import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PlatformCity from "@models/platformCity";
import { slugifyCompanyName } from "@/domain/platform/companySlug";
import { toPublicCity } from "@/domain/platform/companyBookingCities";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function PATCH(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const cityId = params?.cityId;
  if (!cityId || !mongoose.Types.ObjectId.isValid(cityId)) {
    return json({ success: false, message: "Invalid city id" }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const updates = {};
  if (body?.name != null) {
    const name = String(body.name).trim();
    if (!name) return json({ success: false, message: "name cannot be empty" }, 400);
    updates.name = name;
    if (body.slug == null) updates.slug = slugifyCompanyName(name);
  }
  if (body?.slug != null) updates.slug = slugifyCompanyName(body.slug);
  if (body?.kind != null && ["city", "airport", "region"].includes(body.kind)) {
    updates.kind = body.kind;
  }
  if (body?.isActive != null) updates.isActive = Boolean(body.isActive);
  if (body?.requiresAddressDetail != null) {
    updates.requiresAddressDetail = Boolean(body.requiresAddressDetail);
  }
  if (body?.searchText != null) updates.searchText = String(body.searchText).trim();
  if (body?.sort != null && Number.isFinite(Number(body.sort))) {
    updates.sort = Number(body.sort);
  }
  if (body?.coords !== undefined) {
    const parsed = parseCityCoords(body.coords);
    if (parsed === null) {
      return json({ success: false, message: "Invalid coords" }, 400);
    }
    updates.coords = parsed;
  }

  if (!Object.keys(updates).length) {
    return json({ success: false, message: "Nothing to update" }, 400);
  }

  await connectToDB();
  const city = await PlatformCity.findByIdAndUpdate(
    cityId,
    { $set: updates },
    { new: true }
  ).lean();
  if (!city) return json({ success: false, message: "City not found" }, 404);
  return json({ success: true, city: toPublicCity(city) });
}

export async function DELETE(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const cityId = params?.cityId;
  if (!cityId || !mongoose.Types.ObjectId.isValid(cityId)) {
    return json({ success: false, message: "Invalid city id" }, 400);
  }

  await connectToDB();
  const city = await PlatformCity.findByIdAndDelete(cityId).lean();
  if (!city) return json({ success: false, message: "City not found" }, 404);
  return json({ success: true, deletedCityId: cityId });
}

function parseCityCoords(raw) {
  if (raw == null) return { lat: "", lon: "" };
  if (typeof raw !== "object") return null;
  const lat = String(raw.lat ?? "").trim();
  const lon = String(raw.lon ?? raw.lng ?? "").trim();
  if (!lat && !lon) return { lat: "", lon: "" };
  const latN = Number(lat);
  const lonN = Number(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return null;
  if (latN < -90 || latN > 90 || lonN < -180 || lonN > 180) return null;
  return { lat: String(latN), lon: String(lonN) };
}
