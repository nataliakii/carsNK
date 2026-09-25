/**
 * One permission resolver for contractor calendar, orders list, email deep
 * links, and mutation APIs. Button visibility is not a permission.
 *
 * The rules themselves live in `domain/orders/bookingCapabilities.js`, which
 * is what the read routes use to decide what may be serialised at all. This
 * module is the booking-flow facing shape of the same answer: a Set of
 * capability names plus the modal/mutation decisions built on top of it.
 * There is deliberately no second copy of the rules here.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  BOOKING_SOURCE,
  isPlatformBooking,
  PLATFORM_WORKFLOW_STAGE,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_CAPABILITY,
  BOOKING_ROLE,
  resolveActorRole,
  resolveBookingCapabilities as resolveCapabilityMap,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";
import { orderBelongsToAnotherCompany } from "@/domain/orders/orderOwnershipGuard";
import {
  AMENDMENT_ERROR,
  MATERIAL_AMENDMENT_FIELDS,
  bookingIsPaid,
  validateBookingAmendment,
} from "@/domain/orders/bookingAmendment";

export { BOOKING_CAPABILITY };

export const BOOKING_DETAILS_MODAL = "BookingDetailsModal";
export const INTERNAL_ORDER_MODAL = "EditOrderModal";

export const BOOKING_ACTOR = Object.freeze({
  SUPERADMIN: "superadmin",
  COMPANY_ADMIN: "company_admin",
});

const AWAITING_PAYMENT_STAGES = new Set([
  PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT,
  PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE,
]);

export function bookingActorRole(user) {
  if (!user) return null;
  return resolveActorRole(user) === BOOKING_ROLE.SUPERADMIN
    ? BOOKING_ACTOR.SUPERADMIN
    : BOOKING_ACTOR.COMPANY_ADMIN;
}

function toSet(capabilityMap) {
  return new Set(
    Object.entries(capabilityMap || {})
      .filter(([, allowed]) => allowed === true)
      .map(([capability]) => capability)
  );
}

/**
 * @param {{
 *   source?: string,
 *   status?: string,
 *   role?: "superadmin"|"company_admin"|null,
 *   companyId?: string|null,
 *   orderCompanyId?: string|null,
 * }} input
 * @returns {Set<string>}
 */
export function resolveBookingCapabilities({
  source,
  status,
  role,
  companyId,
  orderCompanyId,
} = {}) {
  return toSet(
    resolveCapabilityMap({
      source,
      status: status === "INTERNAL" ? "" : status,
      role:
        role === BOOKING_ACTOR.SUPERADMIN
          ? BOOKING_ROLE.SUPERADMIN
          : BOOKING_ROLE.ADMIN,
      companyId,
      orderCompanyId,
    })
  );
}

export function capabilitiesForOrder(order, user, opts = {}) {
  return toSet(resolveOrderCapabilities(order, user, opts));
}

export function bookingModalName(order) {
  return isPlatformBooking(order) ? BOOKING_DETAILS_MODAL : INTERNAL_ORDER_MODAL;
}

/**
 * Everything a PLATFORM booking refuses through the generic update route.
 * A superadmin reaches these through `Edit booking`, which carries a reason
 * and a before/after snapshot; nobody reaches them through a bare field write.
 */
const PLATFORM_MUTABLE_FIELDS = [
  "rentalStartDate",
  "rentalEndDate",
  "timeIn",
  "timeOut",
  "totalPrice",
  "OverridePrice",
  "insurance",
  "kacko",
  "ChildSeats",
  "secondDriver",
  "placeIn",
  "placeOut",
  "placeInDetail",
  "placeOutDetail",
  "offline",
  "source",
  "my_order",
  "confirmed",
  "customerName",
  "phone",
  "email",
  "car",
  "franchiseOrder",
  "numberOfDays",
  "deliveryInOverride",
  "deliveryOutOverride",
];

const MATERIAL_FIELDS = MATERIAL_AMENDMENT_FIELDS;

function touched(payload, names) {
  return names.filter((name) => payload && payload[name] !== undefined);
}

function amendmentChanges(payload) {
  const changes = {};
  for (const field of MATERIAL_FIELDS) {
    if (payload?.[field] !== undefined) changes[field] = payload[field];
  }
  return changes;
}

/**
 * Backend twin of the modal. Company admins cannot edit a PLATFORM booking,
 * and on a PLATFORM booking the second driver is a Rovaro extra nobody but
 * Rovaro may add. Superadmin material changes need an amendment reason and
 * must not silently rewrite terms the customer has already paid for.
 */
