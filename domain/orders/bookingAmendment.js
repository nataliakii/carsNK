/**
 * Superadmin exception handling for PLATFORM bookings.
 *
 * Rovaro can fix a booking that went wrong, but not by being handed a raw edit
 * form. Every change arrives as one explicit `Amend booking` operation that
 * carries a reason, who asked for it, the exact fields, and a before/after
 * snapshot. After the customer has paid, a material term cannot move without
 * recorded consent, and money can only change through an explicit refund or
 * additional-payment decision — never by rewriting the captured Stripe amount.
 *
 * Pure module: validation and record shape only. Persistence and Stripe live
 * in the route.
 */

import crypto from "crypto";

import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";

export const AMENDMENT_REQUESTED_BY = Object.freeze({
  CUSTOMER: "CUSTOMER",
  SUPPLIER: "SUPPLIER",
  ROVARO: "ROVARO",
});

/**
 * Terms the customer agreed to when paying. Changing one of these after
 * payment is a change to the contract, not a correction.
 */
export const MATERIAL_AMENDMENT_FIELDS = Object.freeze([
  "car",
  "carModel",
  "transmission",
  "rentalStartDate",
  "rentalEndDate",
  "timeIn",
  "timeOut",
  "placeIn",
  "placeOut",
  "insurance",
  "franchiseOrder",
  "ChildSeats",
  "secondDriver",
  "totalPrice",
  "OverridePrice",
]);

/** Fields whose value is money and therefore needs a payment resolution. */
export const PRICED_AMENDMENT_FIELDS = Object.freeze([
  "totalPrice",
  "OverridePrice",
]);

