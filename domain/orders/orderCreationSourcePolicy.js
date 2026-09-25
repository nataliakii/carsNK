/**
 * THE one answer to "what is this new order, and whose queue does it land in?".
 *
 * Every create path asks this module for `source`, the initial stored status,
 * the booking mode and the offline flag. The browser may ask it too, so the
 * form can label itself honestly, but the browser's answer is advisory: the
 * server calls this with the session it resolved itself and writes only what
 * comes back. A client-declared `source` is never read anywhere.
 *
 * Reused, never duplicated:
 *   source enum      → domain/admin/rovaroContractorAdmin.js
 *   stored statuses  → domain/booking/bookingStatus.js
 *   booking modes    → domain/booking/bookingMode.js
 *
 * The four intents, and why each one exists:
 *
 *   PUBLIC_REQUEST                 No admin session. The public website.
 *   ADMIN_CUSTOMER_REQUEST         An admin submitted the customer booking flow
 *                                  (`my_order`) on a customer's behalf.
 *   SUPERADMIN_REQUEST_FOR_COMPANY Rovaro creates a booking in the admin
 *                                  calendar for a supplier that is not Rovaro.
 *                                  Used to rehome a customer after a decline:
 *                                  it must arrive at the new supplier as an
 *                                  ordinary new request, indistinguishable from
 *                                  one that came through the website.
 *   OWN_COMPANY_RECORD             A company's own calendar record. Rovaro does
 *                                  not mediate it: no fee, no payouts, no
 *                                  platform email, no supplier-confirmation.
 *
 * Pure: no mongoose, no session object, no React.
 */

import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";

export const ORDER_CREATION_INTENT = Object.freeze({
  PUBLIC_REQUEST: "PUBLIC_REQUEST",
  ADMIN_CUSTOMER_REQUEST: "ADMIN_CUSTOMER_REQUEST",
  SUPERADMIN_REQUEST_FOR_COMPANY: "SUPERADMIN_REQUEST_FOR_COMPANY",
  OWN_COMPANY_RECORD: "OWN_COMPANY_RECORD",
});

function normaliseId(value) {
  if (value == null) return "";
  const raw =
    typeof value === "object"
      ? String(value._id ?? value.id ?? value.toString?.() ?? "")
      : String(value);
  const id = raw.trim();
  if (!id || id === "null" || id === "undefined" || id === "[object Object]") {
    return "";
  }
  return id;
}

/**
 * Which company the actor is currently acting as.
 *
 * A superadmin who entered a company through view-as is that company for this
 * purpose, exactly as `bookingCapabilities` already treats them: inside a
 * company they keep the company's powers, not the platform's.
 */
export function resolveCreationActorCompanyId({
  viewAsCompanyId,
  ownerId,
} = {}) {
  return normaliseId(viewAsCompanyId) || normaliseId(ownerId);
}

/**
 * @param {object} input
 * @param {boolean} [input.isAdminSession] an authenticated admin console session
 * @param {boolean} [input.isSuperadminActor] platform superadmin, outside view-as
 * @param {unknown} [input.actorCompanyId] company the actor is acting as
 * @param {unknown} [input.targetCompanyId] company that owns the car
 * @param {unknown} [input.platformCompanyId] Rovaro's own supplier company
 * @param {boolean} [input.requestedMyOrder] legacy customer-flow flag from the payload
 * @param {boolean} [input.requestedOffline] the `Offline (not via website)` checkbox
 * @param {boolean} [input.requestedConfirmed] the payload's confirmed flag
 * @param {string} [input.contextBookingMode] mode resolved for the target company
 * @param {string} [input.contextBookingStatus] initial status for that mode
 * @returns {{
 *   intent: string,
 *   source: string,
 *   myOrder: boolean,
 *   offline: boolean,
 *   confirmed: boolean,
 *   bookingMode: string,
 *   bookingStatus: string|undefined,
 *   customerSelfService: boolean,
 *   trustsClientTotalPrice: boolean,
 *   bookingFeeApplies: boolean,
 *   offlineIgnored: boolean,
 *   onBehalfOfOtherCompany: boolean,
 * }}
 */