export function decideOrderUpdate({ order, user, payload = {} } = {}) {
  const role = bookingActorRole(user);
  const caps = capabilitiesForOrder(order, user);

  // Ownership comes before any field rule, so the answer is the same on both
  // sources and whatever the payload happens to contain.
  if (orderBelongsToAnotherCompany(user, order)) {
    return {
      ok: false,
      status: 403,
      code: "CAPABILITY_DENIED",
      message: "This booking belongs to another fleet",
    };
  }

  // On a PLATFORM booking the second driver is priced and sold by Rovaro to
  // the customer, so only Rovaro adds it. An INTERNAL booking is the
  // contractor's own offline record and its owner adds it freely.
  if (
    payload?.secondDriver !== undefined &&
    !caps.has(BOOKING_CAPABILITY.ADD_SECOND_DRIVER)
  ) {
    return {
      ok: false,
      status: 403,
      code: "CAPABILITY_DENIED",
      message: "Only Rovaro can add the second driver to a platform booking",
      fields: ["secondDriver"],
    };
  }

  if (!isPlatformBooking(order)) return { ok: true };

  const stage = resolvePlatformWorkflowStage(order);
  if (!caps.has(BOOKING_CAPABILITY.VIEW_BOOKING)) {
    return {
      ok: false,
      status: 403,
      code: "CAPABILITY_DENIED",
      message: "You cannot change this booking",
    };
  }

  const forbidden = touched(payload, PLATFORM_MUTABLE_FIELDS);
  const material = touched(payload, MATERIAL_FIELDS);

  if (role === BOOKING_ACTOR.COMPANY_ADMIN) {
    if (forbidden.length || payload.reportProblem === false) {
      const reversing =
        AWAITING_PAYMENT_STAGES.has(stage) &&
        (payload.confirmed === false || payload.bookingStatus);
      return {
        ok: false,
        status: reversing ? 409 : 403,
        code: reversing ? "CONFIRMATION_IRREVERSIBLE" : "CAPABILITY_DENIED",
        message: reversing
          ? "Supplier confirmation cannot be reversed"
          : "Platform bookings cannot be edited by the rental company",
        fields: forbidden,
      };
    }
    if (payload.reportProblem === true && !caps.has(BOOKING_CAPABILITY.REPORT_PROBLEM)) {
      return {
        ok: false,
        status: 403,
        code: "CAPABILITY_DENIED",
        message: "A problem can be reported only after payment",
      };
    }
    return { ok: true, reportProblem: payload.reportProblem === true };
  }

  if (!material.length) return { ok: true };

  if (!caps.has(BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING)) {
    return { ok: false, status: 403, code: "CAPABILITY_DENIED" };
  }

  const reason = String(payload.amendmentReason || "").trim();
  const requestedBy = String(payload.amendmentRequestedBy || "").trim();
  if (!reason || !requestedBy) {
    return {
      ok: false,
      status: 400,
      code: "AMENDMENT_REASON_REQUIRED",
      message: "An amendment needs a reason and who requested it",
    };
  }

  // After payment the customer's agreement is part of the record. Without it
  // the amendment is refused outright rather than written and explained later.
  if (bookingIsPaid(order) && payload.customerConsentRecorded !== true) {
    return {
      ok: false,
      status: 409,
      code: "PAID_TERMS_IMMUTABLE",
      message:
        "Paid booking terms cannot be rewritten. Use a refund or additional-payment flow.",
      fields: material,
    };
  }

  const amendment = validateBookingAmendment({
    order,
    changes: amendmentChanges(payload),
    reason,
    requestedBy,
    actor: {
      id: user?.id || user?._id || "",
      email: user?.email || user?.name || "",
      role: BOOKING_ROLE.SUPERADMIN,
    },
    customerConsent:
      payload.customerConsentRecorded === true
        ? { recorded: true, note: String(payload.customerConsentNote || "") }
        : null,
  });
  if (!amendment.ok) {
    return {
      ok: false,
      status: amendment.status,
      code:
        amendment.code === AMENDMENT_ERROR.CONSENT_REQUIRED
          ? "PAID_TERMS_IMMUTABLE"
          : amendment.code,
      message: amendment.message,
      fields: amendment.fields,
    };
  }

  return { ok: true, audit: amendment.record, amendment: amendment.record };
}

export function awaitingPaymentStage(status) {
  return AWAITING_PAYMENT_STAGES.has(status);
}

export { BOOKING_SOURCE, BOOKING_STATUS };
