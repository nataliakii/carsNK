/**
 * Canonical contractor-admin rule: platform vs internal bookings.
 *
 * Full narrative: ./ROVARO_CONTRACTOR_ADMIN.md
 * Marketplace stages: domain/booking/ROVARO_MARKETPLACE_WORKFLOW.md
 *
 * Logic uses `source` + `status`, never CSS colour.
 *
 * Proven writes of legacy `my_order` (see scripts and create routes):
 *   true  — public site / BookingModal / unauthenticated POST /order/add → PLATFORM
 *   false — company calendar, offline stub, schema default → INTERNAL
 * Missing `my_order` is ambiguous: migrate_my_order_field.js would set false,
 * copyOrdersFromOldDb.js and oldOrdersSync.js would set true.
 * Explicit `source` is required on new records and must not change.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { CANONICAL_STAGE } from "@/domain/booking/rovaroMarketplaceWorkflow";
import { marketplaceFinancialSplit } from "@/domain/orders/marketplaceFinancialSplit";

export const BOOKING_SOURCE = Object.freeze({
  PLATFORM: "PLATFORM",
  INTERNAL: "INTERNAL",
});

/** First-cut internal record. Later badges (Tentative, Reserved, …) stay this source. */
export const INTERNAL_KIND = Object.freeze({
  INTERNAL_BLOCK: "INTERNAL_BLOCK",
});

export const DEFAULT_INTERNAL_BLOCKS_AVAILABILITY = true;

/**
 * Calendar display keys. UI maps these through the theme palette.
 * Red is never a booking type — only a problem overlay (`hasCalendarProblem`).
 */
export const CALENDAR_TONE = Object.freeze({
  NEW_REQUEST: "NEW_REQUEST",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  CONFIRMED_PAID: "CONFIRMED_PAID",
  INTERNAL: "INTERNAL",
  DECLINED: "DECLINED",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  UNRESOLVED: "UNRESOLVED",
});

export const CONTRACTOR_ADMIN_INVARIANTS = Object.freeze([
  "Internal bookings never enter Rovaro Booking Fee, Stripe, platform emails, legal click-wrap, or Rovaro financial reports.",
  "Internal bookings default to blocking vehicle availability so Rovaro cannot sell the same dates.",
  "An internal booking never becomes a platform booking automatically.",
  "A platform booking cannot be reclassified as internal to avoid the fee.",
  "Source is immutable after create (my_order / BOOKING_SOURCE).",
  "Totals are computed from source and stored amounts, never from calendar colour.",
  "Do not take 10% of all visible rows. Fee is sum of platform booking fees only.",
  "Internal amount is Internal booking value, not net profit.",
  "Superadmin default queues hide internals; support may open a dedicated filter.",
  "Deleting an internal booking frees the car. Company admin cannot erase platform payment history.",
]);

const CANCELLED = new Set([
  BOOKING_STATUS.CUSTOMER_CANCELLED,
  BOOKING_STATUS.SUPPLIER_CANCELLED,
  BOOKING_STATUS.ADMIN_CANCELLED,
]);

const AWAITING_PAYMENT = new Set([
  BOOKING_STATUS.PAYMENT_PROCESSING,
  BOOKING_STATUS.CONFIRMED_AWAITING_PAYMENT,
  BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
]);

export function explicitBookingSource(order) {
  const raw = String(order?.source || "").trim();
  if (raw === BOOKING_SOURCE.PLATFORM || raw === BOOKING_SOURCE.INTERNAL) {
    return raw;
  }
  return null;
}

function marketplacePaidSignal(order) {
  const pay = String(order?.payment?.status || order?.paymentStatus || "")
    .trim()
    .toLowerCase();
  if (pay === "paid") return true;
  return (
    String(order?.bookingStatus || "") === BOOKING_STATUS.BOOKING_CONFIRMED &&
    isMarketplaceRequestMode(order?.bookingMode)
  );
}

/**
 * Backfill classifier. Ambiguous rows must be reviewed, not guessed into a fee.
 * @returns {{ source: string|null, ambiguous: boolean, reasons: string[], legacy: boolean }}
 */
