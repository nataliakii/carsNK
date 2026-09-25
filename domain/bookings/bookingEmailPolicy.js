/**
 * ONE canonical Rovaro booking email policy.
 *
 * Written rule: ./ROVARO_BOOKING_EMAIL_POLICY.md
 *
 * Every route, cron job, Stripe webhook handler and notification service that
 * wants to send a booking lifecycle email asks this module first. Nothing else
 * decides whether a booking email may leave the platform.
 *
 * Reused, never duplicated:
 *   stored statuses   → domain/booking/bookingStatus.js
 *   product stages    → domain/admin/rovaroContractorAdmin.js
 *                       domain/booking/rovaroMarketplaceWorkflow.js
 *   supplier actions  → domain/orders/supplierResponse.js
 *   replacement rules → domain/booking/equivalentReplacement.js
 *   money             → domain/orders/bookingFinancialSnapshot.js
 *                       domain/orders/marketplaceBookingFee.js
 *
 * This module is pure. It does not import mongoose, nodemailer or templates,
 * so client components and unit tests can load it safely.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  isInternalBooking,
  isPlatformBooking,
  PLATFORM_WORKFLOW_STAGE,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";
import {
  bpsToPercentNumber,
  formatMarketplaceFeePercent,
  marketplacePlatformAmountMinor,
  snapshotMarketplaceBookingFeeBps,
} from "@/domain/orders/marketplaceBookingFee";
import {
  formatSnapshotMoney,
  resolveBookingFinancialSnapshot,
} from "@/domain/orders/bookingFinancialSnapshot";
import { isValidPublicBookingReference } from "@/domain/booking/publicBookingReferenceValidate";

/* ────────────────────────────────────────────────────────────────
 * 1. The six communication events of the standard successful flow
 * ──────────────────────────────────────────────────────────────── */

export const BOOKING_EMAIL_EVENT = Object.freeze({
  /** 1 — customer submits the request. */
  CUSTOMER_REQUEST_RECEIVED: "CUSTOMER_REQUEST_RECEIVED",
  /** 2 — supplier is asked to confirm availability. */
  SUPPLIER_NEW_REQUEST: "SUPPLIER_NEW_REQUEST",
  /** 3 — supplier confirmed the requested vehicle. */
  CUSTOMER_PAYMENT_REQUIRED: "CUSTOMER_PAYMENT_REQUIRED",
  /** 3' — supplier confirmed an equivalent replacement instead. */
  CUSTOMER_REPLACEMENT_PAYMENT_REQUIRED: "CUSTOMER_REPLACEMENT_PAYMENT_REQUIRED",
  /** 4 — inbound only. The customer replies to Rovaro. Never a campaign. */
  CUSTOMER_REPLACEMENT_OBJECTION: "CUSTOMER_REPLACEMENT_OBJECTION",
  /** 5 — verified Stripe payment. */
  CUSTOMER_BOOKING_CONFIRMED: "CUSTOMER_BOOKING_CONFIRMED",
  /** 6 — verified Stripe payment. */
  SUPPLIER_BOOKING_PAID: "SUPPLIER_BOOKING_PAID",

  /** Exception, one concise message, only after Rovaro records the objection. */
  SUPPLIER_REPLACEMENT_OBJECTION_NOTICE: "SUPPLIER_REPLACEMENT_OBJECTION_NOTICE",
  /** Isolated observability copy. Never required by the customer flow. */
  SUPERADMIN_BOOKING_PAYMENT_RECEIVED: "SUPERADMIN_BOOKING_PAYMENT_RECEIVED",
});

/**
 * The hard rule. A standard successful booking produces exactly these six
 * communication events, in this order, and nothing else.
 */
export const STANDARD_FLOW_EVENTS = Object.freeze([
  BOOKING_EMAIL_EVENT.CUSTOMER_REQUEST_RECEIVED,
  BOOKING_EMAIL_EVENT.SUPPLIER_NEW_REQUEST,
  BOOKING_EMAIL_EVENT.CUSTOMER_PAYMENT_REQUIRED,
  BOOKING_EMAIL_EVENT.CUSTOMER_REPLACEMENT_OBJECTION,
  BOOKING_EMAIL_EVENT.CUSTOMER_BOOKING_CONFIRMED,
  BOOKING_EMAIL_EVENT.SUPPLIER_BOOKING_PAID,
]);

export const BOOKING_EMAIL_AUDIENCE = Object.freeze({
  CUSTOMER: "customer",
  SUPPLIER: "supplier",
  SUPERADMIN: "superadmin",
  /** Inbound to the Rovaro bookings mailbox. No outbound campaign. */
  ROVARO: "rovaro",
});

