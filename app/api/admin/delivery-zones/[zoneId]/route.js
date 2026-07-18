import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { DeliveryZone } from "@models/DeliveryZone";

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

export async function PATCH(request, { params }) {
  try {
    await connectToDB();
    const { errorResponse } = await requireAdmin(request);
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
    if (body.isFreeDelivery !== undefined) updateFields.isFreeDelivery = body.isFreeDelivery;
    if (body.isActive !== undefined) updateFields.isActive = body.isActive;
    if (body.coordinates !== undefined) updateFields.coordinates = body.coordinates;

    const zone = await DeliveryZone.findByIdAndUpdate(zoneId, updateFields, {
      new: true,
    });

    if (!zone) {
      return Response.json(
        { success: false, message: "Zone not found" },
        { status: 404 }
      );
    }

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
    const { errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { zoneId } = params;
    const zone = await DeliveryZone.findByIdAndDelete(zoneId);

    if (!zone) {
      return Response.json(
        { success: false, message: "Zone not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, message: "Zone deleted" });
  } catch (error) {
    console.error("[delivery-zones DELETE]", error);
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