export function classifyBookingSourceRecord(order) {
  const explicit = explicitBookingSource(order);
  const my = order?.my_order;
  const myKnown = my === true || my === false;
  const reasons = [];

  if (order?.source != null && String(order.source).trim() !== "" && !explicit) {
    reasons.push("invalid_source");
  }
  if (explicit === BOOKING_SOURCE.PLATFORM && my === false) {
    reasons.push("source_conflicts_my_order");
  }
  if (explicit === BOOKING_SOURCE.INTERNAL && my === true) {
    reasons.push("source_conflicts_my_order");
  }
  if (!explicit && !myKnown) reasons.push("missing_my_order");
  if (my === true && order?.offline === true && explicit !== BOOKING_SOURCE.INTERNAL) {
    reasons.push("platform_flag_with_offline");
  }
  if (
    (my === false || explicit === BOOKING_SOURCE.INTERNAL) &&
    explicit !== BOOKING_SOURCE.PLATFORM &&
    marketplacePaidSignal(order)
  ) {
    reasons.push("internal_flag_with_marketplace_payment");
  }

  if (reasons.length) {
    return { source: null, ambiguous: true, reasons, legacy: false };
  }
  if (explicit) {
    return { source: explicit, ambiguous: false, reasons: [], legacy: false };
  }
  if (my === true) {
    return {
      source: BOOKING_SOURCE.PLATFORM,
      ambiguous: false,
      reasons: [],
      legacy: true,
    };
  }
  return {
    source: BOOKING_SOURCE.INTERNAL,
    ambiguous: false,
    reasons: [],
    legacy: true,
  };
}

/** Resolved source, or null when the record needs review. */
export function resolveBookingSource(order) {
  return classifyBookingSourceRecord(order).source;
}

export function isPlatformBooking(order) {
  return resolveBookingSource(order) === BOOKING_SOURCE.PLATFORM;
}

export function isInternalBooking(order) {
  return resolveBookingSource(order) === BOOKING_SOURCE.INTERNAL;
}

/** New writes. Public requests are always PLATFORM. Client `source` is ignored. */
export function sourceForNewOrder({ isPublicRequest = false, my_order = false } = {}) {
  if (isPublicRequest || my_order === true) return BOOKING_SOURCE.PLATFORM;
  return BOOKING_SOURCE.INTERNAL;
}

/**
 * Refuse a later flip of source / my_order.
 * @returns {{ ok: boolean, code?: string }}
 */
export function assertBookingSourceUnchanged(order, next = {}) {
  const current = resolveBookingSource(order);
  if (!current) return { ok: true };
  if (next.source && next.source !== current) {
    return { ok: false, code: "SOURCE_IMMUTABLE" };
  }
  if (typeof next.my_order === "boolean") {
    const nextSource =
      next.my_order === true
        ? BOOKING_SOURCE.PLATFORM
        : BOOKING_SOURCE.INTERNAL;
    if (nextSource !== current) {
      return { ok: false, code: "SOURCE_IMMUTABLE" };
    }
  }
  return { ok: true };
}

/**
 * Offline flag must not reclassify a platform booking as internal.
 * Does not invent `source` on historical rows.
 */
export function assignOfflineFlag(order, offline) {
  if (!order) return { rejected: false };
  const next = Boolean(offline);
  order.offline = next;
  if (!next) return { rejected: false };
  const gate = assertBookingSourceUnchanged(order, { my_order: false });
  if (!gate.ok) return { rejected: true, code: gate.code };
  order.confirmed = true;
  order.my_order = false;
  return { rejected: false };
}

export function hasCalendarProblem(order) {
  return order?.hasProblem === true || Boolean(order?.problemReportedAt);
}

function storedStatus(order) {
  return String(order?.bookingStatus || "");
}

