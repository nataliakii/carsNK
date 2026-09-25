/**
 * SEARCH_FIRST result ordering.
 *
 * Sorting reads the quoted total for the requested range — never the base
 * daily rate and never the formatted price string. Ordering is a pure
 * function of (cars, quotes, sort), so a date click cannot reorder the list
 * and React keys stay put.
 */

import { SORT_OPTION } from "./publicBookingMode";

export { SORT_OPTION };

export const DEFAULT_SORT = SORT_OPTION.PRICE_ASC;

export function isSortOption(value) {
  return value === SORT_OPTION.PRICE_ASC || value === SORT_OPTION.PRICE_DESC;
}

export function normalizeSort(value) {
  return isSortOption(value) ? value : DEFAULT_SORT;
}

/** The number we sort on, or null when this car has no usable quote yet. */
export function quotedTotalOf(quote) {
  const total = Number(quote?.totalPrice);
  return Number.isFinite(total) && total >= 0 ? total : null;
}

function secondaryKey(car) {
  const name = [car?.make, car?.model].filter(Boolean).join(" ").trim();
  return name || String(car?._id || "");
}

/**
 * Cars without a quote sink to the bottom in both directions so a pending
 * request never pretends to be the cheapest car.
 *
 * @param {object[]} cars
 * @param {Record<string, object>} quotesByCarId
 * @param {"PRICE_ASC"|"PRICE_DESC"} sort
 */
export function sortCarsByQuotedTotal(cars, quotesByCarId, sort) {
  const list = Array.isArray(cars) ? [...cars] : [];
  const quotes = quotesByCarId || {};
  const direction = normalizeSort(sort) === SORT_OPTION.PRICE_DESC ? -1 : 1;

  return list.sort((a, b) => {
    const aTotal = quotedTotalOf(quotes[String(a?._id)]);
    const bTotal = quotedTotalOf(quotes[String(b?._id)]);

    if (aTotal == null && bTotal == null) {
      return secondaryKey(a).localeCompare(secondaryKey(b));
    }
    if (aTotal == null) return 1;
    if (bTotal == null) return -1;
    if (aTotal !== bTotal) return (aTotal - bTotal) * direction;

    // Stable tie-break so equal totals never shuffle between renders.
    return secondaryKey(a).localeCompare(secondaryKey(b));
  });
}
