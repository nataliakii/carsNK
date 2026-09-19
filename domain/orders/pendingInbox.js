/**
 * Pending / unprocessed inbox criteria for admin badges & notifications.
 *
 * Rentals: not confirmed and still ACTIVE.
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

/** Transfer statuses that still need admin / supplier attention. */
export const TRANSFER_PENDING_ATTENTION_STATUSES = [
  ...TRANSFER_OPEN_STATUSES,
  TRANSFER_STATUS.MANUAL_QUOTE_REQUIRED,
  TRANSFER_STATUS.AWAITING_ADMIN_QUOTE,
];

/**
 * @param {object|null} session
 * @returns {object} Mongo filter for unconfirmed active rentals
 */
export function buildPendingRentalsFilter(session) {
  return {
    ...buildOrdersOwnerFilter(session),
    confirmed: { $ne: true },
    status: { $ne: ORDER_STATUS.PAID_AND_CLOSED },
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
 * @param {{ rentals?: number, transfers?: number }} counts
 */
export function sumPendingInbox(counts) {
  const rentals = Math.max(0, Number(counts?.rentals) || 0);
  const transfers = Math.max(0, Number(counts?.transfers) || 0);
  return { rentals, transfers, total: rentals + transfers };
}
