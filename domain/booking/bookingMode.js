/**
 * Central rental booking-mode resolver.
 *
 * Do not infer mode from hostname in the domain layer. Call this once and
 * pass the result (and persist a snapshot on new orders).
 *
 * Modes:
 *   OPS_CALENDAR         — Greece operations calendar (default / legacy)
 *   MARKETPLACE_REQUEST  — Spain marketplace request (does not hard-block)
 *
 * Historical orders without a snapshot always resolve to OPS_CALENDAR so
 * existing Greece behaviour does not change after deploy.
 */

export const BOOKING_MODES = {
  OPS_CALENDAR: "OPS_CALENDAR",
  MARKETPLACE_REQUEST: "MARKETPLACE_REQUEST",
};

const MODE_SET = new Set(Object.values(BOOKING_MODES));

export function isBookingMode(value) {
  return MODE_SET.has(String(value || "").trim());
}

export function normalizeBookingMode(value) {
  const raw = String(value || "").trim();
  return MODE_SET.has(raw) ? raw : null;
}

/**
 * @param {object} [params]
 * @param {object} [params.order]
 * @param {object} [params.company]
 * @param {object} [params.platformSettings]
 * @param {string} [params.countryCode]
 * @param {boolean} [params.forNewOrder] — when true, company/country may select MARKETPLACE_REQUEST
 * @returns {string} BOOKING_MODES value
 */
export function resolveBookingMode({
  order,
  company,
  platformSettings,
  countryCode,
  forNewOrder = false,
} = {}) {
  const fromOrder = normalizeBookingMode(order?.bookingMode);
  if (fromOrder) return fromOrder;

  const looksLikePersistedOrder = Boolean(
    order && (order._id || order.id || order.orderNumber)
  );
  if (looksLikePersistedOrder && !forNewOrder) {
    return BOOKING_MODES.OPS_CALENDAR;
  }

  const fromCompany = normalizeBookingMode(company?.bookingMode);
  if (fromCompany) return fromCompany;

  const fromPlatform = normalizeBookingMode(
    platformSettings?.defaultBookingMode
  );
  if (fromPlatform) return fromPlatform;

  const cc = String(
    countryCode || company?.country || ""
  )
    .trim()
    .toUpperCase();
  if (cc === "ES") return BOOKING_MODES.MARKETPLACE_REQUEST;

  return BOOKING_MODES.OPS_CALENDAR;
}

export function isMarketplaceRequestMode(mode) {
  return normalizeBookingMode(mode) === BOOKING_MODES.MARKETPLACE_REQUEST;
}

export function isOpsCalendarMode(mode) {
  return normalizeBookingMode(mode) === BOOKING_MODES.OPS_CALENDAR;
}