export const BOOKING_EMAIL_DELIVERY = Object.freeze({
  /** Sent automatically by the platform as part of the standard flow. */
  AUTOMATIC: "automatic",
  /** Arrives at Rovaro. The platform never generates it. */
  INBOUND: "inbound",
  /** Only after a human at Rovaro records the exception. */
  EXCEPTION: "exception",
  /** Superadmin observability. Configurable, never on the customer path. */
  OBSERVABILITY: "observability",
});

/* ────────────────────────────────────────────────────────────────
 * 2. Product stages. No third vocabulary — these map onto the stored enum.
 * ──────────────────────────────────────────────────────────────── */

export const BOOKING_EMAIL_STAGE = Object.freeze({
  AWAITING_SUPPLIER_CONFIRMATION: "AWAITING_SUPPLIER_CONFIRMATION",
  AWAITING_CUSTOMER_PAYMENT: "AWAITING_CUSTOMER_PAYMENT",
  /**
   * Supplier confirmed an equivalent replacement and the customer has not paid.
   * Stored as BOOKING_STATUS.ALTERNATIVE_PROPOSED — the enum that already
   * means "a replacement is pending a customer decision". No new stored value.
   */
  AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT:
    "AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT",
  /** Manual queue after the customer refuses the replacement by email. */
  CUSTOMER_REPLACEMENT_OBJECTION: "CUSTOMER_REPLACEMENT_OBJECTION",
  SUPPLIER_DECLINED: "SUPPLIER_DECLINED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",
  CANCELLED: "CANCELLED",
});

/** Product stage → stored `order.bookingStatus`. */
export const BOOKING_EMAIL_STAGE_TO_BOOKING_STATUS = Object.freeze({
  [BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION]:
    BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
  [BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT]:
    BOOKING_STATUS.PAYMENT_PROCESSING,
  [BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT]:
    BOOKING_STATUS.ALTERNATIVE_PROPOSED,
  [BOOKING_EMAIL_STAGE.CUSTOMER_REPLACEMENT_OBJECTION]:
    BOOKING_STATUS.ALTERNATIVE_PROPOSED,
  [BOOKING_EMAIL_STAGE.SUPPLIER_DECLINED]: BOOKING_STATUS.SUPPLIER_DECLINED,
  [BOOKING_EMAIL_STAGE.BOOKING_CONFIRMED]: BOOKING_STATUS.BOOKING_CONFIRMED,
  [BOOKING_EMAIL_STAGE.PAYMENT_EXPIRED]: BOOKING_STATUS.PAYMENT_EXPIRED,
  [BOOKING_EMAIL_STAGE.CANCELLED]: BOOKING_STATUS.CUSTOMER_CANCELLED,
});

export function isReplacementObjectionRecorded(order) {
  const objection = order?.replacementObjection;
  return Boolean(objection && objection.recordedAt && !objection.resolvedAt);
}

function hasPendingReplacement(order) {
  return Boolean(order?.pendingReplacementProposal?.checksum);
}

export function bookingFeeIsPaid(order) {
  const status = String(
    order?.payment?.status || order?.bookingFeePaymentStatus || ""
  )
    .trim()
    .toLowerCase();
  if (status === "paid") return true;
  return order?.customerConfirmation === "CONFIRMED_BY_PAYMENT";
}

/**
 * Product stage used by the email policy. Built on the existing platform
 * workflow stage, with the two product-level names the workflow does not
 * distinguish (pending replacement, recorded objection).
 *
 * @param {object|null|undefined} order
 * @returns {string|null} null for internal bookings
 */
export function resolveBookingEmailStage(order) {
  const platformStage = resolvePlatformWorkflowStage(order);
  if (!platformStage) return null;

  if (
    platformStage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE
  ) {
    return isReplacementObjectionRecorded(order)
      ? BOOKING_EMAIL_STAGE.CUSTOMER_REPLACEMENT_OBJECTION
      : BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT;
  }
  if (platformStage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT) {
    if (isReplacementObjectionRecorded(order)) {
      return BOOKING_EMAIL_STAGE.CUSTOMER_REPLACEMENT_OBJECTION;
    }
    return hasPendingReplacement(order)
      ? BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT
      : BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT;
  }
  if (
    platformStage === PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED ||
    platformStage === PLATFORM_WORKFLOW_STAGE.COMPLETION_PENDING ||
    platformStage === PLATFORM_WORKFLOW_STAGE.COMPLETED
  ) {
    return BOOKING_EMAIL_STAGE.BOOKING_CONFIRMED;
  }
  if (platformStage === PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED) {
    return BOOKING_EMAIL_STAGE.SUPPLIER_DECLINED;
  }
  if (platformStage === PLATFORM_WORKFLOW_STAGE.PAYMENT_EXPIRED) {
    return BOOKING_EMAIL_STAGE.PAYMENT_EXPIRED;
  }
  if (platformStage === PLATFORM_WORKFLOW_STAGE.CANCELLED) {
    return BOOKING_EMAIL_STAGE.CANCELLED;
  }
  return BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION;
}