export function resolveContractorCalendarTone(order) {
  if (isInternalBooking(order)) return CALENDAR_TONE.INTERNAL;
  if (!isPlatformBooking(order)) return CALENDAR_TONE.UNRESOLVED;

  const status = storedStatus(order);
  if (
    status === BOOKING_STATUS.SUPPLIER_DECLINED ||
    status === BOOKING_STATUS.NO_AVAILABILITY
  ) {
    return CALENDAR_TONE.DECLINED;
  }
  if (status === BOOKING_STATUS.PAYMENT_EXPIRED) {
    return CALENDAR_TONE.PAYMENT_EXPIRED;
  }
  if (CANCELLED.has(status)) return CALENDAR_TONE.CANCELLED;
  if (status === BOOKING_STATUS.COMPLETED) return CALENDAR_TONE.COMPLETED;
  if (status === BOOKING_STATUS.BOOKING_CONFIRMED) {
    return CALENDAR_TONE.CONFIRMED_PAID;
  }
  if (AWAITING_PAYMENT.has(status)) return CALENDAR_TONE.AWAITING_PAYMENT;
  if (!status && order?.confirmed === true) return CALENDAR_TONE.CONFIRMED_PAID;
  return CALENDAR_TONE.NEW_REQUEST;
}

/** i18n key under calendar.detail.* */
export function contractorCalendarDetailKey(order) {
  const tone = resolveContractorCalendarTone(order);
  if (tone === CALENDAR_TONE.INTERNAL) return "internalNoFee";
  if (tone === CALENDAR_TONE.AWAITING_PAYMENT) return "waitingForCustomerPayment";
  if (
    tone === CALENDAR_TONE.CONFIRMED_PAID ||
    tone === CALENDAR_TONE.COMPLETED
  ) {
    return "confirmedCustomerPaid";
  }
  if (tone === CALENDAR_TONE.NEW_REQUEST) return "supplierResponseNeeded";
  return "unresolved";
}

/** i18n key under table.tone.* */
export function contractorTableStatusLabelKey(order) {
  if (isInternalBooking(order)) return "table.toneInternal";
  const tone = resolveContractorCalendarTone(order);
  if (tone === CALENDAR_TONE.NEW_REQUEST) return "table.toneNewRequest";
  if (tone === CALENDAR_TONE.AWAITING_PAYMENT) return "table.toneAwaitingPayment";
  if (tone === CALENDAR_TONE.CONFIRMED_PAID) return "table.toneConfirmedPaid";
  if (tone === CALENDAR_TONE.COMPLETED) return "table.toneCompleted";
  if (tone === CALENDAR_TONE.DECLINED) return "table.toneDeclined";
  if (tone === CALENDAR_TONE.PAYMENT_EXPIRED) return "table.toneExpired";
  if (tone === CALENDAR_TONE.CANCELLED) return "table.toneCancelled";
  return "table.toneUnresolved";
}

export function contractorCalendarLegend() {
  return [
    { tone: CALENDAR_TONE.NEW_REQUEST, stage: CANONICAL_STAGE.AWAITING_SUPPLIER_RESPONSE },
    { tone: CALENDAR_TONE.AWAITING_PAYMENT, stage: CANONICAL_STAGE.AWAITING_CUSTOMER_PAYMENT },
    { tone: CALENDAR_TONE.CONFIRMED_PAID, stage: CANONICAL_STAGE.BOOKING_CONFIRMED },
    { tone: CALENDAR_TONE.INTERNAL, source: BOOKING_SOURCE.INTERNAL },
  ];
}

export function matchesBookingSourceFilter(order, filter) {
  const raw = String(filter || "all").trim().toLowerCase();
  if (!raw || raw === "all") return true;
  if (raw === "platform" || raw === "rovaro" || raw === "client") {
    return isPlatformBooking(order);
  }
  if (raw === "internal" || raw === "admin") return isInternalBooking(order);
  return true;
}

/** Platform rows that belong in the superadmin commercial queue. */
export function isCommercialQueueOrder(order) {
  return isPlatformBooking(order);
}

function effectiveAmount(order) {
  if (!order) return 0;
  if (order.OverridePrice !== null && order.OverridePrice !== undefined) {
    const n = Number(order.OverridePrice);
    if (Number.isFinite(n)) return n;
  }
  const n = Number(order.totalPrice);
  return Number.isFinite(n) ? n : 0;
}

