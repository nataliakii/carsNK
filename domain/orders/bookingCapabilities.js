/**
 * ONE resolver for everything the Booking Details modal may show or do.
 *
 * The UI asks this module which controls to render; every mutation route asks
 * the same module whether the caller may proceed, and every read route asks it
 * which fields may be serialised at all. A capability that is not granted here
 * must never reach the browser payload, so "the button was hidden" is never
 * the protection.
 *
 * Reused, never duplicated:
 *   source            → domain/admin/rovaroContractorAdmin.js
 *   product stage     → domain/admin/rovaroContractorAdmin.js
 *   licence lawfulness→ domain/legal/drivingLicenceAccess.js (owned elsewhere)
 *
 * Pure: no mongoose, no session, no React. Client components and route
 * handlers load the same code.
 */

import {
  BOOKING_SOURCE,
  PLATFORM_WORKFLOW_STAGE,
  isInternalBooking,
  resolveBookingSource,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";
import { evaluateDrivingLicenceAccess } from "@/domain/legal/drivingLicenceAccess";
import { policyRoleFromUser } from "@/domain/admin/adminViewMode";
import { ROLE } from "@models/user";

export const BOOKING_CAPABILITY = Object.freeze({
  VIEW_BOOKING: "VIEW_BOOKING",
  CONFIRM_REQUESTED_VEHICLE: "CONFIRM_REQUESTED_VEHICLE",
  OFFER_EQUIVALENT_REPLACEMENT: "OFFER_EQUIVALENT_REPLACEMENT",
  DECLINE_REQUEST: "DECLINE_REQUEST",
  VIEW_CUSTOMER_CONTACTS: "VIEW_CUSTOMER_CONTACTS",
  VIEW_DRIVING_DOCUMENTS: "VIEW_DRIVING_DOCUMENTS",
  CONTACT_CUSTOMER: "CONTACT_CUSTOMER",
  CONTACT_ROVARO: "CONTACT_ROVARO",
  REPORT_PROBLEM: "REPORT_PROBLEM",
  AMEND_PLATFORM_BOOKING: "AMEND_PLATFORM_BOOKING",
  EDIT_INTERNAL_BOOKING: "EDIT_INTERNAL_BOOKING",
  /**
   * On a PLATFORM booking the second driver is a paid Rovaro extra sold to the
   * customer, so only the platform superadmin may add it, at any stage. An
   * INTERNAL booking is the contractor's own offline record that the platform
   * does not mediate, so its owner adds the second driver freely.
   */
  ADD_SECOND_DRIVER: "ADD_SECOND_DRIVER",
});

export const BOOKING_ROLE = Object.freeze({
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPERADMIN",
});

const ALL_CAPABILITIES = Object.freeze(Object.values(BOOKING_CAPABILITY));

/** Stages at which the supplier still owes Rovaro a decision. */
const SUPPLIER_DECISION_STAGES = new Set([
  PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
]);

/** Stages at which the Booking Fee is verified paid. */
const PAID_STAGES = new Set([
  PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED,
  PLATFORM_WORKFLOW_STAGE.COMPLETION_PENDING,
  PLATFORM_WORKFLOW_STAGE.COMPLETED,
]);

/** Nothing on the booking may move any more. */
const CLOSED_STAGES = new Set([
  PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED,
  PLATFORM_WORKFLOW_STAGE.PAYMENT_EXPIRED,
  PLATFORM_WORKFLOW_STAGE.CANCELLED,
]);

function noCapabilities(extra = {}) {
  const denied = {};
  for (const key of ALL_CAPABILITIES) denied[key] = false;
  return { ...denied, ...extra };
}

function normaliseId(value) {
  const id = String(value ?? "").trim();
  return id && id !== "null" && id !== "undefined" ? id : "";
}

function normaliseRole(role) {
  return String(role || "").trim().toUpperCase() === BOOKING_ROLE.SUPERADMIN
    ? BOOKING_ROLE.SUPERADMIN
    : BOOKING_ROLE.ADMIN;
}

/**
 * Accepts either a product stage or the stored `bookingStatus`, because the
 * calendar carries the stored value and the modal carries the stage.
 */
function normaliseStage(status) {
  const raw = String(status || "").trim();
  if (!raw) return PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION;
  if (Object.values(PLATFORM_WORKFLOW_STAGE).includes(raw)) return raw;
  return resolvePlatformWorkflowStage({ source: BOOKING_SOURCE.PLATFORM, bookingStatus: raw });
}

/**
 * The canonical permission answer.
 *
 * @param {{
 *   source: string,
 *   status: string,
 *   role: string,
 *   companyId: string|null,
 *   orderCompanyId: string|null,
 * }} input
 * @returns {Record<string, boolean>}
 */
export function resolveBookingCapabilities({
  source,
  status,
  role,
  companyId,
  orderCompanyId,
} = {}) {
  const actorRole = normaliseRole(role);
  const isSuper = actorRole === BOOKING_ROLE.SUPERADMIN;
  const actorCompany = normaliseId(companyId);
  const bookingCompany = normaliseId(orderCompanyId);
  const resolvedSource = String(source || "").trim().toUpperCase();
  const isPlatform = resolvedSource === BOOKING_SOURCE.PLATFORM;
  const isInternal = resolvedSource === BOOKING_SOURCE.INTERNAL;

  // An unclassified record must be reviewed rather than guessed into a set of
  // powers, and another company's booking is indistinguishable from a missing
  // one.
  if (!isPlatform && !isInternal) return noCapabilities();
  const ownsBooking =
    Boolean(actorCompany) && Boolean(bookingCompany) && actorCompany === bookingCompany;
  if (!isSuper && !ownsBooking) return noCapabilities();

  if (isInternal) {
    // The company owns its own calendar records end to end; the platform
    // superadmin may read them but never edits them or bills against them.
    return noCapabilities({
      [BOOKING_CAPABILITY.VIEW_BOOKING]: true,
      [BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]: true,
      [BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]: true,
      [BOOKING_CAPABILITY.CONTACT_CUSTOMER]: true,
      [BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]: !isSuper,
      // Nobody reaches this branch without either owning the record or being
      // the superadmin, and the platform does not mediate it.
      [BOOKING_CAPABILITY.ADD_SECOND_DRIVER]: true,
    });
  }

  const stage = normaliseStage(status);
  const awaitingSupplier = SUPPLIER_DECISION_STAGES.has(stage);
  const paid = PAID_STAGES.has(stage);
  const closed = CLOSED_STAGES.has(stage);

  if (isSuper) {
    // Rovaro sees everything and may amend under audit, but never confirms the
    // vehicle on the supplier's behalf and never asks itself a question.
    return noCapabilities({
      [BOOKING_CAPABILITY.VIEW_BOOKING]: true,
      [BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]: true,
      [BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]: true,
      [BOOKING_CAPABILITY.CONTACT_CUSTOMER]: true,
      [BOOKING_CAPABILITY.REPORT_PROBLEM]: paid,
      [BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]: !closed,
      [BOOKING_CAPABILITY.ADD_SECOND_DRIVER]: true,
    });
  }

  return noCapabilities({
    [BOOKING_CAPABILITY.VIEW_BOOKING]: true,
    [BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]: awaitingSupplier,
    [BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]: awaitingSupplier,
    [BOOKING_CAPABILITY.DECLINE_REQUEST]: awaitingSupplier,
    [BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]: paid,
    [BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]: paid,
    [BOOKING_CAPABILITY.CONTACT_CUSTOMER]: paid,
    [BOOKING_CAPABILITY.CONTACT_ROVARO]: true,
    [BOOKING_CAPABILITY.REPORT_PROBLEM]: paid,
  });
}

/**
 * A verified Stripe payment is the source of truth for the booking being paid.
 * A row whose stored status still lags behind the webhook must not hide the
 * contacts the supplier now needs to run the rental.
 */
function resolveEffectiveStage(order) {
  const stage = resolvePlatformWorkflowStage(order) || "";
  if (PAID_STAGES.has(stage) || CLOSED_STAGES.has(stage)) return stage;
  const paid = String(order?.payment?.status || "").trim().toLowerCase() === "paid";
  return paid ? PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED : stage;
}

/**
 * The same answer for a loaded order and session user.
 *
 * Driving documents get one extra gate that only the licence policy owns: the
 * lawful access window around the rental. That rule lives in
 * `domain/legal/drivingLicenceAccess.js` and is called, not restated.
 *
 * @param {object|null} order
 * @param {object|null} user session.user
 * @param {{ now?: Date }} [opts]
 */
export function resolveOrderCapabilities(order, user, opts = {}) {
  if (!order) return noCapabilities();
  const role = resolveActorRole(user);
  const capabilities = resolveBookingCapabilities({
    source: resolveBookingSource(order),
    status: isInternalBooking(order) ? "" : resolveEffectiveStage(order),
    role,
    companyId: resolveActorCompanyId(user),
    orderCompanyId: order.ownerId,
  });

  if (!capabilities[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]) return capabilities;

  const licence = evaluateDrivingLicenceAccess({
    order,
    isSuperadmin: role === BOOKING_ROLE.SUPERADMIN,
    sessionOwnerId: resolveActorCompanyId(user),
    ...(opts.now ? { now: opts.now } : {}),
  });
  return {
    ...capabilities,
    [BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]: licence.allowed === true,
  };
}

/**
 * Role as the resolver understands it. A superadmin who is viewing the console
 * as one company acts with that company's powers, not with platform powers,
 * which is exactly what `policyRoleFromUser` already decides for order access.
 */
export function resolveActorRole(user) {
  return policyRoleFromUser(user) === ROLE.SUPERADMIN
    ? BOOKING_ROLE.SUPERADMIN
    : BOOKING_ROLE.ADMIN;
}

export function resolveActorCompanyId(user) {
  return normaliseId(user?.viewAsCompanyId) || normaliseId(user?.ownerId);
}

export function hasBookingCapability(capabilities, capability) {
  return capabilities?.[capability] === true;
}

/**
 * Guard for mutation routes.
 *
 * @returns {{ ok: true } | { ok: false, status: number, code: string, message: string }}
 */
export function assertBookingCapability(capabilities, capability) {
  if (hasBookingCapability(capabilities, capability)) return { ok: true };
  if (!hasBookingCapability(capabilities, BOOKING_CAPABILITY.VIEW_BOOKING)) {
    return {
      ok: false,
      status: 404,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found",
    };
  }
  return {
    ok: false,
    status: 403,
    code: "CAPABILITY_DENIED",
    message: `This action is not permitted on this booking (${capability})`,
  };
}

/**
 * Fields a PLATFORM booking never accepts from a company admin, whatever the
 * UI sent. Kept next to the capabilities so the read rules, the write rules
 * and the rendered sections cannot drift apart.
 */
export const PLATFORM_LOCKED_FIELDS = Object.freeze([
  "rentalStartDate",
  "rentalEndDate",
  "numberOfDays",
  "timeIn",
  "timeOut",
  "placeIn",
  "placeInDetail",
  "placeOut",
  "placeOutDetail",
  "flightNumber",
  "insurance",
  "franchiseOrder",
  "ChildSeats",
  "secondDriver",
  "totalPrice",
  "OverridePrice",
  "deliveryInOverride",
  "deliveryOutOverride",
  "car",
  "carModel",
  "carNumber",
  "customerName",
  "phone",
  "email",
  "Viber",
  "Whatsapp",
  "Telegram",
  "drivingLicenceUrls",
  "confirmed",
  "offline",
  "source",
  "my_order",
]);

const PLATFORM_LOCKED_SET = new Set(PLATFORM_LOCKED_FIELDS);

/**
 * Which requested field writes the capabilities refuse.
 *
 * @param {{ capabilities: object, source: string, fields: string[] }} input
 * @returns {{ allowed: boolean, deniedFields: string[], code: string }}
 */
export function checkBookingFieldWrites({ capabilities, source, fields } = {}) {
  const requested = Array.isArray(fields) ? fields : [];
  const isPlatform = String(source || "").trim().toUpperCase() === BOOKING_SOURCE.PLATFORM;
  const denied = [];

  for (const field of requested) {
    if (field === "secondDriver") {
      if (!hasBookingCapability(capabilities, BOOKING_CAPABILITY.ADD_SECOND_DRIVER)) {
        denied.push(field);
      }
      continue;
    }
    if (!isPlatform) continue;
    // Locked for everyone on this route. A superadmin still changes these, but
    // only through the audited `Amend booking` operation, never through a
    // generic field write that leaves no reason and no before/after snapshot.
    if (PLATFORM_LOCKED_SET.has(field)) denied.push(field);
  }

  return {
    allowed: denied.length === 0,
    deniedFields: [...new Set(denied)],
    code: isPlatform ? "PLATFORM_BOOKING_READ_ONLY" : "CAPABILITY_DENIED",
  };
}