/* ────────────────────────────────────────────────────────────────
 * 3. Supplier decisions available in the live order modal
 * ──────────────────────────────────────────────────────────────── */

export const SUPPLIER_DECISION = Object.freeze({
  CONFIRM_REQUESTED_VEHICLE: "CONFIRM_REQUESTED_VEHICLE",
  CONFIRM_WITH_EQUIVALENT_REPLACEMENT: "CONFIRM_WITH_EQUIVALENT_REPLACEMENT",
  DECLINE_REQUEST: "DECLINE_REQUEST",
  ASK_ROVARO_A_QUESTION: "ASK_ROVARO_A_QUESTION",
});

/** Decision → the one customer email it may produce, if any. */
export const SUPPLIER_DECISION_EMAIL = Object.freeze({
  [SUPPLIER_DECISION.CONFIRM_REQUESTED_VEHICLE]:
    BOOKING_EMAIL_EVENT.CUSTOMER_PAYMENT_REQUIRED,
  [SUPPLIER_DECISION.CONFIRM_WITH_EQUIVALENT_REPLACEMENT]:
    BOOKING_EMAIL_EVENT.CUSTOMER_REPLACEMENT_PAYMENT_REQUIRED,
  /** Manual Rovaro task. No automatic customer email in this implementation. */
  [SUPPLIER_DECISION.DECLINE_REQUEST]: null,
  [SUPPLIER_DECISION.ASK_ROVARO_A_QUESTION]: null,
});

/** Product stage a decision moves the booking to. */
export const SUPPLIER_DECISION_STAGE = Object.freeze({
  [SUPPLIER_DECISION.CONFIRM_REQUESTED_VEHICLE]:
    BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT,
  [SUPPLIER_DECISION.CONFIRM_WITH_EQUIVALENT_REPLACEMENT]:
    BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT,
  [SUPPLIER_DECISION.DECLINE_REQUEST]: BOOKING_EMAIL_STAGE.SUPPLIER_DECLINED,
  [SUPPLIER_DECISION.ASK_ROVARO_A_QUESTION]:
    BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
});

/**
 * A stale browser tab or an old email must not overwrite a newer decision.
 * The caller reads the order, calls this with the status it is about to
 * overwrite, and only then writes.
 *
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function assertSupplierDecisionIsCurrent({
  order,
  decision,
  expectedStage,
} = {}) {
  if (!SUPPLIER_DECISION[decision]) {
    return { ok: false, code: "unknown_decision", message: "Unknown supplier decision." };
  }
  const stage = resolveBookingEmailStage(order);
  if (!stage) {
    return {
      ok: false,
      code: "not_platform_booking",
      message: "Internal bookings have no supplier decision.",
    };
  }
  if (expectedStage && expectedStage !== stage) {
    return {
      ok: false,
      code: "stale_supplier_decision",
      message: "This booking has already moved on. Reload the order.",
    };
  }
  if (stage !== BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION) {
    return {
      ok: false,
      code: "stale_supplier_decision",
      message: "This booking is no longer waiting for a supplier decision.",
    };
  }
  if (bookingFeeIsPaid(order)) {
    return {
      ok: false,
      code: "already_paid",
      message: "The customer already paid. The supplier response is locked.",
    };
  }
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────
 * 4. Event registry
 * ──────────────────────────────────────────────────────────────── */

