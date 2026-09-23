import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getCompany } from "@/domain/services";
import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import { rentalPaymentUpdatesFromPatch } from "@/domain/company/rentalPaymentSettingsPatch";
import { marketplaceBookingFeeAuditMetadata } from "@/domain/orders/marketplaceBookingFee";
import {
  assertPartnerCanOperate,
  isMarketplaceOperatingCompany,
  partnerComplianceJson,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";

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
    // Public site footer/brand uses COMPANY_ID — do not rename it to a partner.
    if (companyId !== String(COMPANY_ID)) {
      updates.name = name;
    }
  }
  if (body?.email != null) {
    updates.email = String(body.email).trim();
  }
  if (body?.tel != null) {
    updates.tel = String(body.tel).trim();
  }
  if (body?.deliveryPricePerKm != null) {
    const rate = Number(body.deliveryPricePerKm);
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json(
        { error: "deliveryPricePerKm must be >= 0" },
        { status: 400 }
      );
    }
    updates.deliveryPricePerKm = rate;
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
  if (body?.slug != null) {
    const { ensureUniqueCompanySlug } = await import("@/domain/platform/companySlug");
    const desired = String(body.slug || "").trim() || String(body.name || "").trim();
    updates.slug = await ensureUniqueCompanySlug(Company, desired, companyId);
  }
  if (body?.storefrontEnabled != null) {
    updates.storefrontEnabled = Boolean(body.storefrontEnabled);
  }
  if (body?.listedOnMarketplace != null) {
    updates.listedOnMarketplace = Boolean(body.listedOnMarketplace);
  }
  if (body?.useSeasons != null) {
    updates.useSeasons = Boolean(body.useSeasons);
  }
  // Country is fixed to the deployment site — ignore client overrides.
  if (body?.country != null) {
    const { getSiteCountryCode } = await import("@config/siteCountry");
    updates.country = getSiteCountryCode();
  }
  if (body?.bufferTime != null) {
    const n = Number(body.bufferTime);
    if (!Number.isFinite(n) || n < 0 || n > 24) {
      return NextResponse.json({ error: "bufferTime must be 0–24" }, { status: 400 });
    }
    updates.bufferTime = n;
  }
  if (body?.minRentalDuration != null) {
    const n = Number(body.minRentalDuration);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: "minRentalDuration must be >= 1" }, { status: 400 });
    }
    updates.minRentalDuration = n;
  }
  if (body?.defaultStart != null) {
    updates.defaultStart = String(body.defaultStart).trim();
  }
  if (body?.defaultEnd != null) {
    updates.defaultEnd = String(body.defaultEnd).trim();
  }
  if (body?.workingHours != null && typeof body.workingHours === "object") {
    const start = String(body.workingHours.start || "08:00").trim();
    const end = String(body.workingHours.end || "22:00").trim();
    updates.workingHours = { start, end };
  }
  if (body?.langAdmin != null) {
    const { normalizeNotifyLocale } = await import(
      "@/domain/orders/adminNotifyLocales"
    );
    updates.langAdmin = normalizeNotifyLocale(body.langAdmin);
  }
  if (body?.langSuperadmin != null && isSuperAdminUser(user)) {
    const { normalizeNotifyLocale } = await import(
      "@/domain/orders/adminNotifyLocales"
    );
    updates.langSuperadmin = normalizeNotifyLocale(body.langSuperadmin);
  }
  if (Array.isArray(body?.offices)) {
    // Authoritative office mutations go through /api/admin/offices so `_id`s stay stable.
    // Whole-array replace on company PATCH is rejected for normal admins.
    if (!isSuperAdminUser(user)) {
      return NextResponse.json(
        {
          error:
            "Use /api/admin/offices to create or update offices. Whole-array offices replace is no longer supported.",
          code: "OFFICES_USE_ADMIN_API",
        },
        { status: 400 }
      );
    }
    const { companyOfficesPatchValue, primaryOfficePoint, mergeOfficesPreservingIds } =
      await import("@/domain/company/companyOffices");
    await connectToDB();
    const existing = await Company.findById(companyId).select("offices").lean();
    const offices = mergeOfficesPreservingIds
      ? mergeOfficesPreservingIds(existing?.offices, body.offices)
      : companyOfficesPatchValue(body.offices);
    updates.offices = offices;
    const primary = primaryOfficePoint(offices);
    if (primary) {
      updates.coords = {
        lat: String(primary.lat),
        lon: String(primary.lon),
      };
    }
  }
  if (Array.isArray(body?.cityIds)) {
    const ids = body.cityIds
      .map((id) => String(id || "").trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    updates.cityIds = ids;
  }
  if (body?.orderRadiusKm !== undefined) {
    if (body.orderRadiusKm === null || body.orderRadiusKm === "") {
      updates.orderRadiusKm = null;
    } else {
      const n = Number(body.orderRadiusKm);
      if (!Number.isFinite(n) || n < 0 || n > 5000) {
        return NextResponse.json(
          { error: "orderRadiusKm must be 0–5000 or empty" },
          { status: 400 }
        );
      }
      updates.orderRadiusKm = n;
    }
  }
  if (body?.meetingContacts != null) {
    const { meetingContactsUpdatePayload } = await import(
      "@/domain/company/meetingContacts"
    );
    Object.assign(updates, meetingContactsUpdatePayload(body.meetingContacts));
  } else {
    if (body?.meetingContactPhone != null) {
      updates.meetingContactPhone = String(body.meetingContactPhone).trim();
    }
    if (body?.meetingContactName != null) {
      updates.meetingContactName = String(body.meetingContactName).trim();
    }
    if (body?.meetingContactChannel != null) {
      updates.meetingContactChannel = String(body.meetingContactChannel).trim();
    }
  }

  const rentalPaymentPatch = rentalPaymentUpdatesFromPatch(body, user);
  if (!rentalPaymentPatch.ok) {
    return NextResponse.json(
      { error: rentalPaymentPatch.error },
      { status: rentalPaymentPatch.status }
    );
  }
  Object.assign(updates, rentalPaymentPatch.updates);

  let listingWasEnabled = false;
  if (updates.listedOnMarketplace != null) {
    await connectToDB();
    const existingCompany = await Company.findById(companyId)
      .select("_id country bookingMode listedOnMarketplace")
      .lean();
    listingWasEnabled = existingCompany?.listedOnMarketplace !== false;
    if (updates.listedOnMarketplace === true && isMarketplaceOperatingCompany(existingCompany)) {
      if (!isSuperAdminUser(user)) {
        return NextResponse.json(
          {
            error: "Forbidden",
            code: "MARKETPLACE_LISTING_SUPERADMIN_ONLY",
            message: "Marketplace listing is enabled by Rovaro after verification.",
          },
          { status: 403 }
        );
      }
      const listingGate = await assertPartnerCanOperate(companyId, {
        company: existingCompany,
        requireListed: false,
        purpose: PARTNER_OPERATION_PURPOSE.LISTING,
      });
      if (!listingGate.allowed) {
        return NextResponse.json(partnerComplianceJson(listingGate), {
          status: 403,
        });
      }
    }
  }

  try {
    await connectToDB();

    if (body?.deliveryPricing !== undefined) {
      const { normalizeDeliveryPricingInput } = await import(
        "@/domain/delivery/deliveryPricingPolicy"
      );
      const existing = await Company.findById(companyId)
        .select("deliveryPricing deliveryPricePerKm")
        .lean();
      const normalized = normalizeDeliveryPricingInput(
        body.deliveryPricing,
        existing || {}
      );
      if (!normalized.ok) {
        return NextResponse.json({ error: normalized.message }, { status: 400 });
      }
      if (normalized.value === null) {
        updates.$unset = { ...(updates.$unset || {}), deliveryPricing: 1 };
      } else {
        updates.deliveryPricing = normalized.value;
        if (
          normalized.value.inside?.mode === "perKm" &&
          Number.isFinite(normalized.value.inside.amount)
        ) {
          updates.deliveryPricePerKm = normalized.value.inside.amount;
        }
      }
    }

    const unset = updates.$unset;
    delete updates.$unset;
    if (!Object.keys(updates).length && !unset) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const feeChanging = Object.prototype.hasOwnProperty.call(
      updates,
      "marketplaceBookingFeeBps"
    );
    let previousFeeBps = null;
    if (feeChanging) {
      const prevFee = await Company.findById(companyId)
        .select("marketplaceBookingFeeBps")
        .lean();
      previousFeeBps = prevFee?.marketplaceBookingFeeBps ?? null;
    }

    const updateDoc = {};
    if (Object.keys(updates).length) updateDoc.$set = updates;
    if (unset) updateDoc.$unset = unset;

    const company = await Company.findByIdAndUpdate(companyId, updateDoc, {
      new: true,
    }).lean();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    revalidatePath(`/api/company/${companyId}`);

    if (
      listingWasEnabled &&
      company.listedOnMarketplace === false &&
      isMarketplaceOperatingCompany(company)
    ) {
      const {
        CHECKOUT_INVALIDATION_REASON,
        invalidateOpenMarketplaceCheckoutSessions,
      } = await import("@/domain/orders/invalidateMarketplaceCheckout");
      await invalidateOpenMarketplaceCheckoutSessions(companyId, {
        reason: CHECKOUT_INVALIDATION_REASON.MARKETPLACE_DISABLED,
        actorEmail: user?.email || "",
        actorRole: isSuperAdminUser(user) ? "superadmin" : "admin",
      }).catch((err) => {
        console.error("[company] checkout invalidate failed", err?.message || err);
      });
    }

    if (feeChanging) {
      const { recordAuditEvent, extractAuditContext } = await import(
        "@/domain/legal/auditTrail"
      );
      const { ipAddress, userAgent } = extractAuditContext(request);
      const newBps = company.marketplaceBookingFeeBps ?? null;
      await recordAuditEvent({
        action: "MARKETPLACE_BOOKING_FEE_CHANGED",
        userRole: "superadmin",
        userId: user?.id,
        userEmail: user?.email,
        ipAddress,
        userAgent,
        reason: String(body?.marketplaceBookingFeeReason || "").slice(0, 500),
        metadata: marketplaceBookingFeeAuditMetadata({
          companyId,
          previousBps: previousFeeBps,
          newBps,
          actorEmail: user?.email,
          actorUserId: user?.id,
          reason: String(body?.marketplaceBookingFeeReason || "").slice(0, 500),
        }),
      });
    }

    if (body?.deliveryPricing !== undefined || Array.isArray(body?.offices)) {
      const { recordAuditEvent } = await import("@/domain/legal/auditTrail");
      await recordAuditEvent({
        action: Array.isArray(body?.offices)
          ? "COMPANY_OFFICE_UPDATED"
          : "COMPANY_DELIVERY_PRICING_UPDATED",
        userRole: isSuperAdminUser(user) ? "superadmin" : "admin",
        userId: user?.id,
        userEmail: user?.email,
        metadata: {
          companyId,
          kind: Array.isArray(body?.offices)
            ? "offices"
            : "deliveryPricing",
        },
      });
    }

    return NextResponse.json(company, { status: 200 });
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update company" },
      { status: 500 }
    );
  }
}
