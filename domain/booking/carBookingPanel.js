/**
 * View model for the public car booking panel.
 * Dates are already normalised YYYY-MM-DD strings. Display text is derived here
 * so the search bar, summary, and continue action cannot drift apart.
 */

import dayjs from "dayjs";
import "dayjs/locale/en";

export function hasValidBookingRange(start, end) {
  if (!start || !end) return false;
  const startKey = String(start);
  const endKey = String(end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endKey)) {
    return false;
  }
  return endKey >= startKey;
}

/** "29 Sep – 30 Sep 2026" */
export function formatBookingDateRange(start, end) {
  if (!hasValidBookingRange(start, end)) return "";
  const startLabel = dayjs(start).locale("en").format("D MMM").replace(/\./g, "");
  const endLabel = dayjs(end).locale("en").format("D MMM YYYY").replace(/\./g, "");
  return `${startLabel} – ${endLabel}`;
}

/** `1 day` / `2 days` — never `1 days`. */
export function formatRentalDayCount(days) {
  const count = Number(days);
  if (!Number.isFinite(count) || count <= 0) return "";
  const whole = Math.round(count);
  return whole === 1 ? "1 day" : `${whole} days`;
}

/** Always `€105.00`. */
export function formatEuroTotal(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return `€${value.toFixed(2)}`;
}

export function priceCaption(priceKind) {
  return priceKind === "estimated" ? "Estimated total" : "Rental total";
}

/**
 * @param {{ start?: string|null, end?: string|null, editing?: boolean, quote?: object }} input
 */
export function buildCarBookingPanelView(input) {
  const start = input?.start || null;
  const end = input?.end || null;
  const hasDates = hasValidBookingRange(start, end);
  const editing = Boolean(input?.editing);
  const quote = input?.quote || {};
  const status = !hasDates
    ? "empty"
    : quote.status || "checking";
  const showPrice =
    hasDates &&
    (status === "available" || status === "priceChanged") &&
    quote.totalPrice != null;

  return {
    state: hasDates ? "selected" : "empty",
    hasDates,
    calendarOpen: !hasDates || editing,
    showChooseDates: !hasDates,
    showPrice,
    showPriceBadge: false,
    status,
    statusText: statusText(status, quote.message),
    dateRangeLabel: hasDates ? formatBookingDateRange(start, end) : "",
    durationLabel: showPrice ? formatRentalDayCount(quote.days) : "",
    priceCaption: priceCaption(quote.priceKind),
    priceText: showPrice ? formatEuroTotal(quote.totalPrice) : "",
    continueDisabled:
      !hasDates ||
      status === "checking" ||
      status === "unavailable" ||
      status === "error" ||
      status === "empty",
    canonicalStart: hasDates ? start : null,
    canonicalEnd: hasDates ? end : null,
    continueLabel: "Continue booking",
  };
}

function statusText(status, message) {
  if (message && status === "unavailable") return message;
  if (status === "checking") return "Checking availability…";
  if (status === "available") return "Available";
  if (status === "unavailable") return "Not available for these dates";
  if (status === "priceChanged") return "Price changed — updated total shown";
  if (status === "error") return message || "Could not check availability";
  return "";
}

/**
 * Calendar is an editor. These transitions keep one date range.
 */
export function reduceBookingPanel(state, action) {
  const current = {
    start: state?.start || null,
    end: state?.end || null,
    editing: Boolean(state?.editing),
    previous: state?.previous || null,
  };

  switch (action?.type) {
    case "changeDates":
      if (!hasValidBookingRange(current.start, current.end)) return current;
      return {
        ...current,
        editing: true,
        previous: { start: current.start, end: current.end },
      };
    case "cancel": {
      const restore = current.previous;
      if (restore?.start && restore?.end) {
        return {
          start: restore.start,
          end: restore.end,
          editing: false,
          previous: null,
        };
      }
      return { ...current, editing: false, previous: null };
    }
    case "commit": {
      const start = action.start || null;
      const end = action.end || null;
      if (!hasValidBookingRange(start, end)) {
        return { start: null, end: null, editing: true, previous: current.previous };
      }
      return { start, end, editing: false, previous: null };
    }
    case "unavailable":
      return { ...current, editing: true };
    case "clear":
      return { start: null, end: null, editing: false, previous: null };
    case "externalDates": {
      const start = action.start || null;
      const end = action.end || null;
      return {
        start,
        end,
        editing: false,
        previous: null,
      };
    }
    default:
      return current;
  }
}