function storedPlatformFee(order) {
  if (!isPlatformBooking(order)) return null;
  if (order.offline === true) return null;
  if (!isMarketplaceRequestMode(order.bookingMode)) return null;
  const price = order.authoritativePrice;
  if (!price || !Number(price.grossMinor)) return null;
  const split = marketplaceFinancialSplit(price);
  return {
    fee: (Number(split.platformAmountMinor) || 0) / 100,
    due: (Number(split.supplierBalanceMinor) || 0) / 100,
  };
}

/** Per-row amounts. Fee is never inferred as 10% of the rental. */
export function contractorOrderMoneyRow(order) {
  const amount = effectiveAmount(order);
  if (isInternalBooking(order)) {
    return {
      source: BOOKING_SOURCE.INTERNAL,
      rentalTotal: amount,
      bookingFee: 0,
      dueToCompany: amount,
    };
  }
  if (!isPlatformBooking(order)) {
    return {
      source: null,
      rentalTotal: amount,
      bookingFee: 0,
      dueToCompany: 0,
    };
  }
  const stored = storedPlatformFee(order);
  if (!stored) {
    return {
      source: BOOKING_SOURCE.PLATFORM,
      rentalTotal: amount,
      bookingFee: 0,
      dueToCompany: amount,
    };
  }
  return {
    source: BOOKING_SOURCE.PLATFORM,
    rentalTotal: amount,
    bookingFee: stored.fee,
    dueToCompany: stored.due,
  };
}

/**
 * Split filtered-period totals. Combined calendar value is allowed;
 * Rovaro fee must never be computed from the mixed sum.
 */
export function summarizeContractorAdminTotals(orders) {
  const list = Array.isArray(orders) ? orders : [];
  let platformCount = 0;
  let platformBookingValue = 0;
  let rovaroBookingFees = 0;
  let supplierPlatformAmount = 0;
  let platformFeeCount = 0;
  let marketplaceSupplierAmount = 0;
  let internalCount = 0;
  let internalBookingValue = 0;
  let ambiguousCount = 0;

  for (const order of list) {
    const row = contractorOrderMoneyRow(order);
    if (row.source === BOOKING_SOURCE.INTERNAL) {
      internalCount += 1;
      internalBookingValue += row.rentalTotal;
      continue;
    }
    if (row.source !== BOOKING_SOURCE.PLATFORM) {
      ambiguousCount += 1;
      continue;
    }
    platformCount += 1;
    platformBookingValue += row.rentalTotal;
    rovaroBookingFees += row.bookingFee;
    supplierPlatformAmount += row.dueToCompany;
    if (order.offline !== true && isMarketplaceRequestMode(order.bookingMode)) {
      platformFeeCount += 1;
      const stored = storedPlatformFee(order);
      if (stored) marketplaceSupplierAmount += stored.due;
    }
  }

  return {
    platformCount,
    platformBookingValue,
    rovaroBookingFees,
    supplierPlatformAmount,
    platformFeeCount,
    marketplaceSupplierAmount,
    internalCount,
    internalBookingValue,
    rovaroFeeFromInternalBookings: 0,
    combinedCalendarValue: platformBookingValue + internalBookingValue,
    ambiguousCount,
  };
}

export function buildContractorOrdersExport(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const totals = summarizeContractorAdminTotals(list);
  const rows = list.map((order) => {
    const money = contractorOrderMoneyRow(order);
    return {
      source: money.source,
      statusKey: contractorTableStatusLabelKey(order),
      orderNumber: order?.orderNumber || "",
      rentalTotal: money.rentalTotal,
      bookingFee: money.bookingFee,
      dueToCompany: money.dueToCompany,
    };
  });
  return { rows, totals };
}

/**
 * Internal records block the car unless explicitly opted out or cancelled.
 * Platform rows keep the existing confirmed / bookingStatus rules.
 */
export function internalRecordBlocksAvailability(order) {
  if (!isInternalBooking(order)) return false;
  if (CANCELLED.has(storedStatus(order))) return false;
  if (
    storedStatus(order) === BOOKING_STATUS.SUPPLIER_DECLINED ||
    storedStatus(order) === BOOKING_STATUS.NO_AVAILABILITY
  ) {
    return false;
  }
  return order?.blocksAvailability !== false;
}
