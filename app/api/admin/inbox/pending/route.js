/**
 * GET /api/admin/inbox/pending
 * Counts unprocessed rentals + transfers for admin badges / notifications.
 *
 * Superadmin workspace country scopes BOTH rentals and transfers so Spain
 * mode never includes Greek OPS_CALENDAR rentals (and vice versa).
 */

import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import Transfer from "@models/Transfer";
import Company from "@models/company";
import { Car } from "@models/car";
import { getServerSessionWithViewAs } from "@lib/adminAuth";
import {
  buildPendingRentalsFilter,
  buildPendingTransfersFilter,
  resolveAdminCountryOwnerIds,
  sumPendingInbox,
} from "@/domain/orders/pendingInbox";
import {
  getEffectiveOwnerId,
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import { resolveCurrentPartnerPackage } from "@/domain/legal/agreementService";
import { buildCompanySetupTasks } from "@/domain/legal/companySetupTasks";
import { normalizeAdminCountryFilter } from "@/domain/platform/adminCountryScope";
import { getSiteCountryConfig } from "@config/siteCountry";
import { countVisibleOpenTransfersForCompany } from "@/domain/transfers/transferVisibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/** Company tasks for the signed-in company only. Query companyId is ignored. */
async function loadCompanySetupTasks(companyId) {
  const profile = await PartnerLegalProfile.findOne({ companyId })
    .select("verificationStatus documents")
    .lean();
  let resolved = null;
  try {
    resolved = await resolveCurrentPartnerPackage({
      companyId,
      requestedLocale: "en",
    });
  } catch (error) {
    console.error(
      "[admin/inbox/pending] company legal state failed",
      error?.message || error
    );
  }
  return buildCompanySetupTasks({
    verificationStatus: profile?.verificationStatus,
    legalState: resolved?.legalState?.state || "",
    legalManifest: resolved?.manifest || [],
    legalActionCount: resolved?.legalState?.legalActionCount || 0,
    documents: profile?.documents || [],
  });
}

export async function GET(request) {
  try {
    const session = await getServerSessionWithViewAs(request);
    if (!session?.user?.isAdmin) {
      return json({ success: false, message: "Unauthorized" }, 401);
    }

    await connectToDB();

    const { searchParams } = new URL(request.url);
    let country = normalizeAdminCountryFilter(
      searchParams.get("country") || getSiteCountryConfig().country
    );

    if (!isSuperAdminUser(session.user)) {
      const ownerId = getSessionOwnerId(session.user);
      if (ownerId) {
        const company = await Company.findById(ownerId)
          .select("country")
          .lean();
        const companyCountry = String(company?.country || "").toUpperCase();
        if (companyCountry) country = companyCountry;
      }
    }

    const ownerIds = isSuperAdminUser(session.user)
      ? await resolveAdminCountryOwnerIds(Company, country)
      : null;

    const rentalFilter = buildPendingRentalsFilter(session, country, {
      ownerIds,
    });

    const companyViewerId = isSuperAdminUser(session.user)
      ? getEffectiveOwnerId(session.user)
      : getSessionOwnerId(session.user);
    const useCompanyTransferVisibility = Boolean(companyViewerId);

    let transfers = 0;
    if (useCompanyTransferVisibility) {
      // Partner / view-as: same coverage visibility as the transfer list (not country-wide).
      const company = await Company.findById(companyViewerId)
        .select(
          "country email transferServices deliveryPricing offices serviceAreas orderRadiusKm"
        )
        .lean();
      const cars = await Car.find({ ownerId: companyViewerId })
        .select(
          "ownerId seats class model PriceChildSeats childSeats childSeatsAvailable isActive testingCar isHidden deletedAt unavailable status"
        )
        .lean();
      transfers = await countVisibleOpenTransfersForCompany({
        TransferModel: Transfer,
        company,
        cars,
        ownerId: companyViewerId,
        companyCountry: String(company?.country || country || "").toUpperCase(),
      });
    } else {
      const transferFilter = buildPendingTransfersFilter(session, country);
      transfers = await Transfer.countDocuments(transferFilter);
    }

    const rentals = await Order.countDocuments(rentalFilter);

    const companySetupTasks = companyViewerId
      ? await loadCompanySetupTasks(companyViewerId)
      : [];

    const counts = sumPendingInbox({
      rentals,
      transfers,
      companySetupTasks,
    });

    return json({
      success: true,
      ...counts,
      country,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/inbox/pending]", error);
    return json({ success: false, message: error.message }, 500);
  }
}