const REGISTRY = Object.freeze({
  [BOOKING_EMAIL_EVENT.CUSTOMER_REQUEST_RECEIVED]: {
    audience: BOOKING_EMAIL_AUDIENCE.CUSTOMER,
    delivery: BOOKING_EMAIL_DELIVERY.AUTOMATIC,
    stages: [BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION],
    subject: "We received your booking request",
  },
  [BOOKING_EMAIL_EVENT.SUPPLIER_NEW_REQUEST]: {
    audience: BOOKING_EMAIL_AUDIENCE.SUPPLIER,
    delivery: BOOKING_EMAIL_DELIVERY.AUTOMATIC,
    stages: [BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION],
    subject: null, // built from vehicle + short date range
  },
  [BOOKING_EMAIL_EVENT.CUSTOMER_PAYMENT_REQUIRED]: {
    audience: BOOKING_EMAIL_AUDIENCE.CUSTOMER,
    delivery: BOOKING_EMAIL_DELIVERY.AUTOMATIC,
    stages: [
      BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
      BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT,
    ],
    subject: "Your vehicle is available — confirm your booking",
  },
  [BOOKING_EMAIL_EVENT.CUSTOMER_REPLACEMENT_PAYMENT_REQUIRED]: {
    audience: BOOKING_EMAIL_AUDIENCE.CUSTOMER,
    delivery: BOOKING_EMAIL_DELIVERY.AUTOMATIC,
    stages: [
      BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
      BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT,
      BOOKING_EMAIL_STAGE.CUSTOMER_REPLACEMENT_OBJECTION,
    ],
    subject: "The rental company has offered a replacement vehicle",
    replyTo: true,
    /** A re-send after an objection is a superadmin action, not a campaign. */
    manualAfterObjection: true,
  },
  [BOOKING_EMAIL_EVENT.CUSTOMER_REPLACEMENT_OBJECTION]: {
    audience: BOOKING_EMAIL_AUDIENCE.ROVARO,
    delivery: BOOKING_EMAIL_DELIVERY.INBOUND,
    stages: [
      BOOKING_EMAIL_STAGE.AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT,
      BOOKING_EMAIL_STAGE.CUSTOMER_REPLACEMENT_OBJECTION,
    ],
    subject: null,
  },
  [BOOKING_EMAIL_EVENT.SUPPLIER_REPLACEMENT_OBJECTION_NOTICE]: {
    audience: BOOKING_EMAIL_AUDIENCE.SUPPLIER,
    delivery: BOOKING_EMAIL_DELIVERY.EXCEPTION,
    stages: [BOOKING_EMAIL_STAGE.CUSTOMER_REPLACEMENT_OBJECTION],
    subject: "Update on a booking request",
  },
  [BOOKING_EMAIL_EVENT.CUSTOMER_BOOKING_CONFIRMED]: {
    audience: BOOKING_EMAIL_AUDIENCE.CUSTOMER,
    delivery: BOOKING_EMAIL_DELIVERY.AUTOMATIC,
    stages: [BOOKING_EMAIL_STAGE.BOOKING_CONFIRMED],
    requiresVerifiedPayment: true,
    subject: null, // "Booking confirmed — {vehicle}, {shortDateRange}"
  },
  [BOOKING_EMAIL_EVENT.SUPPLIER_BOOKING_PAID]: {
    audience: BOOKING_EMAIL_AUDIENCE.SUPPLIER,
    delivery: BOOKING_EMAIL_DELIVERY.AUTOMATIC,
    stages: [BOOKING_EMAIL_STAGE.BOOKING_CONFIRMED],
    requiresVerifiedPayment: true,
    subject: "Booking confirmed — customer payment received",
  },
  [BOOKING_EMAIL_EVENT.SUPERADMIN_BOOKING_PAYMENT_RECEIVED]: {
    audience: BOOKING_EMAIL_AUDIENCE.SUPERADMIN,
    delivery: BOOKING_EMAIL_DELIVERY.OBSERVABILITY,
    stages: [BOOKING_EMAIL_STAGE.BOOKING_CONFIRMED],
    requiresVerifiedPayment: true,
    optional: true,
    subject: null,
  },
});

export function bookingEmailEventDefinition(event) {
  return REGISTRY[event] || null;
}

export function isStandardFlowEvent(event) {
  return STANDARD_FLOW_EVENTS.includes(event);
}

/**
 * Events that may still be delivered once the Booking Fee is paid.
 * Everything else is silence.
 */
export const POST_PAYMENT_ALLOWED_EVENTS = Object.freeze([
  BOOKING_EMAIL_EVENT.CUSTOMER_BOOKING_CONFIRMED,
  BOOKING_EMAIL_EVENT.SUPPLIER_BOOKING_PAID,
  BOOKING_EMAIL_EVENT.SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
]);

/**
 * Lifecycle sends that existed before this policy and must never fire
 * automatically again. A human at Rovaro may still send a one-off message.
 * Keys are `MAIL_TYPE` values so audits can grep MailLog rows.
 */
export const RETIRED_AUTOMATIC_MAIL_TYPES = Object.freeze([
  "order.paid_customer",
  "order.paid_partner",
  "order.company_action",
  "order.alternative_accepted",
  "order.alternative_declined",
  "order.alternative_expired",
  "order.alternative_withdrawn",
  "order.official_confirmation",
]);

/**
 * Sends that are legitimate but are not part of the standard flow. They need
 * an explicit human trigger (`manualTrigger: true`) and a reason.
 */
export const MANUAL_ONLY_MAIL_TYPES = Object.freeze([
  "order.payment_link_expired",
  "order.payment_link_unavailable",
  "order.payment_link_reissued",
  "order.declined",
  "order.booking_fee_refunded",
  "order.price_corrected_customer",
  "order.price_corrected_partner",
  "order.partner_support",
]);

