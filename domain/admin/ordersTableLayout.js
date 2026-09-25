/**
 * Layout contract for the contractor Orders table.
 *
 * The table is a working surface: a supplier spends a day inside it, so the
 * widths, the sticky edges and the row rhythm are decided once here instead of
 * being re-guessed as numbers inside `sx` props. Reviewing the density of the
 * table means reading this file.
 *
 * Nothing here is a colour or a spacing step — those stay in the theme.
 */

/**
 * Minimum width per column, in px. A header must never wrap character by
 * character, so each value is at least as wide as its longest translated
 * label at the header font size.
 */
export const ORDERS_TABLE_COLUMN_WIDTH = Object.freeze({
  /** Status chip, source chip and the row overflow button on one line. */
  STATUS: 168,
  COMPANY: 140,
  CAR: 132,
  /** A date over a time, both fixed-format. */
  DATE: 108,
  CUSTOMER: 168,
  /** Editable amount plus the recalculate and history buttons. */
  PRICE: 184,
  /** A single read-only amount. */
  MONEY: 116,
  SUPPLIER_RESPONSE: 156,
  CUSTOMER_CONFIRMATION: 132,
});

/**
 * Columns dropped on narrow viewports, smallest priority first. Every one of
 * them is still readable in the booking details modal or the financial
 * summary, so hiding them removes duplication rather than information.
 */
export const ORDERS_TABLE_HIDE_BELOW = Object.freeze({
  COMPANY: "lg",
  BOOKING_FEE: "md",
  CUSTOMER_CONFIRMATION: "sm",
});

/** Viewport height the scroll area may take before the page itself scrolls. */
export const ORDERS_TABLE_MAX_HEIGHT = "68vh";

/** Enough to show the empty and loading states without collapsing. */
export const ORDERS_TABLE_MIN_HEIGHT = 320;

/**
 * Every row reserves the same height so the list stays scannable even when one
 * booking carries a decline reason and its neighbour carries nothing.
 */
export const ORDERS_TABLE_ROW_MIN_HEIGHT = 72;

/**
 * Stacking order for the column that stays pinned to the left edge. The MUI
 * sticky header occupies 2, so a pinned body cell sits below it and a pinned
 * header cell above it.
 */
export const ORDERS_TABLE_PINNED_BODY_Z = 1;
export const ORDERS_TABLE_PINNED_HEAD_Z = 3;

/** Free text inside a cell is clamped rather than allowed to grow the row. */
export const ORDERS_TABLE_TEXT_LINE_CLAMP = 2;

/**
 * Conflicting bookings listed by reference in the conflict panel before the
 * rest are summarised as a count.
 */
export const ORDERS_TABLE_CONFLICT_CHIP_LIMIT = 5;
