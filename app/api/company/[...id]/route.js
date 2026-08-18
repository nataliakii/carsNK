import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getCompany } from "@/domain/services";
import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";

// Кеширование для статических данных (company меняется очень редко)
// Revalidate каждый час (3600 секунд)
export const revalidate = 3600;

function parseCompanyId(params) {
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
  return String(id);
}

function canManageCompany(user, companyId) {
  if (isSuperAdminUser(user)) return true;
  const ownerId = getSessionOwnerId(user);
  return Boolean(ownerId && ownerId === companyId);
}

function parseCoord(value, kind) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: `${kind} is required` };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { ok: false, message: `${kind} must be a number` };
  }
  if (kind === "lat" && (num < -90 || num > 90)) {
    return { ok: false, message: "lat must be between -90 and 90" };
  }
  if (kind === "lon" && (num < -180 || num > 180)) {
    return { ok: false, message: "lon must be between -180 and 180" };
  }
  return { ok: true, value: trimmed };
}

export const GET = async (request, { params }) => {
  try {
    const companyId = parseCompanyId(params);
    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }
    const company = await getCompany(companyId);
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(company, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error("Error retrieving company:", error);
    return NextResponse.json(
      { error: `Failed to retrieve company: ${error.message}` },
      { status: 500 }
    );
  }
};

/** PATCH — update public contact fields and base coords for own company or any (superadmin). */
export async function PATCH(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const companyId = parseCompanyId(params);
  if (!companyId) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }

  const user = session?.user;
  if (!canManageCompany(user, companyId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates = {};
  if (body?.name != null) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    updates.name = name;
  }
  if (body?.email != null) {
    updates.email = String(body.email).trim();
  }
  if (body?.tel != null) {
    updates.tel = String(body.tel).trim();
  }
  if (body?.coords != null) {
    const parsedLat = parseCoord(body.coords?.lat, "lat");
    if (!parsedLat.ok) {
      return NextResponse.json({ error: parsedLat.message }, { status: 400 });
    }
    const parsedLon = parseCoord(body.coords?.lon, "lon");
    if (!parsedLon.ok) {
      return NextResponse.json({ error: parsedLon.message }, { status: 400 });
    }
    updates.coords = {
      lat: parsedLat.value,
      lon: parsedLon.value,
    };
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    await connectToDB();
    const company = await Company.findByIdAndUpdate(
      companyId,
      { $set: updates },
      { new: true }
    ).lean();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    revalidatePath(`/api/company/${companyId}`);

    return NextResponse.json(company, { status: 200 });
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update company" },
      { status: 500 }
    );
  }
}
