import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { DeliveryZone } from "@models/DeliveryZone";
import { sortDeliveryZones } from "@/domain/delivery/sortDeliveryZones";

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

export async function GET(request) {
  try {
    await connectToDB();
    const { errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const zones = await DeliveryZone.find().lean();
    return Response.json({ success: true, data: sortDeliveryZones(zones) });
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
    const { errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { name, distanceKm, fixedPrice, isFreeDelivery, coordinates } = body;
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

    const existing = await DeliveryZone.findOne({ slug });
    if (existing) {
      return Response.json(
        { success: false, message: `Zone "${name}" already exists` },
        { status: 409 }
      );
    }

    const zone = await DeliveryZone.create({
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
