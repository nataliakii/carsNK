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
import { resolveBookingFinancialSnapshot } from "@/domain/orders/bookingFinancialSnapshot";
import { buildSupplierResponsePublicFields } from "@/domain/orders/supplierResponseStatus";
import { readVehicleSnapshot } from "@/domain/orders/vehicleSnapshot";

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

const CONFIRMED_FILL = new Set([
  BOOKING_STATUS.BOOKING_CONFIRMED,
  BOOKING_STATUS.RENTAL_IN_PROGRESS,
  BOOKING_STATUS.COMPLETION_PENDING,
]);

export const INTERNAL_RECORD_STATUS = Object.freeze({
  TENTATIVE: "TENTATIVE",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

export const PLATFORM_WORKFLOW_STAGE = Object.freeze({
  AWAITING_SUPPLIER_CONFIRMATION: "AWAITING_SUPPLIER_CONFIRMATION",
  AWAITING_CUSTOMER_PAYMENT: "AWAITING_CUSTOMER_PAYMENT",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  COMPLETION_PENDING: "COMPLETION_PENDING",
  COMPLETED: "COMPLETED",
  SUPPLIER_DECLINED: "SUPPLIER_DECLINED",
  AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE: "AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE",
  ALTERNATIVE_PROPOSED: "AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",
  CANCELLED: "CANCELLED",
});

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
  if (
    String(order?.bookingFeePaymentStatus || "").toUpperCase() === "PAID"
  ) {
    return true;
  }
  if (
    String(order?.customerConfirmation || "").toUpperCase() ===
    "CONFIRMED_BY_PAYMENT"
  ) {
    return true;
  }
  const status = String(order?.bookingStatus || "").trim();
  const confirmedPaidStage =
    status === BOOKING_STATUS.BOOKING_CONFIRMED ||
    status === BOOKING_STATUS.RENTAL_IN_PROGRESS ||
    status === BOOKING_STATUS.COMPLETION_PENDING ||
    status === BOOKING_STATUS.COMPLETED;
  // Status alone is only trusted for marketplace rows (source classification
  // must not treat an internal draft as “paid”).
  return (
    confirmedPaidStage && isMarketplaceRequestMode(order?.bookingMode)
  );
}

/** True when the Booking Fee / confirmed-paid stage has been reached. */
export function isMarketplaceBookingFeePaid(order) {
  return marketplacePaidSignal(order);
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
  if (CONFIRMED_FILL.has(status)) return CALENDAR_TONE.CONFIRMED_PAID;
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

export function resolveInternalRecordStatus(order) {
  const status = storedStatus(order);
  if (CANCELLED.has(status)) return INTERNAL_RECORD_STATUS.CANCELLED;
  if (status === BOOKING_STATUS.COMPLETED) return INTERNAL_RECORD_STATUS.COMPLETED;
  if (order?.confirmed === true) return INTERNAL_RECORD_STATUS.CONFIRMED;
  return INTERNAL_RECORD_STATUS.TENTATIVE;
}

/** Product stage for a platform booking. Colour is still resolveContractorCalendarTone. */
export function resolvePlatformWorkflowStage(order) {
  if (!isPlatformBooking(order)) return null;
  const status = storedStatus(order);
  if (
    status === BOOKING_STATUS.SUPPLIER_DECLINED ||
    status === BOOKING_STATUS.NO_AVAILABILITY
  ) {
    return PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED;
  }
  if (status === BOOKING_STATUS.ALTERNATIVE_PROPOSED) {
    return PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE;
  }
  if (status === BOOKING_STATUS.PAYMENT_EXPIRED) {
    return PLATFORM_WORKFLOW_STAGE.PAYMENT_EXPIRED;
  }
  if (CANCELLED.has(status)) return PLATFORM_WORKFLOW_STAGE.CANCELLED;
  if (status === BOOKING_STATUS.COMPLETED) return PLATFORM_WORKFLOW_STAGE.COMPLETED;
  if (status === BOOKING_STATUS.COMPLETION_PENDING) {
    return PLATFORM_WORKFLOW_STAGE.COMPLETION_PENDING;
  }
  if (
    status === BOOKING_STATUS.BOOKING_CONFIRMED ||
    status === BOOKING_STATUS.RENTAL_IN_PROGRESS
  ) {
    return PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED;
  }
  if (AWAITING_PAYMENT.has(status)) {
    return PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT;
  }
  if (!status && order?.confirmed === true) {
    return PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED;
  }
  return PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION;
}

/** Supplier-response column copy for a platform row. */
export function contractorSupplierResponseCopy(order) {
  const stage = resolvePlatformWorkflowStage(order);
  if (stage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE) {
    return { key: "table.supplierReplacementOffered", fallback: "Equivalent replacement offered" };
  }
  // Same short label once the supplier has accepted — Status column carries payment stage
  if (
    stage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT ||
    stage === PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED ||
    stage === PLATFORM_WORKFLOW_STAGE.COMPLETION_PENDING ||
    stage === PLATFORM_WORKFLOW_STAGE.COMPLETED
  ) {
    return { key: "table.responseConfirmedShort", fallback: "Accepted" };
  }
  if (stage === PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED) {
    return { key: "table.toneDeclined", fallback: "Declined" };
  }
  return { key: "table.supplierAwaitingYours", fallback: "Awaiting your response" };
}

/**
 * Live order-modal copy for the current product stage.
 * Supplier decision buttons exist only while the company still owes a response.
 */
export function contractorOrderModalStage(order) {
  const stage = resolvePlatformWorkflowStage(order);
  const views = {
    [PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION]: {
      titleKey: "order.stageNewRequest",
      title: "New booking request",
      detailKey: "",
      detail: "",
      supplierActions: true,
    },
    [PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE]: {
      titleKey: "order.stageAlternativeSent",
      title: "Alternative sent to customer",
      detailKey: "order.stageAwaitingAcceptance",
      detail: "Awaiting customer acceptance",
      supplierActions: false,
    },
    [PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT]: {
      titleKey: "order.stageVehicleConfirmed",
      title: "Vehicle confirmed",
      detailKey: "order.stageAwaitingPayment",
      detail: "Awaiting customer payment",
      supplierActions: false,
    },
    [PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED]: {
      titleKey: "order.stageBookingConfirmed",
      title: "Booking confirmed",
      detailKey: "order.stageFeePaid",
      detail: "Booking Fee paid",
      supplierActions: false,
    },
    [PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED]: {
      titleKey: "order.stageRequestDeclined",
      title: "Request declined",
      detailKey: "",
      detail: "",
      supplierActions: false,
    },
    [PLATFORM_WORKFLOW_STAGE.PAYMENT_EXPIRED]: {
      titleKey: "order.stagePaymentExpired",
      title: "Payment expired",
      detailKey: "",
      detail: "",
      supplierActions: false,
    },
  };
  const view = views[stage] || {
    titleKey: "",
    title: "",
    detailKey: "",
    detail: "",
    supplierActions: false,
  };
  return { stage, ...view };
}

/** i18n key under table.tone.* */
export function contractorTableStatusLabelKey(order) {
  if (isInternalBooking(order)) {
    const internal = resolveInternalRecordStatus(order);
    if (internal === INTERNAL_RECORD_STATUS.CONFIRMED) return "table.internalConfirmed";
    if (internal === INTERNAL_RECORD_STATUS.COMPLETED) return "table.internalCompleted";
    if (internal === INTERNAL_RECORD_STATUS.CANCELLED) return "table.internalCancelled";
    return "table.internalTentative";
  }
  const stage = resolvePlatformWorkflowStage(order);
  if (stage === PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION) {
    return "table.toneNewRequest";
  }
  if (stage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT) {
    return "table.toneAwaitingPayment";
  }
  if (stage === PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED) return "table.toneConfirmedPaid";
  if (stage === PLATFORM_WORKFLOW_STAGE.COMPLETION_PENDING) return "table.toneCompletionPending";
  if (stage === PLATFORM_WORKFLOW_STAGE.COMPLETED) return "table.toneCompleted";
  if (stage === PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED) return "table.toneDeclined";
  if (stage === PLATFORM_WORKFLOW_STAGE.ALTERNATIVE_PROPOSED) return "table.toneAlternative";
  if (stage === PLATFORM_WORKFLOW_STAGE.PAYMENT_EXPIRED) return "table.toneExpired";
  if (stage === PLATFORM_WORKFLOW_STAGE.CANCELLED) return "table.toneCancelled";
  return "table.toneUnresolved";
}

export function contractorCalendarLegend() {
  return [
    { tone: CALENDAR_TONE.NEW_REQUEST, stage: CANONICAL_STAGE.AWAITING_SUPPLIER_CONFIRMATION },
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
  const snap = resolveBookingFinancialSnapshot(order);
  if (!snap?.grossMinor) return null;
  if (snap.source !== "snapshot" && snap.source !== "stored_amounts" && snap.source !== "quote") {
    return null;
  }
  return {
    fee: (Number(snap.bookingFeeMinor) || 0) / 100,
    gross: (Number(snap.grossMinor) || 0) / 100,
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
  const bookingFee = roundMoney(stored.fee);
  const rentalTotal = stored.gross != null ? roundMoney(stored.gross) : amount;
  // Derived, never read from a stored supplier balance: a stale snapshot must
  // not break rentalTotal = bookingFee + dueToCompany in the admin totals.
  return {
    source: BOOKING_SOURCE.PLATFORM,
    rentalTotal,
    bookingFee,
    dueToCompany: roundMoney(rentalTotal - bookingFee),
  };
}

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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
      marketplaceSupplierAmount += row.dueToCompany;
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

function exportText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

function exportIso(value) {
  if (!value) return "";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString();
  } catch {
    return "";
  }
}

function exportYesNo(value) {
  return value === true ? "Yes" : value === false ? "No" : "";
}

/** Same gate as companyMustHideCustomerIdentity — kept local to avoid import cycles. */
function exportHideCustomerPii(order) {
  if (isInternalBooking(order)) return false;
  if (!isPlatformBooking(order)) return true;
  const stage = resolvePlatformWorkflowStage(order);
  if (
    stage === PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED ||
    stage === PLATFORM_WORKFLOW_STAGE.COMPLETION_PENDING ||
    stage === PLATFORM_WORKFLOW_STAGE.COMPLETED
  ) {
    return false;
  }
  const pay = String(order?.payment?.status || order?.paymentStatus || "")
    .trim()
    .toLowerCase();
  if (pay === "paid" || pay === "succeeded") return false;
  if (
    String(order?.bookingFeePaymentStatus || "").toUpperCase() === "PAID"
  ) {
    return false;
  }
  if (isMarketplaceRequestMode(order?.bookingMode)) return true;
  return order?.confirmed !== true;
}

/**
 * Full flat row for Excel / CSV. Dates are ISO (UTC); UI formats to Athens.
 * Customer PII is blank when the company must not see contacts yet.
 */
export function buildContractorOrderExportRow(order) {
  const money = contractorOrderMoneyRow(order);
  const supplier = buildSupplierResponsePublicFields(order);
  const responseCopy = contractorSupplierResponseCopy(order);
  const { vehicle } = readVehicleSnapshot(order);
  const car =
    order?.car && typeof order.car === "object" && !order.car._bsontype
      ? order.car
      : null;
  const hideCustomer = exportHideCustomerPii(order);
  const paymentStatus =
    exportText(order?.payment?.status) ||
    exportText(order?.bookingFeePaymentStatus) ||
    exportText(order?.paymentStatus);

  return {
    orderNumber: exportText(order?.orderNumber),
    publicReference: exportText(order?.publicReference || order?.orderNumber),
    source: money.source,
    bookingStatus: exportText(order?.bookingStatus),
    statusKey: contractorTableStatusLabelKey(order),
    yourResponseKey: responseCopy.key,
    yourResponseFallback: responseCopy.fallback,
    paymentStatus,
    customerConfirmation: exportText(order?.customerConfirmation),
    bookingMode: exportText(order?.bookingMode),
    offline: exportYesNo(order?.offline === true),

    pickupAt: exportIso(
      order?.pickupAtUtc || order?.timeIn || order?.rentalStartDate
    ),
    returnAt: exportIso(
      order?.returnAtUtc || order?.timeOut || order?.rentalEndDate
    ),
    rentalStartDate: exportIso(order?.rentalStartDate),
    rentalEndDate: exportIso(order?.rentalEndDate),
    timeIn: exportIso(order?.timeIn || order?.pickupAtUtc),
    timeOut: exportIso(order?.timeOut || order?.returnAtUtc),
    rentalDays: Number(order?.numberOfDays) || "",

    placeIn: exportText(order?.placeIn),
    placeInDetail: exportText(order?.placeInDetail),
    placeOut: exportText(order?.placeOut),
    placeOutDetail: exportText(order?.placeOutDetail),
    flightNumber: exportText(order?.flightNumber),

    carModel:
      exportText(order?.carModel) ||
      exportText(vehicle?.displayName) ||
      exportText(car?.model),
    carNumber: exportText(order?.carNumber) || exportText(car?.carNumber),
    regNumber:
      exportText(order?.regNumber) ||
      exportText(vehicle?.registrationNumber) ||
      exportText(car?.regNumber),
    vehicleClass:
      exportText(vehicle?.class) ||
      exportText(car?.class) ||
      exportText(order?.carCategory),
    transmission:
      exportText(vehicle?.transmission) || exportText(car?.transmission),
    seats: vehicle?.seats ?? car?.seats ?? "",
    fuel: exportText(vehicle?.fuelType) || exportText(car?.fueltype),

    insurance: exportText(order?.insurance),
    franchise: order?.franchiseOrder != null ? Number(order.franchiseOrder) : "",
    childSeats: Number(order?.ChildSeats) || 0,
    secondDriver: exportYesNo(order?.secondDriver === true),

    customerName: hideCustomer ? "" : exportText(order?.customerName),
    phone: hideCustomer ? "" : exportText(order?.phone),
    email: hideCustomer ? "" : exportText(order?.email),
    viber: hideCustomer ? "" : exportYesNo(order?.Viber === true),
    whatsapp: hideCustomer ? "" : exportYesNo(order?.Whatsapp === true),
    telegram: hideCustomer ? "" : exportYesNo(order?.Telegram === true),
    customerNotes: hideCustomer
      ? ""
      : exportText(order?.customerNotes || order?.comment),

    supplierResponse: exportText(supplier.supplierResponse),
    supplierRespondedAt: exportIso(supplier.supplierRespondedAt),
    supplierRespondedByName: exportText(supplier.supplierRespondedByName),
    supplierRespondedByEmail: exportText(supplier.supplierRespondedByEmail),
    partnerConfirmedAt: exportIso(supplier.partnerConfirmedAt),
    companyEmailDecision: exportText(supplier.companyEmailDecision),
    companyEmailDecisionAt: exportIso(order?.companyEmailDecisionAt),
    declineReason: exportText(supplier.supplierDeclineReason),

    rentalTotal: money.rentalTotal,
    bookingFee: money.bookingFee,
    dueToCompany: money.dueToCompany,

    companyNotes: exportText(order?.companyNotes),
    companyTags: Array.isArray(order?.companyTags)
      ? order.companyTags.filter(Boolean).join(", ")
      : exportText(order?.companyTags),
    hasProblem: exportYesNo(hasCalendarProblem(order)),
    createdAt: exportIso(order?.createdAt),
    updatedAt: exportIso(order?.updatedAt),
  };
}

export function buildContractorOrdersExport(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const totals = summarizeContractorAdminTotals(list);
  const rows = list.map((order) => buildContractorOrderExportRow(order));
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
