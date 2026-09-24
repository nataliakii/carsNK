/**
 * Pending / unprocessed inbox criteria for admin badges & notifications.
 *
 * Rentals: not confirmed and still ACTIVE, scoped by admin workspace country.
 * Transfers: claimable / awaiting admin quote (not yet confirmed workflow).
 */

import mongoose from "mongoose";
import { ORDER_STATUS } from "@/domain/orders/orderStatus";
import {
  TRANSFER_STATUS,
  TRANSFER_OPEN_STATUSES,
} from "@/domain/transfers/transferStatus";
import {
  buildOrdersOwnerFilter,
  getEffectiveOwnerId,
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import {
  normalizeAdminCountryFilter,
  buildAdminCountryCompanyFilter,
} from "@/domain/platform/adminCountryScope";

/** Transfer statuses that still need admin / supplier attention. */
export const TRANSFER_PENDING_ATTENTION_STATUSES = [
  ...TRANSFER_OPEN_STATUSES,
  TRANSFER_STATUS.MANUAL_QUOTE_REQUIRED,
  TRANSFER_STATUS.AWAITING_ADMIN_QUOTE,
];

/**
 * Resolve company ObjectIds for a superadmin workspace country filter.
 * Used by rentals inbox so badge counts match the Orders table country scope.
 *
 * @param {import("mongoose").Model} CompanyModel
 * @param {string} countryCode - GR | ES | ALL
 * @returns {Promise<import("mongoose").Types.ObjectId[] | null>}
 *   null = no country restriction (ALL / partner / view-as)
 */
export async function resolveAdminCountryOwnerIds(CompanyModel, countryCode) {
  const country = normalizeAdminCountryFilter(countryCode);
  if (!country || country === "ALL") return null;
  const filter = buildAdminCountryCompanyFilter(country);
  const rows = await CompanyModel.find(filter).select("_id").lean();
  return rows.map((row) => row._id);
}

/**
 * @param {object|null} session
 * @param {string} [countryCode] - GR | ES | ALL (superadmin country switcher)
 * @param {{ ownerIds?: import("mongoose").Types.ObjectId[] | null }} [options]
 * @returns {object} Mongo filter for unconfirmed active rentals
 */
export function buildPendingRentalsFilter(
  session,
  countryCode = "ALL",
  options = {}
) {
  const base = {
    ...buildOrdersOwnerFilter(session),
    confirmed: { $ne: true },
    status: { $ne: ORDER_STATUS.PAID_AND_CLOSED },
  };

  const user = session?.user ?? null;
  if (!isSuperAdminUser(user)) return base;
  if (getEffectiveOwnerId(user)) return base;

  const country = normalizeAdminCountryFilter(countryCode);
  if (!country || country === "ALL") return base;

  const { ownerIds } = options;
  if (ownerIds === null || ownerIds === undefined) {
    // Sync fallback when caller did not resolve company ids: order.countryCode.
    if (country === "GR") {
      return {
        ...base,
        $or: [
          { countryCode: "GR" },
          { countryCode: { $exists: false } },
          { countryCode: null },
          { countryCode: "" },
        ],
      };
    }
    return { ...base, countryCode: country };
  }

  if (!Array.isArray(ownerIds) || ownerIds.length === 0) {
    return { ...base, _id: null };
  }

  return {
    ...base,
    ownerId: { $in: ownerIds },
  };
}

/**
 * @param {object|null} session
 * @param {string} [countryCode] - GR | ES | ALL (superadmin country switcher)
 * @returns {object} Mongo filter for transfers needing attention
 */
export function buildPendingTransfersFilter(session, countryCode = "ALL") {
  const user = session?.user ?? null;
  const country = String(countryCode || "ALL").trim().toUpperCase();
  const statusFilter = { status: { $in: TRANSFER_PENDING_ATTENTION_STATUSES } };

  if (isSuperAdminUser(user)) {
    const viewAs = getEffectiveOwnerId(user);
    if (viewAs) {
      // Viewing as a company: same visibility as that partner
      return {
        $and: [
          statusFilter,
          {
            $or: [
              {
                status: { $in: TRANSFER_OPEN_STATUSES },
                $or: [
                  { assignedSupplierId: null },
                  { assignedSupplierId: { $exists: false } },
                ],
              },
              { assignedSupplierId: new mongoose.Types.ObjectId(viewAs) },
              { claimedByCompanyId: new mongoose.Types.ObjectId(viewAs) },
            ],
          },
        ],
      };
    }

    const filter = { ...statusFilter };
    if (country && country !== "ALL") {
      filter.country = country;
    }
    // Unclaimed open + quote-required (any assignee), or claimable unclaimed
    return {
      $and: [
        filter,
        {
          $or: [
            {
              status: {
                $in: [
                  TRANSFER_STATUS.MANUAL_QUOTE_REQUIRED,
                  TRANSFER_STATUS.AWAITING_ADMIN_QUOTE,
                ],
              },
            },
            {
              status: { $in: TRANSFER_OPEN_STATUSES },
              $or: [
                { assignedSupplierId: null },
                { assignedSupplierId: { $exists: false } },
              ],
            },
          ],
        },
      ],
    };
  }

  const ownerId = getSessionOwnerId(user);
  if (!ownerId) return { _id: null };

  const oid = new mongoose.Types.ObjectId(ownerId);
  return {
    $and: [
      statusFilter,
      {
        $or: [
          {
            status: { $in: TRANSFER_OPEN_STATUSES },
            $or: [
              { assignedSupplierId: null },
              { assignedSupplierId: { $exists: false } },
            ],
          },
          { assignedSupplierId: oid },
          { claimedByCompanyId: oid },
        ],
      },
    ],
  };
}

/**
 * Badge metrics: Orders uses rentals only; bell uses rentals + transfers.
 * @param {{ rentals?: number, transfers?: number }} counts
 */
export function sumPendingInbox(counts) {
  const rentals = Math.max(0, Number(counts?.rentals) || 0);
  const transfers = Math.max(0, Number(counts?.transfers) || 0);
  const bookingCount = rentals + transfers;
  const setupTasks = Array.isArray(counts?.companySetupTasks)
    ? counts.companySetupTasks
    : [];
  const companySetup = { count: setupTasks.length, tasks: setupTasks };
  const bookings = {
    count: bookingCount,
    tasks:
      bookingCount > 0
        ? [
            {
              id: "bookings",
              title: "Bookings need attention",
              href: "/admin/orders",
              count: bookingCount,
            },
          ]
        : [],
  };
  return {
    rentals,
    transfers,
    /** Orders nav badge — rentals only. Never the bell total. */
    ordersBadge: rentals,
    /** Booking portion of the bell. Greece rental + transfer math is unchanged. */
    notificationsBadge: bookingCount,
    bookings,
    companySetup,
    /** Bell total for a company: booking tasks + legal tasks. */
    total: bookingCount + companySetup.count,
  };
}