/* ────────────────────────────────────────────────────────────────
 * 5. Idempotency
 * ──────────────────────────────────────────────────────────────── */

/**
 * Deterministic key `{orderId}:{event}:{audience}:{proposalVersion?}`.
 * Retried jobs and duplicated Stripe webhooks collide on the same key.
 */
export function bookingEmailNotificationKey({
  orderId,
  event,
  audience,
  proposalVersion,
} = {}) {
  const id = String(orderId || "").trim();
  const ev = String(event || "").trim();
  const aud = String(audience || "").trim();
  if (!id || !ev || !aud) return "";
  const version =
    proposalVersion == null || proposalVersion === ""
      ? ""
      : `:${String(proposalVersion).trim()}`;
  return `${id}:${ev}:${aud}${version}`;
}

function proposalVersionOf(order, context) {
  if (context?.proposalVersion != null) return context.proposalVersion;
  const pending = order?.pendingReplacementProposal;
  if (!pending) return undefined;
  return pending.version ?? pending.checksum ?? undefined;
}

/* ────────────────────────────────────────────────────────────────
 * 6. The resolver — the only gate
 * ──────────────────────────────────────────────────────────────── */

function deny(event, audience, code, reason, extra = {}) {
  return { allowed: false, event, audience, code, reason, ...extra };
}

/**
 * Decide whether a booking email may be sent.
 *
 * @param {object} params
 * @param {string} params.event BOOKING_EMAIL_EVENT.*
 * @param {object} params.order stored order (lean object or document)
 * @param {string} [params.audience] defaults to the event's own audience
 * @param {object} [params.context]
 * @param {boolean} [params.context.manualTrigger] a human at Rovaro asked for it
 * @param {boolean} [params.context.verifiedPayment] set only by the Stripe webhook
 * @param {boolean} [params.context.superadminEmailEnabled]
 * @param {string|number} [params.context.proposalVersion]
 * @returns {{
 *   allowed: boolean,
 *   event: string,
 *   audience: string,
 *   code?: string,
 *   reason?: string,
 *   delivery?: string,
 *   stage?: string|null,
 *   notificationKey?: string,
 *   subject?: string|null,
 *   replyTo?: string,
 * }}
 */
export function resolveBookingEmail({
  event,
  order,
  audience,
  context = {},
} = {}) {
  const definition = REGISTRY[event];
  if (!definition) {
    return deny(event, audience, "unknown_event", "Event is not in the policy.");
  }
  const target = audience || definition.audience;
  if (target !== definition.audience) {
    return deny(
      event,
      target,
      "audience_mismatch",
      "Customer, supplier and superadmin templates are never interchangeable."
    );
  }
  if (!order) {
    return deny(event, target, "missing_order", "An order is required.");
  }
  if (isInternalBooking(order) || !isPlatformBooking(order)) {
    return deny(
      event,
      target,
      "internal_booking",
      "Internal calendar bookings never send platform email."
    );
  }
  if (definition.delivery === BOOKING_EMAIL_DELIVERY.INBOUND) {
    return deny(
      event,
      target,
      "inbound_only",
      "The customer writes to Rovaro. The platform sends nothing."
    );
  }

  const stage = resolveBookingEmailStage(order);
  const paid = bookingFeeIsPaid(order);

  if (definition.requiresVerifiedPayment) {
    if (!paid && context.verifiedPayment !== true) {
      return deny(
        event,
        target,
        "payment_not_verified",
        "Only the verified Stripe webhook may confirm a booking.",
        { stage }
      );
    }
  } else if (paid && !POST_PAYMENT_ALLOWED_EVENTS.includes(event)) {
    return deny(
      event,
      target,
      "post_payment_silence",
      "No automatic lifecycle email is sent after payment confirmation.",
      { stage }
    );
  }

  const stageAllowed =
    !definition.stages ||
    definition.stages.includes(stage) ||
    (definition.requiresVerifiedPayment && context.verifiedPayment === true);
  if (!stageAllowed) {
    return deny(
      event,
      target,
      "stage_mismatch",
      `Event is not valid at stage ${stage}.`,
      { stage }
    );
  }

  if (
    definition.manualAfterObjection &&
    stage === BOOKING_EMAIL_STAGE.CUSTOMER_REPLACEMENT_OBJECTION &&
    context.manualTrigger !== true
  ) {
    return deny(
      event,
      target,
      "objection_requires_superadmin",
      "After an objection the customer is contacted only by a superadmin.",
      { stage }
    );
  }

  if (
    definition.delivery === BOOKING_EMAIL_DELIVERY.EXCEPTION &&
    context.manualTrigger !== true
  ) {
    return deny(
      event,
      target,
      "exception_requires_manual",
      "Exception notices are sent only after Rovaro records the exception.",
      { stage }
    );
  }

  if (definition.optional && context.superadminEmailEnabled === false) {
    return deny(
      event,
      target,
      "disabled_by_configuration",
      "Superadmin observability email is switched off.",
      { stage }
    );
  }

  return {
    allowed: true,
    event,
    audience: target,
    delivery: definition.delivery,
    stage,
    subject: definition.subject || null,
    replyTo: definition.replyTo ? bookingsReplyToAddress() : undefined,
    notificationKey: bookingEmailNotificationKey({
      orderId: order._id || order.orderId,
      event,
      audience: target,
      proposalVersion: proposalVersionOf(order, context),
    }),
  };
}

