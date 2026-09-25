/**
 * Company action queue for contractor Orders badges.
 *
 * Navbar "Orders", the Car rentals tab, and any dashboard rental-action
 * count must use this selector. It is not an unread-mail counter.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  PLATFORM_WORKFLOW_STAGE,
  hasCalendarProblem,
  isPlatformBooking,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";

export const PROBLEM_ASSIGNEE = Object.freeze({
  SUPPLIER: "SUPPLIER",
  ROVARO: "ROVARO",
});

/** Stored statuses that still need a supplier decision on the original request. */
export const COMPANY_ACTION_STORED_STATUSES = Object.freeze([
  BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
]);

export function supplierAssignedProblem(order) {
  if (order?.problemAssignedTo !== PROBLEM_ASSIGNEE.SUPPLIER) return false;
  return hasCalendarProblem(order);
}

/**
 * True only for a PLATFORM car rental this company must still act on.
 * Awaiting payment, an offered replacement, expiry, confirmation, decline,
 * cancellation, completion, and internal rows are not actions.
 */
const PROBLEM_DOES_NOT_COUNT = new Set([
  PLATFORM_WORKFLOW_STAGE.COMPLETED,
  PLATFORM_WORKFLOW_STAGE.CANCELLED,
  PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED,
  PLATFORM_WORKFLOW_STAGE.PAYMENT_EXPIRED,
]);

export function orderRequiresCompanyAction(order) {
  if (!order || !isPlatformBooking(order)) return false;
  if (order.isTransferOverlay || order._calendarKind === "transfer") return false;
  const stage = resolvePlatformWorkflowStage(order);
  if (stage === PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION) return true;
  if (!supplierAssignedProblem(order)) return false;
  return !PROBLEM_DOES_NOT_COUNT.has(stage);
}

export function countCompanyRentalActions(orders) {
  return (Array.isArray(orders) ? orders : []).filter(orderRequiresCompanyAction).length;
}

export function platformBookingMongoClause() {
  return {
    $or: [
      { source: "PLATFORM" },
      { my_order: true, source: { $in: [null, ""] } },
      { my_order: true, source: { $exists: false } },
    ],
  };
}

export function companyActionMongoOr() {
  return [
    { bookingStatus: { $in: [...COMPANY_ACTION_STORED_STATUSES] } },
    {
      $and: [
        {
          $or: [
            { bookingStatus: { $exists: false } },
            { bookingStatus: null },
            { bookingStatus: "" },
          ],
        },
        { confirmed: { $ne: true } },
        { "payment.status": { $nin: ["paid", "succeeded"] } },
      ],
    },
    {
      problemAssignedTo: PROBLEM_ASSIGNEE.SUPPLIER,
      bookingStatus: {
        $nin: [
          BOOKING_STATUS.COMPLETED,
          BOOKING_STATUS.CUSTOMER_CANCELLED,
          BOOKING_STATUS.SUPPLIER_CANCELLED,
          BOOKING_STATUS.ADMIN_CANCELLED,
          BOOKING_STATUS.SUPPLIER_DECLINED,
          BOOKING_STATUS.NO_AVAILABILITY,
          BOOKING_STATUS.PAYMENT_EXPIRED,
        ],
      },
      $or: [{ hasProblem: true }, { problemReportedAt: { $type: "date" } }],
    },
  ];
}
