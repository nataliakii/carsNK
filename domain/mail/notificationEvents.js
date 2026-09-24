/**
 * Platform notification event registry (email matrix).
 * Customer-facing booking emails stay outside this matrix.
 */

export const NOTIFICATION_EVENT = Object.freeze({
  COMPANY_CREATED: "company.created",
  AGREEMENT_ACCEPTED: "company.agreement_accepted",
  RENTAL_TERMS_UPDATED: "company.rental_terms_updated",
  RENTAL_TERMS_REMOVED: "company.rental_terms_removed",
  IMPORTANT_SETTINGS_CHANGED: "company.important_settings_changed",
  CAR_ADDED: "car.added",
  CAR_DELETED: "car.deleted",
  CAR_DEACTIVATED: "car.deactivated",
  BOOKING_REQUESTED: "booking.requested",
  BOOKING_ACCEPTED: "booking.accepted",
  BOOKING_FEE_PAID: "booking.fee_paid",
  BOOKING_DECLINED: "booking.declined",
});

/** Who receives each event. Never invent recipients outside this map. */
export const NOTIFICATION_MATRIX = Object.freeze({
  [NOTIFICATION_EVENT.COMPANY_CREATED]: {
    companyAdmins: true,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.AGREEMENT_ACCEPTED]: {
    companyAdmins: false,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.RENTAL_TERMS_UPDATED]: {
    companyAdmins: false,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.RENTAL_TERMS_REMOVED]: {
    companyAdmins: false,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.IMPORTANT_SETTINGS_CHANGED]: {
    companyAdmins: false,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.CAR_ADDED]: {
    companyAdmins: false,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.CAR_DELETED]: {
    companyAdmins: false,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.CAR_DEACTIVATED]: {
    companyAdmins: false,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.BOOKING_REQUESTED]: {
    companyAdmins: true,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.BOOKING_ACCEPTED]: {
    companyAdmins: false,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.BOOKING_FEE_PAID]: {
    companyAdmins: true,
    superadmins: true,
  },
  [NOTIFICATION_EVENT.BOOKING_DECLINED]: {
    companyAdmins: true,
    superadmins: true,
  },
});

export const NOTIFICATION_EVENTS = Object.values(NOTIFICATION_EVENT);

/**
 * Stable idempotency key: event type + entity id (+ optional audience).
 * Webhook retries / repeated saves must collide on the same key.
 */
export function buildNotificationIdempotencyKey(eventType, entityId, audience = "") {
  const event = String(eventType || "").trim();
  const entity = String(entityId || "").trim();
  const audiencePart = String(audience || "").trim();
  if (!event || !entity) return "";
  return audiencePart ? `${event}:${entity}:${audiencePart}` : `${event}:${entity}`;
}