/**
 * Gate for booking mail that is not one of the six events: payment-link
 * operations, declines, refunds, price corrections, partner support.
 *
 * They stay legitimate, but only as an exception: never for internal
 * bookings, and never automatically once the Booking Fee is paid.
 *
 * @param {object} params
 * @param {object} params.order
 * @param {string} params.mailType MAIL_TYPE.* value
 * @param {boolean} [params.manualTrigger] a human at Rovaro asked for it
 * @returns {{ allowed: boolean, code?: string, reason?: string }}
 */
export function resolveExceptionBookingEmail({
  order,
  mailType,
  manualTrigger = false,
} = {}) {
  if (!order) {
    return { allowed: false, code: "missing_order", reason: "An order is required." };
  }
  if (isInternalBooking(order) || !isPlatformBooking(order)) {
    return {
      allowed: false,
      code: "internal_booking",
      reason: "Internal calendar bookings never send platform email.",
    };
  }
  const type = String(mailType || "");
  if (RETIRED_AUTOMATIC_MAIL_TYPES.includes(type) && !manualTrigger) {
    return {
      allowed: false,
      code: "retired_lifecycle_email",
      reason: "This lifecycle email was retired by the booking email policy.",
    };
  }
  if (bookingFeeIsPaid(order) && !manualTrigger) {
    return {
      allowed: false,
      code: "post_payment_silence",
      reason: "No automatic email is sent after payment confirmation.",
    };
  }
  return { allowed: true };
}

/**
 * Throwing variant for call sites that treat a policy violation as a bug.
 * Prefer `resolveBookingEmail` where a skip is a normal outcome.
 */
export function assertBookingEmailAllowed(params) {
  const decision = resolveBookingEmail(params);
  if (!decision.allowed) {
    const err = new Error(
      `[bookingEmailPolicy] ${decision.event} blocked: ${decision.reason}`
    );
    err.code = decision.code;
    throw err;
  }
  return decision;
}

/* ────────────────────────────────────────────────────────────────
 * 7. Reply-To and links
 * ──────────────────────────────────────────────────────────────── */

export const DEFAULT_BOOKINGS_REPLY_TO = "bookings@rovaro.es";

export function bookingsReplyToAddress() {
  const configured = String(process.env.ROVARO_BOOKINGS_REPLY_TO || "").trim();
  return configured || DEFAULT_BOOKINGS_REPLY_TO;
}

/** The single supplier CTA. Opens the live order modal. */
export function supplierOrderModalPath(orderId) {
  return `/admin/orders?orderId=${encodeURIComponent(String(orderId || "").trim())}`;
}

/* ────────────────────────────────────────────────────────────────
 * 8. Content guards
 * ──────────────────────────────────────────────────────────────── */

const ADMIN_LINK_RE = /\/admin(\/|\?|\b)/i;
const MONGO_ID_RE = /\b[0-9a-f]{24}\b/i;
const STRIPE_ID_RE = /\b(cs|pi|ch|re|sub|cus|evt)_[A-Za-z0-9]{8,}\b/;
const ACTION_TOKEN_RE =
  /(partner-confirm|confirm-token|[?&](token|jwt|access|confirmToken)=)/i;
const INTERNAL_ENUM_RE = new RegExp(
  `\\b(${[
    ...Object.keys(BOOKING_STATUS),
    "AWAITING_SUPPLIER_RESPONSE",
    "PAYMENT_PROCESSING",
    "MARKETPLACE_REQUEST",
  ].join("|")})\\b`
);
/** Long numeric order numbers (20260921120000) are internal plumbing. */
const LONG_ORDER_NUMBER_RE = /\b\d{12,}\b/;

function blob({ subject = "", text = "", html = "" } = {}) {
  return `${subject}\n${text}\n${html}`;
}

