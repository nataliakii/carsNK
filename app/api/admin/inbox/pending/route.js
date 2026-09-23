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
import { getServerSessionWithViewAs } from "@lib/adminAuth";
import {
  buildPendingRentalsFilter,
  buildPendingTransfersFilter,
  resolveAdminCountryOwnerIds,
  sumPendingInbox,
} from "@/domain/orders/pendingInbox";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import { normalizeAdminCountryFilter } from "@/domain/platform/adminCountryScope";
import { getSiteCountryConfig } from "@config/siteCountry";
import { TRANSFER_OPEN_STATUSES } from "@/domain/transfers/transferStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
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
        const company = await Company.findById(ownerId).select("country").lean();
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
    let transferFilter = buildPendingTransfersFilter(session, country);

    // Partners: unclaimed open transfers only in their country
    if (!isSuperAdminUser(session.user)) {
      const ownerId = getSessionOwnerId(session.user);
      if (ownerId && country && country !== "ALL") {
        transferFilter = {
          $and: [
            transferFilter,
            {
              $or: [
                { assignedSupplierId: ownerId },
                { claimedByCompanyId: ownerId },
                {
                  country,
                  status: { $in: TRANSFER_OPEN_STATUSES },
                },
              ],
            },
          ],
        };
      }
    }

    const [rentals, transfers] = await Promise.all([
      Order.countDocuments(rentalFilter),
      Transfer.countDocuments(transferFilter),
    ]);

    const counts = sumPendingInbox({ rentals, transfers });

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
