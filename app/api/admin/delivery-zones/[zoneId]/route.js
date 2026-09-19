import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { DeliveryZone } from "@models/DeliveryZone";
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

function canAccessZone(user, zone) {
  if (isSuperAdminUser(user)) return true;
  const ownerId = getSessionOwnerId(user);
  if (!ownerId) return false;
  const zoneOwner = zone?.ownerId ? String(zone.ownerId) : String(COMPANY_ID);
  return zoneOwner === ownerId;
}

export async function PATCH(request, { params }) {
  try {
    await connectToDB();
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { zoneId } = params;
    const body = await request.json();
    const normalizedFixedPrice = normalizeFixedPriceInput(body.fixedPrice);

    if (!normalizedFixedPrice.ok) {
      return Response.json(
        { success: false, message: normalizedFixedPrice.message },
        { status: 400 }
      );
    }

    const existing = await DeliveryZone.findById(zoneId).lean();
    if (!existing) {
      return Response.json(
        { success: false, message: "Zone not found" },
        { status: 404 }
      );
    }
    if (!canAccessZone(session.user, existing)) {
      return Response.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const updateFields = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return Response.json(
          { success: false, message: "Name is required" },
          { status: 400 }
        );
      }
      updateFields.name = body.name.trim();
      updateFields.slug = body.name.trim().toLowerCase().replace(/\s+/g, "-");
    }
    if (body.distanceKm !== undefined) {
      const numericDistanceKm = Number(body.distanceKm);
      if (!Number.isFinite(numericDistanceKm) || numericDistanceKm < 0) {
        return Response.json(
          { success: false, message: "distanceKm must be >= 0" },
          { status: 400 }
        );
      }
      updateFields.distanceKm = numericDistanceKm;
    }
    if (normalizedFixedPrice.present) {
      updateFields.fixedPrice = normalizedFixedPrice.value;
    }
    if (body.isFreeDelivery !== undefined)
      updateFields.isFreeDelivery = body.isFreeDelivery;
    if (body.isActive !== undefined) updateFields.isActive = body.isActive;
    if (body.coordinates !== undefined)
      updateFields.coordinates = body.coordinates;
    if (
      isSuperAdminUser(session.user) &&
      body.ownerId !== undefined &&
      normalizeOwnerId(body.ownerId)
    ) {
      updateFields.ownerId = normalizeOwnerId(body.ownerId);
    }

    const zone = await DeliveryZone.findByIdAndUpdate(zoneId, updateFields, {
      new: true,
    });

    return Response.json({ success: true, data: zone });
  } catch (error) {
    console.error("[delivery-zones PATCH]", error);
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await connectToDB();
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { zoneId } = params;
    const existing = await DeliveryZone.findById(zoneId).lean();
    if (!existing) {
      return Response.json(
        { success: false, message: "Zone not found" },
        { status: 404 }
      );
    }
    if (!canAccessZone(session.user, existing)) {
      return Response.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    await DeliveryZone.findByIdAndDelete(zoneId);
    return Response.json({ success: true, message: "Zone deleted" });
  } catch (error) {
    console.error("[delivery-zones DELETE]", error);
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
