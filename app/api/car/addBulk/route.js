import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@lib/adminAuth";
import { createCarFromPayload } from "@/domain/cars/createCarFromPayload";
import { uploadCarImageFile } from "@/domain/cars/uploadCarImage";

export const runtime = "nodejs";

/**
 * POST /api/car/addBulk
 * Accepts:
 * - multipart/form-data: field `cars` (JSON string), optional `ownerId`,
 *   files `image_0` … `image_N` matching car indices
 * - application/json: { cars: object[], ownerId? } (no new photos)
 */
export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const contentType = request.headers.get("content-type") || "";
  let cars = null;
  let ownerId = "";
  /** @type {Map<number, File>} */
  const imagesByIndex = new Map();

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const rawCars = form.get("cars");
      cars = JSON.parse(String(rawCars || "[]"));
      ownerId = String(form.get("ownerId") || "").trim();
      for (const [key, value] of form.entries()) {
        const m = /^image_(\d+)$/.exec(key);
        if (!m) continue;
        if (value && typeof value === "object" && "arrayBuffer" in value) {
          imagesByIndex.set(Number(m[1]), value);
        }
      }
    } else {
      const body = await request.json();
      cars = body?.cars;
      ownerId = String(body?.ownerId || "").trim();
    }
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request body",
        details: err?.message,
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(cars) || cars.length === 0) {
    return NextResponse.json(
      { success: false, message: "cars array is required" },
      { status: 400 }
    );
  }
  if (cars.length > 50) {
    return NextResponse.json(
      { success: false, message: "Max 50 cars per bulk request" },
      { status: 400 }
    );
  }

  await connectToDB();

  const created = [];
  const errors = [];

  for (let i = 0; i < cars.length; i += 1) {
    const row = { ...cars[i] };
    const file = imagesByIndex.get(i);
    if (file) {
      try {
        row.photoUrl = await uploadCarImageFile(file);
      } catch (err) {
        errors.push({
          index: i,
          error: err?.message || "Image upload failed",
          model: row?.model,
        });
        continue;
      }
    }

    const result = await createCarFromPayload(row, {
      user: session.user,
      requestedOwnerId: ownerId || undefined,
    });
    if (result.ok) {
      created.push({
        index: i,
        id: String(result.car._id),
        carNumber: result.car.carNumber,
        model: result.car.model,
        slug: result.car.slug,
        photoUrl: result.car.photoUrl,
      });
    } else {
      errors.push({ index: i, error: result.error, model: row?.model });
    }
  }

  if (created.length > 0) {
    revalidateTag("cars");
    revalidatePath("/api/car/all");
    revalidatePath("/api/car/models");
  }

  return NextResponse.json(
    {
      success: errors.length === 0,
      created,
      errors,
      message:
        errors.length === 0
          ? `Created ${created.length} car(s)`
          : `Created ${created.length}, failed ${errors.length}`,
    },
    { status: created.length > 0 ? 201 : 400 }
  );
}
