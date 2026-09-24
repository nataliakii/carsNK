import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { Car } from "@models/car";
import { DEFAULT_VEHICLE_CATEGORIES } from "@models/TransferVehicleCategory";
import {
  getEffectiveOwnerId,
  getSessionOwnerId,
} from "@/domain/owners/ownerScope";
import {
  ADMIN_VIEW_MODE,
  resolveAdminViewMode,
} from "@/domain/admin/adminViewMode";
import {
  assertCanEditTransferPayments,
  canEditTransferPayments,
  defaultUseRentalFleetForForm,
  formatTransferCoverageSummary,
  mergeTransferServices,
  normalizeStringList,
  normalizeVehicleCategoryCodes,
  redactTransferPayments,
  resolveAcceptAllTransferRequests,
  resolveTransferCoverageFollowsCompany,
  resolveTransferServiceArea,
  resolveUseRentalFleet,
  usesCustomTransferEmail,
} from "@/domain/transfers/transferSettings";
import {
  compactServiceAreas,
  normalizeServiceAreasInput,
} from "@/domain/geo/spainAdminDivisions";
import { serviceAreasFromCompany } from "@/domain/geo/coverageNormalization";
import {
  buildFleetCapacity,
  listEligibleFleetCars,
  summarizeCarForTransfer,
} from "@/domain/transfers/transferFleet";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function resolveCompanyAccess(user, requestedId) {
  const viewMode = resolveAdminViewMode(user);
  const sessionOwner =
    getEffectiveOwnerId(user) || getSessionOwnerId(user);
  const requested = requestedId ? String(requestedId).trim() : "";

  if (viewMode === ADMIN_VIEW_MODE.COMPANY) {
    const companyId = sessionOwner || requested;
    if (!companyId) {
      return { error: json({ success: false, message: "companyId required" }, 400) };
    }
    if (requested && sessionOwner && requested !== String(sessionOwner)) {
      return { error: json({ success: false, message: "Forbidden" }, 403) };
    }
    return { companyId, viewMode };
  }

  const companyId = requested || sessionOwner;
  if (!companyId) {
    return { error: json({ success: false, message: "companyId required" }, 400) };
  }
  return { companyId, viewMode };
}

function serializeTransferServices(company, cars, viewMode) {
  const ts = company.transferServices || { enabled: false };
  const eligible = listEligibleFleetCars(cars);
  const editPayments = canEditTransferPayments(viewMode);
  const payload = editPayments ? { ...ts } : redactTransferPayments(ts);
  const area = resolveTransferServiceArea(company);
  return {
    ...payload,
    useRentalFleet: resolveUseRentalFleet(ts),
    acceptAllTransferRequests: resolveAcceptAllTransferRequests(ts),
    transferCoverageFollowsCompany: resolveTransferCoverageFollowsCompany(ts),
    transferNotifyEmail: String(ts.transferNotifyEmail || ""),
    _formDefaults: {
      useRentalFleet: defaultUseRentalFleetForForm(ts, eligible.length > 0),
      useDifferentEmail: usesCustomTransferEmail(company),
    },
    _resolvedArea: area,
  };
}

/**
 * GET/PATCH company transferServices capabilities.
 * Suppliers cannot edit customer prices here.
 * Stripe / payment flags: PLATFORM_ADMIN_MODE only.
 */
