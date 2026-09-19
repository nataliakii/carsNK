import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { DeliveryZone } from "@models/DeliveryZone";
import { sortDeliveryZones } from "@/domain/delivery/sortDeliveryZones";
import { COMPANY_ID } from "@config/company";
import {
  getSessionOwnerId,
  isSuperAdminUser,
  normalizeOwnerId,
} from "@/domain/owners/ownerScope";

function normalizeFixedPriceInput(value) {
  if (value === undefined) {
    return { ok: true, present: false, value: undefined };
  }
  if (value === null || value === "") {
    return { ok: true, present: true, value: null };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { ok: false, message: "fixedPrice must be null or >= 0" };
  }

  return { ok: true, present: true, value: numericValue };
}

function resolveOwnerId(user, requestedOwnerId) {
  if (isSuperAdminUser(user)) {
    return normalizeOwnerId(requestedOwnerId) || String(COMPANY_ID);
  }
  return getSessionOwnerId(user) || String(COMPANY_ID);
}

function buildZoneOwnerFilter(ownerId) {
  const id = String(ownerId);
  if (id === String(COMPANY_ID)) {
    return {
      $or: [{ ownerId: id }, { ownerId: null }, { ownerId: { $exists: false } }],
    };
  }
  return { ownerId: id };
}

export async function GET(request) {
  try {
    await connectToDB();
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const url = new URL(request.url);
    const ownerId = resolveOwnerId(
      session.user,
      url.searchParams.get("ownerId")
    );
    const zones = await DeliveryZone.find(buildZoneOwnerFilter(ownerId)).lean();
    return Response.json({
      success: true,
      ownerId,
      data: sortDeliveryZones(zones),
    });
  } catch (error) {
    console.error("[delivery-zones GET]", error);
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await connectToDB();
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { name, distanceKm, fixedPrice, isFreeDelivery, coordinates } = body;
    const ownerId = resolveOwnerId(session.user, body?.ownerId);
    const normalizedDistanceKm = Number(distanceKm);
    const normalizedFixedPrice = normalizeFixedPriceInput(fixedPrice);

    if (!name || typeof name !== "string" || !name.trim()) {
      return Response.json(
        { success: false, message: "Name is required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(normalizedDistanceKm) || normalizedDistanceKm < 0) {
      return Response.json(
        { success: false, message: "distanceKm must be >= 0" },
        { status: 400 }
      );
    }
    if (!normalizedFixedPrice.ok) {
      return Response.json(
        { success: false, message: normalizedFixedPrice.message },
        { status: 400 }
      );
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");

    const existing = await DeliveryZone.findOne({
      ...buildZoneOwnerFilter(ownerId),
      slug,
    });
    if (existing) {
      return Response.json(
        { success: false, message: `Zone "${name}" already exists` },
        { status: 409 }
      );
    }

    const zone = await DeliveryZone.create({
      ownerId,
      name: name.trim(),
      slug,
      distanceKm: normalizedDistanceKm,
      fixedPrice: normalizedFixedPrice.value,
      isFreeDelivery: isFreeDelivery ?? false,
      coordinates: coordinates ?? { lat: null, lng: null },
    });

    return Response.json({ success: true, data: zone }, { status: 201 });
  } catch (error) {
    console.error("[delivery-zones POST]", error);
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