export function resolveOrderCreationPolicy({
  isAdminSession = false,
  isSuperadminActor = false,
  actorCompanyId,
  targetCompanyId,
  platformCompanyId,
  requestedMyOrder = false,
  requestedOffline = false,
  requestedConfirmed = false,
  contextBookingMode = BOOKING_MODES.OPS_CALENDAR,
  contextBookingStatus = undefined,
} = {}) {
  const intent = resolveOrderCreationIntent({
    isAdminSession,
    isSuperadminActor,
    actorCompanyId,
    targetCompanyId,
    platformCompanyId,
    requestedMyOrder,
  });

  if (intent === ORDER_CREATION_INTENT.OWN_COMPANY_RECORD) {
    const offline = Boolean(requestedOffline);
    return {
      intent,
      source: BOOKING_SOURCE.INTERNAL,
      myOrder: false,
      offline,
      // An offline record is the company's own history, so it blocks the car
      // the way a confirmed booking does.
      confirmed: Boolean(requestedConfirmed) || offline,
      bookingMode: BOOKING_MODES.OPS_CALENDAR,
      bookingStatus: undefined,
      customerSelfService: false,
      trustsClientTotalPrice: true,
      bookingFeeApplies: false,
      offlineIgnored: false,
      onBehalfOfOtherCompany: false,
    };
  }

  if (intent === ORDER_CREATION_INTENT.SUPERADMIN_REQUEST_FOR_COMPANY) {
    return {
      intent,
      source: BOOKING_SOURCE.PLATFORM,
      // The legacy twin of `source`. A PLATFORM row with `my_order: false`
      // classifies as ambiguous and loses its capabilities, its calendar tone
      // and its place in the supplier's action badge.
      myOrder: true,
      // An offline internal record created on another company's behalf while a
      // Rovaro fee is charged on it is a contradiction, so the checkbox is
      // dropped rather than honoured. The form hides it for this combination.
      offline: false,
      confirmed: false,
      // Rovaro brokered this, so it is a marketplace request whatever the
      // target company's own default is: that is what makes the fee, the
      // financial snapshot and the public reference exist at all.
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      // The admin calendar form posts plain place names, not the customer
      // flow's verified office / delivery selection, so the customer location
      // quote is not asked for here.
      customerSelfService: false,
      // The customer pays a percentage of the stored gross. A hand-typed total
      // that the fee is not calculated from would be charged at the quoted
      // price and invoiced at another.
      trustsClientTotalPrice: false,
      bookingFeeApplies: true,
      offlineIgnored: Boolean(requestedOffline),
      onBehalfOfOtherCompany: true,
    };
  }

  // PUBLIC_REQUEST and ADMIN_CUSTOMER_REQUEST: the customer booking flow.
  // Unchanged — the company/country context keeps deciding the mode, and an
  // admin submitting it for a customer keeps the flags it sends.
  const adminCustomerFlow = intent === ORDER_CREATION_INTENT.ADMIN_CUSTOMER_REQUEST;
  const offline = adminCustomerFlow ? Boolean(requestedOffline) : false;
  return {
    intent,
    source: BOOKING_SOURCE.PLATFORM,
    myOrder: true,
    offline,
    confirmed: adminCustomerFlow
      ? Boolean(requestedConfirmed) || offline
      : false,
    bookingMode: contextBookingMode,
    bookingStatus: contextBookingStatus,
    customerSelfService: true,
    trustsClientTotalPrice: adminCustomerFlow,
    bookingFeeApplies:
      !offline && contextBookingMode === BOOKING_MODES.MARKETPLACE_REQUEST,
    offlineIgnored: !adminCustomerFlow && Boolean(requestedOffline),
    onBehalfOfOtherCompany: false,
  };
}

/**
 * The classification on its own, for callers that only need the name of the
 * case (the form's label, a log line).
 */
export function resolveOrderCreationIntent({
  isAdminSession = false,
  isSuperadminActor = false,
  actorCompanyId,
  targetCompanyId,
  platformCompanyId,
  requestedMyOrder = false,
} = {}) {
  if (!isAdminSession) return ORDER_CREATION_INTENT.PUBLIC_REQUEST;
  if (requestedMyOrder === true) {
    return ORDER_CREATION_INTENT.ADMIN_CUSTOMER_REQUEST;
  }

  const actor = normaliseId(actorCompanyId);
  const target = normaliseId(targetCompanyId);
  const platform = normaliseId(platformCompanyId);

  // Only the platform superadmin can act for somebody else. A company admin
  // reaching another company's car is an ownership failure for the ownership
  // guards to answer, and must never be upgraded into a brokered booking.
  if (!isSuperadminActor) return ORDER_CREATION_INTENT.OWN_COMPANY_RECORD;

  // Rovaro's own fleet. Brokering a car to yourself would charge yourself a
  // Booking Fee and ask yourself to confirm your own request, so Rovaro's
  // calendar rows stay its own internal records.
  if (target && platform && target === platform) {
    return ORDER_CREATION_INTENT.OWN_COMPANY_RECORD;
  }
  if (actor && target && actor === target) {
    return ORDER_CREATION_INTENT.OWN_COMPANY_RECORD;
  }
  // Without a target company there is nobody to send the request to.
  if (!target) return ORDER_CREATION_INTENT.OWN_COMPANY_RECORD;

  return ORDER_CREATION_INTENT.SUPERADMIN_REQUEST_FOR_COMPANY;
}
