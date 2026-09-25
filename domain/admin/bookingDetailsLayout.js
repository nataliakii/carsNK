/**
 * Layout contract for the canonical Booking Details modal.
 *
 * The width lives here rather than as a number inside an `sx` prop so the
 * calendar, the orders list and the email deep link cannot drift apart, and so
 * the value is reviewable in one place.
 */

/** Desktop modal width, within the agreed 900–1040px band. */
export const BOOKING_DETAILS_MODAL_MAX_WIDTH = 1000;

/** Label column width for a two-column summary row. */
export const BOOKING_DETAILS_LABEL_COLUMN = 220;

/** Below this breakpoint the modal becomes a full-screen sheet. */
export const BOOKING_DETAILS_SHEET_BREAKPOINT = "sm";

/** From this breakpoint upward, detail sections use a multi-column grid. */
export const BOOKING_DETAILS_SECTION_GRID_BREAKPOINT = "md";

/** Number of columns for grouped detail sections on desktop. */
export const BOOKING_DETAILS_SECTION_GRID_COLUMNS = 2;

/** Width of the vehicle image column beside the specification grid. */
export const BOOKING_DETAILS_VEHICLE_COLUMN = 260;

/** Vehicle image and placeholder share one shape so the layout never jumps. */
export const BOOKING_DETAILS_VEHICLE_ASPECT = "16 / 10";

/**
 * Height reserved below the last section so the sticky action footer never
 * covers the end of the price summary.
 */
export const BOOKING_DETAILS_FOOTER_CLEARANCE = 72;

/** Section ids, in render order. Mirrors sections A–I of the specification. */
export const BOOKING_DETAILS_SECTION = Object.freeze({
  STATUS: "status",
  VEHICLE: "vehicle",
  DATES: "dates",
  OPTIONS: "options",
  PRICE: "price",
  CUSTOMER: "customer",
  DOCUMENTS: "documents",
  ACTIONS: "actions",
  ACTIVITY: "activity",
});
