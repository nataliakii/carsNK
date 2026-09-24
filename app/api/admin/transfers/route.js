import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import Transfer, {
  TRANSFER_OPEN_STATUSES,
  isTransferOpenStatus,
  normalizeTransferStatus,
} from "@models/Transfer";
import Company from "@models/company";
import {
  getEffectiveOwnerId,
  getSessionOwnerId,
} from "@/domain/owners/ownerScope";
import { normalizeAdminCountryFilter } from "@/domain/platform/adminCountryScope";
import { getSiteCountryConfig } from "@config/siteCountry";
import { redactUnclaimedPartnerPii } from "@/domain/transfers/claimTransfer";
import { Car } from "@models/car";
import {
  ADMIN_VIEW_MODE,
  resolveAdminViewMode,
} from "@/domain/admin/adminViewMode";
import {
  buildCompanyTransferBaseFilter,
  listVisibleTransfersForCompany,
} from "@/domain/transfers/transferVisibility";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function serialize(item, companyNameById = {}) {
  const claimedId = item.assignedSupplierId
    ? String(item.assignedSupplierId)
    : item.claimedByCompanyId
      ? String(item.claimedByCompanyId)
      : null;
  const quote = item.quoteSnapshot;
  return {
    ...item,
    _id: item._id.toString(),
    status: normalizeTransferStatus(item.status),
    claimedByCompanyId: claimedId,
    assignedSupplierId: claimedId,
    claimedByCompanyName: claimedId
      ? companyNameById[claimedId] || claimedId
      : null,
    assignedCarId: item.assignedCarId ? String(item.assignedCarId) : null,
    isOpen: isTransferOpenStatus(item.status) && !claimedId,
    customerPriceMinor: quote?.customerPriceMinor ?? null,
    supplierPayoutMinor: quote?.supplierPayoutMinor ?? null,
    platformMarginMinor: quote?.platformMarginMinor ?? null,
    pricingMethod: quote?.pricingMethod ?? null,
    currency: quote?.currency || "EUR",
    paymentStatus: item.payment?.status || null,
    paymentCheckoutUrl: item.payment?.checkoutUrl || null,
    paymentCollectionMode: item.payment?.collectionMode || null,
    paymentOnSiteAmountMinor: item.payment?.onSiteAmountMinor ?? null,
  };
}

function serializeForViewer(item, companyNameById, { isSuperAdmin, ownerId }) {
  const serialized = serialize(item, companyNameById);
  if (isSuperAdmin) return serialized;

  const claimedByThisCompany =
    Boolean(ownerId) &&
    serialized.claimedByCompanyId &&
    String(serialized.claimedByCompanyId) === String(ownerId);

  if (claimedByThisCompany) return serialized;

  return redactUnclaimedPartnerPii(serialized);
}

export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get("status") || "").trim();
  const countryParam = normalizeAdminCountryFilter(
    searchParams.get("country") || getSiteCountryConfig().country
  );
  const limit = Math.min(
    200,
    Math.max(1, Number(searchParams.get("limit")) || 100)
  );
  const skip = Math.max(0, Number(searchParams.get("skip")) || 0);

  try {
    await connectToDB();
    const user = session.user;
    const viewMode = resolveAdminViewMode(user);
    let filter = {};
    let companyViewer = null;
    let companyCars = [];
    let viewerOwnerId = null;

    if (viewMode === ADMIN_VIEW_MODE.PLATFORM_ADMIN) {
      if (status === "open") {
        filter = {
          status: { $in: TRANSFER_OPEN_STATUSES },
          $or: [
            { assignedSupplierId: null },
            { assignedSupplierId: { $exists: false } },
          ],
        };
      } else if (status) {
        filter.status = status;
      }
      if (countryParam !== "ALL") {
        filter.country = countryParam;
      }
    } else {
      const ownerId =
        getEffectiveOwnerId(user) || getSessionOwnerId(user);
      if (!ownerId) {
        return json({ success: false, message: "Forbidden" }, 403);
      }
      viewerOwnerId = ownerId;
      const company = await Company.findById(ownerId)
        .select(
          "country email transferServices deliveryPricing offices serviceAreas orderRadiusKm"
        )
        .lean();
      companyViewer = company;
      companyCars = await Car.find({ ownerId })
        .select(
          "ownerId seats class model PriceChildSeats childSeats childSeatsAvailable isActive testingCar isHidden deletedAt unavailable status"
        )
        .lean();
      const companyCountry = String(company?.country || "").toUpperCase();
      filter = buildCompanyTransferBaseFilter(ownerId, companyCountry, status);
    }

    let items;
    let total = null;

    if (viewMode === ADMIN_VIEW_MODE.COMPANY && companyViewer) {
      const page = await listVisibleTransfersForCompany({
        TransferModel: Transfer,
        baseFilter: filter,
        company: companyViewer,
        cars: companyCars,
        ownerId: viewerOwnerId,
        limit,
        skip,
      });
      items = page.items;
      total = page.total;
    } else {
      total = await Transfer.countDocuments(filter);
      items = await Transfer.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const companyIds = [
      ...new Set(
        items
          .map((i) =>
            i.assignedSupplierId
              ? String(i.assignedSupplierId)
              : i.claimedByCompanyId
                ? String(i.claimedByCompanyId)
                : ""
          )
          .filter(Boolean)
      ),
    ];
    const companies = companyIds.length
      ? await Company.find({ _id: { $in: companyIds } })
          .select("name")
          .lean()
      : [];
    const companyNameById = {};
    for (const c of companies) {
      companyNameById[String(c._id)] = c.name;
    }

    return json({
      success: true,
      country: countryParam,
      total,
      limit,
      skip,
      items: items.map((item) =>
        serializeForViewer(item, companyNameById, {
          isSuperAdmin: viewMode === ADMIN_VIEW_MODE.PLATFORM_ADMIN,
          ownerId:
            viewMode === ADMIN_VIEW_MODE.PLATFORM_ADMIN
              ? null
              : viewerOwnerId || getSessionOwnerId(user),
        })
      ),
    });
  } catch (error) {
    console.error("[admin/transfers] list failed", error);
    return json({ success: false, message: error.message }, 500);
  }
}