/**
 * A customer email never carries admin links, Mongo ids, Stripe ids,
 * internal enums or timestamp order numbers.
 *
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function assertCustomerEmailSafe(content) {
  const body = blob(content);
  if (ADMIN_LINK_RE.test(body)) {
    return { ok: false, code: "customer_admin_link", message: "Admin link in customer email." };
  }
  if (MONGO_ID_RE.test(body)) {
    return { ok: false, code: "customer_mongo_id", message: "Mongo id in customer email." };
  }
  if (STRIPE_ID_RE.test(body.replace(/https?:\/\/\S*checkout\.stripe\.com\/\S*/gi, ""))) {
    return { ok: false, code: "customer_stripe_id", message: "Stripe identifier in customer email." };
  }
  if (INTERNAL_ENUM_RE.test(body)) {
    return { ok: false, code: "customer_internal_enum", message: "Internal status in customer email." };
  }
  if (LONG_ORDER_NUMBER_RE.test(body)) {
    return {
      ok: false,
      code: "customer_internal_order_number",
      message: "Timestamp order number in customer email. Use the public reference.",
    };
  }
  return { ok: true };
}

/**
 * The supplier request email carries exactly one call to action, pointing at
 * the live order modal, with no action token and no second booking link.
 */
export function assertSupplierRequestEmailSafe(content, { orderId } = {}) {
  const body = blob(content);
  if (ACTION_TOKEN_RE.test(body)) {
    return {
      ok: false,
      code: "supplier_action_token",
      message: "Confirm-by-email tokens are not allowed.",
    };
  }
  const links = String(content?.html || "").match(/href="([^"]+)"/gi) || [];
  const bookingLinks = links.filter((href) => /\/admin\/orders/i.test(href));
  if (bookingLinks.length !== 1) {
    return {
      ok: false,
      code: "supplier_cta_count",
      message: "The supplier email must contain exactly one booking link.",
    };
  }
  if (orderId && !bookingLinks[0].includes(encodeURIComponent(String(orderId)))) {
    return {
      ok: false,
      code: "supplier_cta_target",
      message: "The supplier CTA must open this order's modal.",
    };
  }
  return { ok: true };
}

/** The supplier never learns the customer's identity before payment. */
export function assertNoCustomerPiiBeforePayment(content, order) {
  if (bookingFeeIsPaid(order)) return { ok: true };
  const body = blob(content).toLowerCase();
  const pii = [order?.customerName, order?.email, order?.phone]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => value.length > 3);
  const leaked = pii.find((value) => body.includes(value));
  if (leaked) {
    return {
      ok: false,
      code: "pii_before_payment",
      message: "Customer contact details are revealed only after payment.",
    };
  }
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────
 * 9. Money and Stripe presentation
 * ──────────────────────────────────────────────────────────────── */

/**
 * Canonical split. At 10%, €165 is €16.50 now and €148.50 to the supplier; at
 * 30% the same gross is €180.60 and €421.40. Reads the stored snapshot first,
 * so a paid order keeps the rate it was charged at; the company's configured
 * rate is used only when an order has no snapshot yet.
 */
export function bookingPaymentAmounts(order) {
  const snap = resolveBookingFinancialSnapshot(order);
  const currency = snap.currency || "EUR";
  const feeBps =
    Number(snap.feeBps) > 0
      ? Number(snap.feeBps)
      : snapshotMarketplaceBookingFeeBps(order).bps;
  const bookingFeeMinor =
    snap.bookingFeeMinor > 0
      ? snap.bookingFeeMinor
      : marketplacePlatformAmountMinor(snap.grossMinor, feeBps);
  const supplierBalanceMinor =
    snap.supplierBalanceMinor > 0
      ? snap.supplierBalanceMinor
      : Math.max(0, snap.grossMinor - bookingFeeMinor);
  return {
    currency,
    feeBps,
    feePercent: bpsToPercentNumber(feeBps),
    feePercentLabel: formatMarketplaceFeePercent(feeBps),
    grossMinor: snap.grossMinor,
    bookingFeeMinor,
    supplierBalanceMinor,
    total: formatSnapshotMoney(snap.grossMinor, currency),
    bookingPayment: formatSnapshotMoney(bookingFeeMinor, currency),
    payableToSupplier: formatSnapshotMoney(supplierBalanceMinor, currency),
    source: snap.source,
  };
}

/**
 * Stripe product title. Never says "non-refundable" — the accepted Booking
 * Terms remain the legal source for cancellation and refunds.
 *
 * The percentage is the rate resolved for this order, never a literal: a
 * partner negotiated at 30% sees `30% booking payment — Seat Leon`, and an
 * already-paid order keeps the rate captured in its snapshot.
 */
export function stripeBookingProductTitle({ order, vehicle } = {}) {
  const { feePercentLabel } = bookingPaymentAmounts(order);
  const name = String(vehicle || order?.carModel || "").trim();
  const head = `${feePercentLabel}% booking payment`;
  return name ? `${head} — ${name}` : head;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function calendarParts(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) {
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  };
}

