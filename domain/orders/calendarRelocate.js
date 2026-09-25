/**
 * Calendar relocate (car and/or dates) for company admins.
 *
 * Paid platform bookings may be relocated only with an explicit customer
 * acknowledgement. Internal / unpaid rows keep the normal access policy.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  isInternalBooking,
  isMarketplaceBookingFeePaid,
  isPlatformBooking,
} from "@/domain/admin/rovaroContractorAdmin";
import { getDisabledFields } from "@/domain/orders/orderAccessPolicy";

export const CALENDAR_RELOCATE_CODE = Object.freeze({
  PERMISSION_DENIED: "PERMISSION_DENIED",
  FIELD_LOCKED: "FIELD_LOCKED",
  CUSTOMER_ACK_REQUIRED: "CUSTOMER_ACK_REQUIRED",
  OK: "OK",
});

const PAID_STATUSES = new Set([
  BOOKING_STATUS.BOOKING_CONFIRMED,
  BOOKING_STATUS.RENTAL_IN_PROGRESS,
  BOOKING_STATUS.COMPLETION_PENDING,
  BOOKING_STATUS.COMPLETED,
]);

/** Fields the calendar move endpoints are allowed to touch. */
export const CALENDAR_RELOCATE_FIELDS = Object.freeze([
  "rentalStartDate",
  "rentalEndDate",
  "timeIn",
  "timeOut",
  "car",
]);

const MESSAGE = Object.freeze({
  [CALENDAR_RELOCATE_CODE.PERMISSION_DENIED]:
    "You do not have permission to edit this order",
  [CALENDAR_RELOCATE_CODE.FIELD_LOCKED]:
    "This field cannot be changed for this order",
  [CALENDAR_RELOCATE_CODE.CUSTOMER_ACK_REQUIRED]:
    "Confirm that the customer agreed to this move before relocating a paid booking",
});

/**
 * True when the Booking Fee / confirmed-paid stage has been reached on a
 * platform booking (same signals as contacts reveal).
 */
export function isPaidPlatformBookingForRelocate(order) {
  if (!isPlatformBooking(order) || isInternalBooking(order)) return false;
  if (isMarketplaceBookingFeePaid(order)) return true;
  if (PAID_STATUSES.has(String(order?.bookingStatus || "").trim())) return true;
  return String(order?.payment?.status || "")
    .trim()
    .toLowerCase() === "paid";
}

export function requiresCustomerAckForRelocate(order) {
  return isPaidPlatformBookingForRelocate(order);
}

/**
 * English fallback + stable code for API responses (UI maps via i18n).
 */
export function calendarRelocateErrorMessage(code, field) {
  const base = MESSAGE[code] || MESSAGE[CALENDAR_RELOCATE_CODE.PERMISSION_DENIED];
  if (code === CALENDAR_RELOCATE_CODE.FIELD_LOCKED && field) {
    return `${base} (${field})`;
  }
  return base;
}

/**
 * Decide whether a calendar relocate may proceed.
 *
 * @param {{
 *   order: object,
 *   access: object,
 *   fieldsInPayload: string[],
 *   customerAck?: boolean,
 * }} params
 * @returns {{
 *   ok: boolean,
 *   code?: string,
 *   message?: string,
 *   field?: string,
 *   paidRelocate?: boolean,
 * }}
 */
export function assertCalendarRelocateAllowed({
  order,
  access,
  fieldsInPayload = [],
  customerAck = false,
} = {}) {
  if (!access || access.isViewOnly) {
    // Paid platform: view-only from the generic policy still may relocate
    // car/dates with ack — but only those fields.
    if (!isPaidPlatformBookingForRelocate(order)) {
      return {
        ok: false,
        code: CALENDAR_RELOCATE_CODE.PERMISSION_DENIED,
        message: calendarRelocateErrorMessage(
          CALENDAR_RELOCATE_CODE.PERMISSION_DENIED
        ),
      };
    }
  }

  const paidRelocate = isPaidPlatformBookingForRelocate(order);
  const relocating = fieldsInPayload.filter((f) =>
    CALENDAR_RELOCATE_FIELDS.includes(f)
  );
  const nonRelocate = fieldsInPayload.filter(
    (f) => !CALENDAR_RELOCATE_FIELDS.includes(f)
  );

  if (paidRelocate && relocating.length > 0) {
    if (!customerAck) {
      return {
        ok: false,
        code: CALENDAR_RELOCATE_CODE.CUSTOMER_ACK_REQUIRED,
        message: calendarRelocateErrorMessage(
          CALENDAR_RELOCATE_CODE.CUSTOMER_ACK_REQUIRED
        ),
        paidRelocate: true,
      };
    }
    // Ack opens only car/dates; anything else still locked.
    const disabled = new Set(getDisabledFields(access) || []);
    for (const field of nonRelocate) {
      if (disabled.has(field)) {
        return {
          ok: false,
          code: CALENDAR_RELOCATE_CODE.FIELD_LOCKED,
          message: calendarRelocateErrorMessage(
            CALENDAR_RELOCATE_CODE.FIELD_LOCKED,
            field
          ),
          field,
        };
      }
    }
    return { ok: true, paidRelocate: true };
  }

  if (access?.isViewOnly) {
    return {
      ok: false,
      code: CALENDAR_RELOCATE_CODE.PERMISSION_DENIED,
      message: calendarRelocateErrorMessage(
        CALENDAR_RELOCATE_CODE.PERMISSION_DENIED
      ),
    };
  }

  const disabled = new Set(getDisabledFields(access) || []);
  for (const field of fieldsInPayload) {
    if (disabled.has(field)) {
      return {
        ok: false,
        code: CALENDAR_RELOCATE_CODE.FIELD_LOCKED,
        message: calendarRelocateErrorMessage(
          CALENDAR_RELOCATE_CODE.FIELD_LOCKED,
          field
        ),
        field,
      };
    }
  }

  return { ok: true, paidRelocate: false };
}
