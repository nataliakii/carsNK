import { Car } from "@models/car";
import { connectToDB } from "@lib/database";
import { revalidatePath, revalidateTag } from "next/cache";
import dayjs from "dayjs";
import { generateSlugBase, ensureUniqueSlug } from "@utils/slugCar";
import { requireAdmin } from "@lib/adminAuth";
import {
  canAccessOwnedDoc,
  isSuperAdminUser,
  normalizeOwnerId,
} from "@/domain/owners/ownerScope";

export const PUT = async (req) => {
  try {
    const { session, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    await connectToDB();

    const { _id, ...updateFields } = await req.json();

    updateFields.dateLastModified = dayjs().toDate();

    // Auto-generate slug if model/transmission changed or car has no slug yet
    const existingCar = await Car.findById(_id).lean();
    if (!existingCar) {
      return new Response(
        JSON.stringify({ success: false, message: "Car not found" }),
        { status: 404 }
      );
    }
    if (!canAccessOwnedDoc(session.user, existingCar)) {
      return new Response(
        JSON.stringify({ success: false, message: "Forbidden" }),
        { status: 403 }
      );
    }
    // Only superadmin may reassign ownerId
    if (
      updateFields.ownerId !== undefined &&
      !isSuperAdminUser(session.user)
    ) {
      delete updateFields.ownerId;
    } else if (updateFields.ownerId !== undefined) {
      updateFields.ownerId = normalizeOwnerId(updateFields.ownerId);
    }

    const needsSlugUpdate =
      !existingCar?.slug ||
      (updateFields.model && updateFields.model !== existingCar.model) ||
      (updateFields.transmission && updateFields.transmission !== existingCar.transmission);

    if (needsSlugUpdate) {
      const mergedData = { ...existingCar, ...updateFields };
      const slugBase = generateSlugBase(mergedData);
      updateFields.slug = await ensureUniqueSlug(slugBase, async (slug) => {
        const existing = await Car.findOne({
          slug: slug.trim().toLowerCase(),
          _id: { $ne: _id },
        }).lean();
        return !!existing;
      });
    }

    const updatedCar = await Car.findByIdAndUpdate(_id, updateFields, {
      new: true,
    });

    if (!updatedCar) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Car not found",
        }),
        { status: 404 }
      );
    }
    
    // Инвалидируем кеш для списка машин и конкретной машины
    revalidateTag("cars");
    revalidatePath("/api/car/all");
    revalidatePath(`/api/car/${_id}`);
    
    return new Response(JSON.stringify(updatedCar), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: "Failed to update car", error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
