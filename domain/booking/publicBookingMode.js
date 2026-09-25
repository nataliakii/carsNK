/**
 * The public marketplace supports two first-class booking paths. They share
 * presentation state (sorting, which calendar is open) but never share a date
 * range: SEARCH_FIRST dates come from the header search, CAR_FIRST dates are
 * owned by one car's mini calendar.
 *
 * @typedef {"SEARCH_FIRST"|"CAR_FIRST"} BookingMode
 */

export const BOOKING_MODE = Object.freeze({
  SEARCH_FIRST: "SEARCH_FIRST",
  CAR_FIRST: "CAR_FIRST",
});

export const SORT_OPTION = Object.freeze({
  PRICE_ASC: "PRICE_ASC",
  PRICE_DESC: "PRICE_DESC",
});

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value) {
  return typeof value === "string" && DATE_KEY.test(value);
}

export function hasCompleteRange(start, end) {
  if (!isDateKey(start) || !isDateKey(end)) return false;
  return end > start;
}

/**
 * A search request is only "active" once both ends are present. Anything else
 * leaves the catalog in CAR_FIRST, where each card owns its own dates.
 *
 * @param {{ startDate?: unknown, endDate?: unknown }|null|undefined} searchRequest
 * @returns {BookingMode}
 */
export function resolvePublicBookingMode(searchRequest) {
  return hasCompleteRange(searchRequest?.startDate, searchRequest?.endDate)
    ? BOOKING_MODE.SEARCH_FIRST
    : BOOKING_MODE.CAR_FIRST;
}

/**
 * Build the single object handed to the booking modal. A CAR_FIRST draft is
 * always built from the car's own calendar slice, never from global state.
 *
 * @returns {{ sourceMode: BookingMode, carId: string, startDate: string|null,
 *   endDate: string|null, quoteId: string|null }|null}
 */
export function buildBookingDraft({
  sourceMode,
  carId,
  startDate,
  endDate,
  quoteId,
}) {
  const id = carId == null ? "" : String(carId);
  if (!id) return null;
  if (!hasCompleteRange(startDate, endDate)) return null;
  if (
    sourceMode !== BOOKING_MODE.SEARCH_FIRST &&
    sourceMode !== BOOKING_MODE.CAR_FIRST
  ) {
    return null;
  }
  return {
    sourceMode,
    carId: id,
    startDate,
    endDate,
    quoteId: quoteId ? String(quoteId) : null,
  };
}

/**
 * Canonical identity of a quote request. Used as the dedupe/cache key so the
 * same car + range + pickup pair never produces two concurrent calls.
 */
export function buildQuoteRequestKey({
  carId,
  startDate,
  endDate,
  placeIn,
  placeOut,
}) {
  if (!carId || !hasCompleteRange(startDate, endDate)) return "";
  const pickup = (placeIn || "").trim();
  const dropoff = (placeOut || "").trim();
  return [String(carId), startDate, endDate, pickup, dropoff].join("|");
}

/**
 * Availability is fetched per car and month, so the cache key must carry the
 * inventory version that invalidates it after a booking lands.
 */
export function buildAvailabilityKey({ carId, month, inventoryVersion }) {
  if (!carId || !month) return "";
  return [String(carId), String(month), String(inventoryVersion ?? "0")].join("|");
}