export const PAYMENT_RESOLUTION = Object.freeze({
  NONE: "NONE",
  REFUND_DUE: "REFUND_DUE",
  ADDITIONAL_PAYMENT_DUE: "ADDITIONAL_PAYMENT_DUE",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

export const AMENDMENT_ERROR = Object.freeze({
  NOT_PLATFORM: "AMENDMENT_NOT_PLATFORM",
  REASON_REQUIRED: "AMENDMENT_REASON_REQUIRED",
  REQUESTED_BY_REQUIRED: "AMENDMENT_REQUESTED_BY_REQUIRED",
  NO_CHANGES: "AMENDMENT_NO_CHANGES",
  UNKNOWN_FIELD: "AMENDMENT_UNKNOWN_FIELD",
  CONSENT_REQUIRED: "AMENDMENT_CONSENT_REQUIRED",
  ACTOR_REQUIRED: "AMENDMENT_ACTOR_REQUIRED",
});

const MATERIAL_SET = new Set(MATERIAL_AMENDMENT_FIELDS);
const PRICED_SET = new Set(PRICED_AMENDMENT_FIELDS);
const REASON_MIN_LENGTH = 10;

/** Every field an amendment is allowed to touch at all. */
export const AMENDABLE_FIELDS = Object.freeze([
  ...MATERIAL_AMENDMENT_FIELDS,
  "placeInDetail",
  "placeOutDetail",
  "flightNumber",
  "customerName",
  "phone",
  "email",
  "numberOfDays",
]);

const AMENDABLE_SET = new Set(AMENDABLE_FIELDS);

function text(value) {
  return String(value ?? "").trim();
}

function sameValue(left, right) {
  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }
  return text(left) === text(right);
}

export function isMaterialAmendmentField(field) {
  return MATERIAL_SET.has(text(field));
}

export function bookingIsPaid(order) {
  return text(order?.payment?.status).toLowerCase() === "paid";
}

/**
 * Which fields actually differ from the stored booking.
 *
 * @param {object} order
 * @param {Record<string, unknown>} changes
 */
export function diffAmendment(order, changes) {
  const entries = Object.entries(changes || {});
  const changed = [];
  const before = {};
  const after = {};
  for (const [field, next] of entries) {
    if (next === undefined) continue;
    const current = order?.[field];
    if (sameValue(current, next)) continue;
    changed.push(field);
    before[field] = current ?? null;
    after[field] = next ?? null;
  }
  return { changed, before, after };
}

/**
 * How a price change must be settled. Never by editing the captured amount.
 *
 * @param {{ order: object, nextTotalPrice: number }} input
 */
export function resolvePaymentResolution({ order, nextTotalPrice } = {}) {
  if (!bookingIsPaid(order)) return PAYMENT_RESOLUTION.NONE;
  const current = Number(order?.OverridePrice ?? order?.totalPrice);
  const next = Number(nextTotalPrice);
  if (!Number.isFinite(current) || !Number.isFinite(next)) {
    return PAYMENT_RESOLUTION.MANUAL_REVIEW;
  }
  if (next === current) return PAYMENT_RESOLUTION.NONE;
  return next < current
    ? PAYMENT_RESOLUTION.REFUND_DUE
    : PAYMENT_RESOLUTION.ADDITIONAL_PAYMENT_DUE;
}

/**
 * Validate one amendment request and produce the audit record to persist.
 *
 * @param {{
 *   order: object,
 *   changes: Record<string, unknown>,
 *   reason: string,
 *   requestedBy: string,
 *   actor: { id?: string, email?: string, role?: string },
 *   customerConsent?: { recorded: boolean, recordedAt?: string, note?: string },
 *   now?: Date,
 * }} input
 * @returns {{ ok: true, record: object } | { ok: false, status: number, code: string, message: string, fields?: string[] }}
 */
export function validateBookingAmendment({
  order,
  changes,
  reason,
  requestedBy,
  actor,
  customerConsent = null,
  now = new Date(),
} = {}) {
  if (!isPlatformBooking(order)) {
    return {
      ok: false,
      status: 409,
      code: AMENDMENT_ERROR.NOT_PLATFORM,
      message: "Only a platform booking is amended through this operation",
    };
  }

  const trimmedReason = text(reason);
  if (trimmedReason.length < REASON_MIN_LENGTH) {
    return {
      ok: false,
      status: 400,
      code: AMENDMENT_ERROR.REASON_REQUIRED,
      message: "An amendment needs a written reason",
    };
  }

  const requester = text(requestedBy).toUpperCase();
  if (!AMENDMENT_REQUESTED_BY[requester]) {
    return {
      ok: false,
      status: 400,
      code: AMENDMENT_ERROR.REQUESTED_BY_REQUIRED,
      message: "Record who requested the amendment",
    };
  }

  const actorEmail = text(actor?.email);
  if (!actorEmail) {
    return {
      ok: false,
      status: 400,
      code: AMENDMENT_ERROR.ACTOR_REQUIRED,
      message: "An amendment must record the acting user",
    };
  }

  const unknown = Object.keys(changes || {}).filter(
    (field) => !AMENDABLE_SET.has(field)
  );
  if (unknown.length) {
    return {
      ok: false,
      status: 400,
      code: AMENDMENT_ERROR.UNKNOWN_FIELD,
      message: `These fields cannot be amended: ${unknown.join(", ")}`,
      fields: unknown,
    };
  }

  const { changed, before, after } = diffAmendment(order, changes);
  if (!changed.length) {
    return {
      ok: false,
      status: 400,
      code: AMENDMENT_ERROR.NO_CHANGES,
      message: "Nothing would change",
    };
  }

  const materialFields = changed.filter(isMaterialAmendmentField);
  const paid = bookingIsPaid(order);
  const consentRecorded = customerConsent?.recorded === true;
  const consentRequired = paid && materialFields.length > 0;
  if (consentRequired && !consentRecorded) {
    return {
      ok: false,
      status: 409,
      code: AMENDMENT_ERROR.CONSENT_REQUIRED,
      message:
        "The customer has paid for these terms. Record their consent before changing them.",
      fields: materialFields,
    };
  }

  const pricedFields = changed.filter((field) => PRICED_SET.has(field));
  const paymentResolution = pricedFields.length
    ? resolvePaymentResolution({ order, nextTotalPrice: after.totalPrice })
    : PAYMENT_RESOLUTION.NONE;

  const record = {
    version: 1,
    reason: trimmedReason,
    requestedBy: requester,
    fieldsChanged: changed,
    materialFields,
    consentRequired,
    customerConsent: consentRecorded
      ? {
          recorded: true,
          recordedAt: text(customerConsent?.recordedAt) || new Date(now).toISOString(),
          note: text(customerConsent?.note),
        }
      : null,
    before,
    after,
    paymentResolution,
    /** Preserved so the paid split can always be reconstructed. */
    financialSnapshotBefore: order?.bookingFinancialSnapshot
      ? { ...order.bookingFinancialSnapshot }
      : null,
    actor: {
      id: text(actor?.id),
      email: actorEmail,
      role: text(actor?.role) || "SUPERADMIN",
    },
    at: new Date(now).toISOString(),
  };
  record.checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(record))
    .digest("hex");

  return { ok: true, record };
}

/**
 * Fields the route may write directly. A price change is settled through the
 * payment resolution flow, so it never rewrites the captured Stripe amount
 * here, and `totalPrice` is held back on an already-paid booking.
 */
export function applicableAmendmentWrites(record, order) {
  const writes = {};
  const paid = bookingIsPaid(order);
  for (const field of record?.fieldsChanged || []) {
    if (paid && PRICED_SET.has(field)) continue;
    writes[field] = record.after[field];
  }
  return writes;
}
