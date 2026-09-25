/**
 * View model for one car's public booking panel.
 *
 * It describes a single car's CTA and price summary from that car's own
 * dates and quote. It holds no global state and knows nothing about any other
 * car, so a card can only ever render the quote it was given.
 *
 * Copy is returned as i18n keys plus an English fallback; the component
 * translates. The CTA never contains "!" or "?".
 */

import dayjs from "dayjs";
import "dayjs/locale/en";
import { hasCompleteRange, isDateKey } from "./publicBookingMode";

export const PANEL_STATUS = Object.freeze({
  EMPTY: "empty",
  LOADING: "loading",
  READY: "ready",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
});

export const PANEL_COPY = Object.freeze({
  selectDates: { key: "catalog.booking.selectDates", fallback: "Select dates" },
  calculating: {
    key: "catalog.booking.calculatingPrice",
    fallback: "Calculating price…",
  },
  book: { key: "catalog.booking.book", fallback: "BOOK" },
  unavailable: {
    key: "catalog.booking.rangeUnavailable",
    fallback: "Not available for these dates",
  },
  error: {
    key: "catalog.booking.quoteFailed",
    fallback: "Could not check availability",
  },
  retry: { key: "catalog.booking.retry", fallback: "Try again" },
});

export function hasValidBookingRange(start, end) {
  return hasCompleteRange(start, end);
}

/** `€105` — whole euros stay whole, cents only when they exist. */
export function formatEuroAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return `€${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/**
 * Compact human range.
 *   same month  → `20–24 October`
 *   cross month → `28 October – 2 November`
 *   cross year  → `28 December 2026 – 2 January 2027`
 */
export function formatCompactDateRange(start, end, locale = "en") {
  if (!hasCompleteRange(start, end)) return "";
  const from = dayjs(start).locale(locale);
  const to = dayjs(end).locale(locale);
  if (!from.isValid() || !to.isValid()) return "";

  if (from.year() !== to.year()) {
    return `${from.format("D MMMM YYYY")} – ${to.format("D MMMM YYYY")}`;
  }
  if (from.month() !== to.month()) {
    return `${from.format("D MMMM")} – ${to.format("D MMMM")}`;
  }
  return `${from.format("D")}–${to.format("D MMMM")}`;
}

/** Billable rental days between two date keys. */
export function rentalDayCount(start, end) {
  if (!hasCompleteRange(start, end)) return 0;
  const from = dayjs(`${start}T00:00:00Z`);
  const to = dayjs(`${end}T00:00:00Z`);
  const days = to.diff(from, "day");
  return days > 0 ? days : 0;
}

/**
 * A quote only belongs to the range it was requested for. A late response for
 * an abandoned range is discarded rather than shown against new dates.
 */
function quoteForRange(start, end, quote) {
  if (!quote) return null;
  const rangeKey = `${start}|${end}`;
  if (quote.rangeKey && quote.rangeKey !== rangeKey) return null;
  return quote;
}

function resolveStatus(hasDates, quote, quoteStatus) {
  if (!hasDates) return PANEL_STATUS.EMPTY;
  if (quoteStatus === "error" || quote?.status === "error") {
    return PANEL_STATUS.ERROR;
  }
  if (quote?.available === false || quote?.status === "unavailable") {
    return PANEL_STATUS.UNAVAILABLE;
  }
  if (quoteStatus === "ready" && Number(quote?.totalPrice) > 0) {
    return PANEL_STATUS.READY;
  }
  return PANEL_STATUS.LOADING;
}

/**
 * @param {{ start?: string|null, end?: string|null, quote?: object|null,
 *   quoteStatus?: string, priceKind?: "estimated"|"rental", locale?: string }} input
 */
export function buildCarBookingPanelView(input) {
  const start = isDateKey(input?.start) ? input.start : null;
  const end = isDateKey(input?.end) ? input.end : null;
  const hasDates = hasCompleteRange(start, end);
  const quote = hasDates ? quoteForRange(start, end, input?.quote) : null;
  const quoteStatus = quote ? input?.quoteStatus || "idle" : "idle";
  const status = resolveStatus(hasDates, quote, quoteStatus);
  const locale = input?.locale || "en";

  const isReady = status === PANEL_STATUS.READY;
  const priceText = isReady ? formatEuroAmount(quote.totalPrice) : "";
  const approx = Boolean(isReady && input?.priceKind !== "rental");
  const days = rentalDayCount(start, end);

  let ctaCopy = PANEL_COPY.selectDates;
  if (status === PANEL_STATUS.LOADING) ctaCopy = PANEL_COPY.calculating;
  else if (isReady) ctaCopy = PANEL_COPY.book;
  else if (status === PANEL_STATUS.UNAVAILABLE) ctaCopy = PANEL_COPY.unavailable;
  else if (status === PANEL_STATUS.ERROR) ctaCopy = PANEL_COPY.retry;

  return {
    status,
    hasDates,
    // Only a priced, available range may open the booking modal.
    canBook: isReady,
    cta: {
      disabled: !isReady,
      labelKey: ctaCopy.key,
      labelFallback: ctaCopy.fallback,
      // Rendered as a second line on the button: `Approx. €105`.
      priceKey: approx ? "catalog.booking.approxPrice" : "catalog.booking.totalPrice",
      priceText,
      showPrice: isReady,
      showApprox: approx,
    },
    summary: {
      show: isReady,
      rangeText: hasDates ? formatCompactDateRange(start, end, locale) : "",
      days,
      // Separate keys rather than i18next plurals: this project interpolates
      // counts directly, and "1 rental days" must never appear.
      daysKey:
        days === 1 ? "catalog.booking.rentalDay" : "catalog.booking.rentalDays",
      priceText,
      showApprox: approx,
    },
    statusMessage:
      status === PANEL_STATUS.UNAVAILABLE
        ? PANEL_COPY.unavailable
        : status === PANEL_STATUS.ERROR
          ? PANEL_COPY.error
          : null,
    canonicalStart: hasDates ? start : null,
    canonicalEnd: hasDates ? end : null,
    quoteId: isReady ? quote?.quoteId || `${start}|${end}` : null,
  };
}
