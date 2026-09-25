/**
 * Layout contract for the canonical Booking Details modal.
 *
 * The width lives here rather than as a number inside an `sx` prop so the
 * calendar, the orders list and the email deep link cannot drift apart, and so
 * the value is reviewable in one place.
 */

/** Desktop modal width — single dense column. */
export const BOOKING_DETAILS_MODAL_MAX_WIDTH = 560;

/** Label column width for a two-column summary row. */
export const BOOKING_DETAILS_LABEL_COLUMN = 110;

/** Below this breakpoint the modal becomes a full-screen sheet. */
export const BOOKING_DETAILS_SHEET_BREAKPOINT = "sm";

/** From this breakpoint upward, detail sections use a multi-column grid. */
export const BOOKING_DETAILS_SECTION_GRID_BREAKPOINT = "md";

/** Single column: avoids a mid-gap between cards. */
export const BOOKING_DETAILS_SECTION_GRID_COLUMNS = 1;

/**
 * Height reserved below the last section so the sticky action footer never
 * covers content.
 */
export const BOOKING_DETAILS_FOOTER_CLEARANCE = 48;

/** Section ids. Money comes first in the modal so it is not buried. */
export const BOOKING_DETAILS_SECTION = Object.freeze({
  STATUS: "status",
  PRICE: "price",
  VEHICLE: "vehicle",
  DATES: "dates",
  OPTIONS: "options",
  CUSTOMER: "customer",
  DOCUMENTS: "documents",
  ACTIONS: "actions",
  ACTIVITY: "activity",
});