/**
 * Customer-facing date range. `1–5 Oct`, `28 Sep – 3 Oct`, `30 Dec 2026 – 2 Jan 2027`.
 */
export function shortBookingDateRange(start, end) {
  const a = calendarParts(start);
  const b = calendarParts(end);
  if (!a && !b) return "";
  if (a && !b) return `${a.d} ${SHORT_MONTHS[a.m - 1]}`;
  if (!a && b) return `${b.d} ${SHORT_MONTHS[b.m - 1]}`;
  const left = SHORT_MONTHS[a.m - 1];
  const right = SHORT_MONTHS[b.m - 1];
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${left}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${left}`;
  if (a.y === b.y) return `${a.d} ${left} – ${b.d} ${right}`;
  return `${a.d} ${left} ${a.y} – ${b.d} ${right} ${b.y}`;
}

/** `Booking RVR-7K4P9 · 1–5 Oct` */
export function stripeBookingProductDescription({
  publicReference,
  shortDateRange,
} = {}) {
  const reference = isValidPublicBookingReference(publicReference)
    ? String(publicReference).trim()
    : "";
  const range = String(shortDateRange || "").trim();
  if (reference && range) return `Booking ${reference} · ${range}`;
  if (reference) return `Booking ${reference}`;
  if (range) return `Booking · ${range}`;
  return "Booking";
}

/* ────────────────────────────────────────────────────────────────
 * 10. Canonical copy
 * ──────────────────────────────────────────────────────────────── */

export const BOOKING_EMAIL_COPY = Object.freeze({
  customerRequestReceived: (vehicle) =>
    Object.freeze({
      subject: "We received your booking request",
      lines: Object.freeze([
        `Thank you — we have received your request for the ${String(vehicle || "vehicle").trim()}.`,
        "The booking is not confirmed yet. We are now asking the rental company to confirm that the vehicle is available.",
        "As soon as the company responds, we will email you the next step.",
      ]),
    }),
  customerReplacementRefusal:
    "If you do not accept, simply reply to this email and tell us what you would prefer. You will not be charged.",
  supplierReplacementObjection:
    "The customer did not accept the proposed replacement. Rovaro is reviewing the request and will contact you if another option is needed.",
});

/** Rovaro never confirms a booking on anyone's behalf. */
export const FORBIDDEN_PHRASES = Object.freeze(["Confirmed by Rovaro"]);

export function containsForbiddenPhrase(content) {
  const body = blob(content).toLowerCase();
  return FORBIDDEN_PHRASES.some((phrase) => body.includes(phrase.toLowerCase()));
}

/* ────────────────────────────────────────────────────────────────
 * 11. Superadmin observability
 * ──────────────────────────────────────────────────────────────── */

/** Logged, not emailed. Logging replaces lifecycle notification. */
export const BOOKING_OBSERVABILITY_EVENT = Object.freeze({
  REQUEST_CREATED: "booking.request_created",
  SUPPLIER_RESPONSE: "booking.supplier_response",
  PAYMENT_LINK_CREATED: "booking.payment_link_created",
  PAYMENT_COMPLETED: "booking.payment_completed",
  EMAIL_DELIVERY_STATUS: "booking.email_delivery_status",
  REPLACEMENT_OBJECTION: "booking.replacement_objection",
  DISPUTE_OR_PROBLEM: "booking.dispute_or_problem",
});

/**
 * Record a customer's emailed refusal of a replacement. Pure — the caller
 * saves. Does not charge, does not expose a new payment link.
 */
export function recordReplacementObjection(order, { at = new Date(), by = "", note = "" } = {}) {
  if (!order) return { ok: false, code: "missing_order" };
  if (!isPlatformBooking(order)) return { ok: false, code: "not_platform_booking" };
  if (bookingFeeIsPaid(order)) return { ok: false, code: "already_paid" };
  const pending = order.pendingReplacementProposal || null;
  const objection = {
    recordedAt: new Date(at),
    recordedBy: String(by || ""),
    note: String(note || "").slice(0, 2000),
    proposalChecksum: pending?.checksum || "",
    proposalVersion: pending?.version ?? null,
    resolvedAt: null,
  };
  if (typeof order.set === "function") {
    order.set("replacementObjection", objection, { strict: false });
  } else {
    order.replacementObjection = objection;
  }
  return { ok: true, objection };
}

/**
 * A manual superadmin resend renders the current valid snapshot for an event
 * and creates no state transition.
 */
export function planBookingEmailResend({ event, order, audience } = {}) {
  const decision = resolveBookingEmail({
    event,
    order,
    audience,
    context: { manualTrigger: true, verifiedPayment: bookingFeeIsPaid(order) },
  });
  return { ...decision, createsStateTransition: false, manual: true };
}