export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const access = resolveCompanyAccess(
    session.user,
    searchParams.get("companyId")
  );
  if (access.error) return access.error;

  await connectToDB();
  const company = await Company.findById(access.companyId)
    .select(
      "name email country transferServices deliveryPricing offices serviceAreas orderRadiusKm coords"
    )
    .lean();
  if (!company) return json({ success: false, message: "Not found" }, 404);

  const cars = await Car.find({ ownerId: company._id })
    .select(
      "ownerId seats class model PriceChildSeats childSeats childSeatsAvailable isActive testingCar isHidden deletedAt unavailable status"
    )
    .lean();

  const eligible = listEligibleFleetCars(cars);
  const companyCoverage = serviceAreasFromCompany(company);
  const resolvedArea = resolveTransferServiceArea(company);

  return json({
    success: true,
    companyId: String(company._id),
    companyEmail: company.email || "",
    companyCountry: company.country || "",
    offices: company.offices || [],
    coords: company.coords || null,
    viewMode: access.viewMode,
    canEditPayments: canEditTransferPayments(access.viewMode),
    coverage: {
      ...resolvedArea,
      summary: formatTransferCoverageSummary(resolvedArea),
      company: {
        communityCodes: companyCoverage.communityCodes,
        provinceCodes: companyCoverage.provinceCodes,
        serviceCities: companyCoverage.cities,
        radiusKm: companyCoverage.radiusKm,
        summary: formatTransferCoverageSummary({
          communityCodes: companyCoverage.communityCodes,
          provinceCodes: companyCoverage.provinceCodes,
          serviceCities: companyCoverage.cities,
          airportsServed: resolvedArea.airportsServed,
        }),
      },
      editCoverageHref: "/admin/company?tab=delivery",
    },
    fleet: {
      hasActiveCars: eligible.length > 0,
      activeCarCount: eligible.length,
      capacity: buildFleetCapacity(cars),
      cars: eligible.map(summarizeCarForTransfer),
    },
    vehicleCategoryOptions: DEFAULT_VEHICLE_CATEGORIES.map((c) => ({
      code: c.code,
      title: c.title,
    })),
    transferServices: serializeTransferServices(company, cars, access.viewMode),
  });
}

export async function PATCH(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const access = resolveCompanyAccess(session.user, payload.companyId);
  if (access.error) return access.error;

  const ts = { ...(payload.transferServices || {}) };
  delete ts.customerPrices;
  delete ts.pricingRules;

  if (access.viewMode !== ADMIN_VIEW_MODE.PLATFORM_ADMIN) {
    delete ts.blockedByAdmin;
    delete ts.suspended;
  }

  const paymentGate = assertCanEditTransferPayments(access.viewMode, ts);
  if (!paymentGate.ok) {
    return json({ success: false, message: paymentGate.message }, paymentGate.status);
  }

  if (ts.vehicleCategories !== undefined) {
    ts.vehicleCategories = normalizeVehicleCategoryCodes(ts.vehicleCategories);
  }
  if (ts.serviceCities !== undefined) {
    ts.serviceCities = normalizeStringList(ts.serviceCities);
  }
  if (ts.airportsServed !== undefined) {
    ts.airportsServed = normalizeStringList(ts.airportsServed);
  }
  if (ts.serviceAreas !== undefined) {
    const normalized = normalizeServiceAreasInput(ts.serviceAreas);
    if (!normalized.ok) {
      return json({ success: false, message: normalized.message }, 400);
    }
    ts.serviceAreas = compactServiceAreas(normalized.value);
  }
  if (ts.contactEmails !== undefined) {
    ts.contactEmails = normalizeStringList(ts.contactEmails);
  }
  if (ts.transferNotifyEmail !== undefined) {
    ts.transferNotifyEmail = String(ts.transferNotifyEmail || "").trim();
  }

  await connectToDB();
  const existing = await Company.findById(access.companyId)
    .select("transferServices")
    .lean();
  if (!existing) return json({ success: false, message: "Not found" }, 404);

  const merged = mergeTransferServices(existing.transferServices, ts, {
    canEditPayments: canEditTransferPayments(access.viewMode),
  });

  const doc = await Company.findByIdAndUpdate(
    access.companyId,
    { $set: { transferServices: merged } },
    { new: true }
  )
    .select(
      "name email country transferServices deliveryPricing offices serviceAreas orderRadiusKm coords"
    )
    .lean();

  if (!doc) return json({ success: false, message: "Not found" }, 404);

  const cars = await Car.find({ ownerId: doc._id })
    .select(
      "ownerId seats class model PriceChildSeats childSeats childSeatsAvailable isActive testingCar isHidden deletedAt unavailable status"
    )
    .lean();

  return json({
    success: true,
    viewMode: access.viewMode,
    canEditPayments: canEditTransferPayments(access.viewMode),
    transferServices: serializeTransferServices(doc, cars, access.viewMode),
  });
}
