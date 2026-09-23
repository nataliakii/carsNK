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
import { normalizeCarOffices } from "@/domain/orders/carOffices";
import { listCarPhotos, photosForSave } from "@/domain/cars/carPhotos";
import { extractAuditContext } from "@/domain/legal/auditTrail";
import {
  assertMarketplaceCarPublish,
  auditPartnerComplianceBlock,
  partnerComplianceJson,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";

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

    if (updateFields.offices !== undefined) {
      updateFields.offices = normalizeCarOffices(updateFields.offices);
      const Company = (await import("@models/company")).default;
      const owner = existingCar.ownerId
        ? await Company.findById(existingCar.ownerId).select("offices").lean()
        : null;
      const { syncCarOfficeIds } = await import("@/domain/company/officeRecord");
      const synced = syncCarOfficeIds({
        offices: updateFields.offices,
        officeIds: updateFields.officeIds,
        officeScope: updateFields.officeScope,
        company: owner,
      });
      updateFields.officeIds = synced.officeIds;
      updateFields.officeScope = synced.officeScope;
    }

    if (updateFields.photos !== undefined || updateFields.photoUrl !== undefined) {
      const merged = photosForSave(
        listCarPhotos({
          photoUrl: updateFields.photoUrl ?? existingCar.photoUrl,
          photos:
            updateFields.photos !== undefined
              ? updateFields.photos
              : existingCar.photos,
        })
      );
      updateFields.photos = merged.photos;
      updateFields.photoUrl = merged.photoUrl;
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

    const resultingCar = { ...existingCar, ...updateFields };
    const ownerId = resultingCar.ownerId;
    const Company = (await import("@models/company")).default;
    const ownerCompany = ownerId
      ? await Company.findById(ownerId)
          .select("_id country bookingMode listedOnMarketplace")
          .lean()
      : null;
    const { ipAddress, userAgent } = extractAuditContext(req);
    const publishGate = await assertMarketplaceCarPublish(ownerId, {
      car: resultingCar,
      company: ownerCompany,
      overrideReason: isSuperAdminUser(session.user)
        ? String(updateFields.complianceOverrideReason || "")
        : "",
      overrideByRole: isSuperAdminUser(session.user) ? "superadmin" : "admin",
      overrideByEmail: session.user?.email || "",
      audit: { ipAddress, userAgent, carId: _id },
    });
    delete updateFields.complianceOverrideReason;
    if (!publishGate.allowed) {
      await auditPartnerComplianceBlock({
        purpose: PARTNER_OPERATION_PURPOSE.CAR_PUBLISH,
        result: publishGate,
        actorEmail: session.user?.email || "",
        actorRole: isSuperAdminUser(session.user) ? "superadmin" : "admin",
        ipAddress,
        userAgent,
        carId: _id,
      });
      return new Response(JSON.stringify(partnerComplianceJson(publishGate)), {
        status: 403,
        headers: { "Content-Type": "application/json" },
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
