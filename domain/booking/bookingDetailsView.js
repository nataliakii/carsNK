/**
 * Read-only booking details for a PLATFORM order.
 *
 * Money is not calculated here. The line items, the total, the Rovaro share
 * and the supplier's balance all come from
 * `domain/orders/bookingDetailsView.js`, which reads the immutable snapshot.
 * This module turns that into the shape the modal renders, and attaches the
 * i18n key for every user-visible string so nothing ships as English literals.
 */

import { formatSnapshotMoney } from "@/domain/orders/bookingFinancialSnapshot";
import {
  PLATFORM_WORKFLOW_STAGE,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_CAPABILITY,
  capabilitiesForOrder,
} from "@/domain/booking/resolveBookingCapabilities";
import {
  BOOKING_ROLE,
  resolveActorRole,
} from "@/domain/orders/bookingCapabilities";
import { companyMustHideCustomerIdentity } from "@/domain/orders/orderVisibility";
import { readVehicleSnapshot } from "@/domain/orders/vehicleSnapshot";
import { isValidPublicBookingReference } from "@/domain/booking/publicBookingReferenceValidate";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import {
  bookingDisplayReference,
  buildBookingFinancialView,
} from "@/domain/orders/bookingDetailsView";

export const PRIVACY_NOTICE =
  "Customer contact details and driving documents become available after the booking payment is received.";

export const PRIVACY_NOTICE_KEY = "bookingDetails.privacyNotice";

export const PLATFORM_SUPPORT_NOTICE =
  "Platform support access. The supplier cannot see these contact details until the booking payment is received.";

export const PLATFORM_SUPPORT_NOTICE_KEY = "bookingDetails.platformSupportNotice";

export const PLATFORM_FORBIDDEN_CONTROLS = Object.freeze([
  "Edit order",
  "Offline",
  "Update booking data",
  "Delete order",
  "source selector",
]);

const NEW_REQUEST_ACTIONS = [
  "Confirm requested vehicle",
  "Offer equivalent replacement",
  "Decline request",
  "Contact Rovaro",
];

/** i18n key per reconciliation line code. */
const LINE_LABEL_KEYS = Object.freeze({
  RENTAL: "bookingDetails.price.rental",
  INSURANCE: "bookingDetails.price.insurance",
  CHILD_SEATS: "bookingDetails.price.childSeat",
  SECOND_DRIVER: "bookingDetails.price.secondDriver",
  EXTRAS: "bookingDetails.price.extras",
  DISCOUNT: "bookingDetails.price.discount",
  AFTER_HOURS: "bookingDetails.price.afterHours",
  OTHER: "bookingDetails.price.other",
  MANUAL_ADJUSTMENT: "bookingDetails.price.manualAdjustment",
  OFFICE_BOTH: "bookingDetails.price.officeBoth",
  PICKUP_OFFICE: "bookingDetails.price.pickupOffice",
  RETURN_OFFICE: "bookingDetails.price.returnOffice",
  PICKUP_DELIVERY: "bookingDetails.price.pickupDelivery",
  RETURN_DELIVERY: "bookingDetails.price.returnDelivery",
});

function euros(minorUnits, currency) {
  return formatSnapshotMoney(minorUnits, currency || "EUR");
}

/**
 * @returns {{
 *   consistent: boolean,
 *   currency: string,
 *   lines: { key: string, labelKey: string, label: string, minor: number, text: string }[],
 *   totalMinor: number|null,
 *   totalText: string|null,
 *   paidToRovaroText: string|null,
 *   payableToSupplierText: string|null,
 *   headlineMinor: number|null,
 * }}
 */
export function buildBookingPriceSummary(order, opts = {}) {
  const financial = buildBookingFinancialView(order, opts);
  const currency = financial.currency;
  const consistent = financial.invariantOk;

  const lines = financial.lineItems
    .filter((row) => row.minor !== 0 || row.free)
    .map((row, index) => ({
      key: `${row.code}-${index}`,
      code: row.code,
      labelKey: LINE_LABEL_KEYS[row.code] || LINE_LABEL_KEYS.OTHER,
      label: row.fallbackLabel,
      minor: row.minor,
      free: row.free,
      text: euros(row.minor, currency),
    }));

  const totalMinor = consistent ? financial.totalRentalPriceMinor : null;

  return {
    consistent,
    currency,
    lines,
    lineSum: financial.lineItemsMinor,
    storedGross: financial.totalRentalPriceMinor,
    headlineMinor: financial.contradictingStoredTotalMinor,
    totalMinor,
    totalText: totalMinor != null ? euros(totalMinor, currency) : null,
    paidToRovaroText: financial.splitRenderable
      ? euros(financial.paidToRovaroMinor, currency)
      : null,
    payableToSupplierText: financial.splitRenderable
      ? euros(financial.payableToSupplierMinor, currency)
      : null,
    payableToSupplierMinor: financial.splitRenderable
      ? financial.payableToSupplierMinor
      : null,
    /** Per company, read from the order's own snapshot. Never assumed. */
    feePercentLabel: financial.feePercentLabel,
    invariant: financial.invariant,
    dataWarning: !consistent,
  };
}

export function buildBookingDetailsView(order, user, opts = {}) {
  const stage = resolvePlatformWorkflowStage(order);
  const caps = capabilitiesForOrder(order, user, opts);
  const price = buildBookingPriceSummary(order, opts);
  const { vehicle, legacy } = readVehicleSnapshot(order);
  const showContacts = caps.has(BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS);
  const showLicence = caps.has(BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS);
  // A superadmin reading a booking the supplier cannot yet see is looking at
  // the same screen the supplier gets, so the screen has to say whose eyes
  // these contacts are open to. Otherwise platform-support access is
  // indistinguishable from a leak.
  const platformSupportView =
    resolveActorRole(user) === BOOKING_ROLE.SUPERADMIN &&
    showContacts &&
    companyMustHideCustomerIdentity(order);
  const actions = [];

  if (caps.has(BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE)) {
    actions.push({
      id: "confirm",
      label: "Confirm requested vehicle",
      labelKey: "bookingDetails.actions.confirm",
      primary: true,
    });
  }
  if (caps.has(BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT)) {
    actions.push({
      id: "replace",
      label: "Offer equivalent replacement",
      labelKey: "bookingDetails.actions.replace",
      primary: true,
    });
  }
  if (caps.has(BOOKING_CAPABILITY.DECLINE_REQUEST)) {
    actions.push({
      id: "decline",
      label: "Decline request",
      labelKey: "bookingDetails.actions.decline",
      primary: true,
    });
  }
  // CONTACT_CUSTOMER is not an action. It is the permission to see and copy
  // the customer's contacts, and it is read as `canContactCustomer` below. A
  // button that opened a dialog to restate values already on screen was only
  // an extra click.
  if (caps.has(BOOKING_CAPABILITY.CONTACT_ROVARO)) {
    actions.push({
      id: "contactRovaro",
      label: "Contact Rovaro",
      labelKey: "bookingDetails.actions.contactRovaro",
    });
  }
  if (caps.has(BOOKING_CAPABILITY.REPORT_PROBLEM)) {
    actions.push({
      id: "reportProblem",
      label: "Report a problem",
      labelKey: "bookingDetails.actions.reportProblem",
    });
  }
  if (caps.has(BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING) && !price.dataWarning) {
    actions.push({
      id: "amend",
      label: "Edit booking",
      labelKey: "bookingDetails.actions.amend",
    });
  }

  const statusCopy = statusCopyFor(stage, price.feePercentLabel);

  return {
    title: "Booking details",
    titleKey: "bookingDetails.title",
    reference: bookingDisplayReference(order) || "Booking",
    stage,
    statusTitle: statusCopy.title,
    statusTitleKey: statusCopy.titleKey,
    statusDetail: statusCopy.detail,
    statusDetailKey: statusCopy.detailKey,
    statusDetailValues: statusCopy.values,
    showPrivacyNotice: !showContacts,
    privacyNotice: PRIVACY_NOTICE,
    privacyNoticeKey: PRIVACY_NOTICE_KEY,
    showContacts,
    // Whether the phone and email may be reached and copied, as opposed to
    // merely appearing. Kept separate so the permission model stays intact
    // even though the button it used to drive is gone.
    canContactCustomer: caps.has(BOOKING_CAPABILITY.CONTACT_CUSTOMER),
    platformSupportView,
    platformSupportNotice: PLATFORM_SUPPORT_NOTICE,
    platformSupportNoticeKey: PLATFORM_SUPPORT_NOTICE_KEY,
    showLicence,
    customer: showContacts
      ? {
          name: order?.customerName || "",
          phone: order?.phone || "",
          email: order?.email || "",
          viber: Boolean(order?.Viber),
          whatsapp: Boolean(order?.Whatsapp),
          telegram: Boolean(order?.Telegram),
          notes: order?.customerNotes || order?.notes || "",
        }
      : null,
    licence: showLicence
      ? {
          holderName: order?.drivingLicenceSnapshot?.holderName || "",
          licenceNumber: order?.drivingLicenceSnapshot?.licenceNumber || "",
          issuingCountry: order?.drivingLicenceSnapshot?.issuingCountry || "",
          expiryDate: order?.drivingLicenceSnapshot?.expiryDate || "",
        }
      : null,
    header: buildHeader(order, statusCopy, vehicle),
    vehicle,
    vehicleIsLegacy: legacy,
    // The plate and fleet code point at one physical car in one company's
    // yard. Reading the booking does not entitle anyone to that.
    // VIEW_BOOKING is only granted to the owning company or the superadmin,
    // so it is already the right question to ask.
    showFleetIdentity: caps.has(BOOKING_CAPABILITY.VIEW_BOOKING),
    price,
    moneyActionsDisabled: price.dataWarning === true,
    actions,
    forbiddenControls: PLATFORM_FORBIDDEN_CONTROLS,
    editable: false,
    originallyRequested: order?.originalRequestSnapshot || null,
    replacement:
      stage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE
        ? order?.replacementOffer || order?.acceptedAlternative || null
        : null,
  };
}

/**
 * What the contractor needs before reading anything else: which car, under
 * which reference, for whom, when and where — and the state it is in.
 *
 * The status appears once, as a badge. Repeating it as a title, a subtitle and
 * a sentence is what left the old header both empty and redundant.
 */
function buildHeader(order, statusCopy, vehicle) {
  const platform = isPlatformBooking(order);
  const badges = [
    {
      id: "status",
      tone: "status",
      label: statusCopy.title,
      labelKey: statusCopy.titleKey,
    },
    {
      id: "source",
      tone: platform ? "platform" : "internal",
      label: platform ? "Rovaro booking" : "Internal",
      labelKey: platform
        ? "bookingDetails.header.sourcePlatform"
        : "bookingDetails.header.sourceInternal",
    },
  ];

  // A payment badge that is always present says nothing. It appears only while
  // the payment is the thing standing between the booking and being done —
  // never alongside "Confirmed and paid".
  const paymentBadge = paymentBadgeFor(order, platform);
  if (paymentBadge) badges.push(paymentBadge);

  const city =
    String(order?.placeIn || "").trim() ||
    String(order?.placeOut || "").trim() ||
    null;

  return {
    make: vehicle?.make || null,
    model: vehicle?.model || null,
    vehicleName: vehicle?.displayName || null,
    reference: publicHeaderReference(order),
    companyName: String(order?.companyName || order?.ownerName || "").trim() || null,
    pickupAt: order?.pickupAtUtc || order?.timeIn || null,
    returnAt: order?.returnAtUtc || order?.timeOut || null,
    rentalDays: Number.isFinite(Number(order?.numberOfDays))
      ? Number(order.numberOfDays)
      : null,
    city,
    badges,
  };
}

/**
 * The reference a person can quote back to us.
 *
 * `bookingDisplayReference` falls back to the database id so a row always has
 * something to show; a heading is not the place for that. An order with no
 * public reference yet simply leads with the vehicle.
 */
function publicHeaderReference(order) {
  if (isValidPublicBookingReference(order?.publicReference)) {
    return order.publicReference;
  }
  return String(order?.orderNumber ?? "").trim() || null;
}

function paymentBadgeFor(order, platform) {
  if (!platform) return null;
  const stage = resolvePlatformWorkflowStage(order);
  if (stage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT) {
    return {
      id: "payment",
      tone: "pending",
      label: "Awaiting customer payment",
      labelKey: "bookingDetails.header.awaitingPayment",
    };
  }
  // BOOKING_CONFIRMED / COMPLETION_PENDING already use status "Confirmed and paid".
  return null;
}

/**
 * Stage copy. The booking-payment rate is interpolated from the order's own
 * resolved rate, because it is negotiated per company and is not always 10%.
 */
function statusCopyFor(stage, ratePercentLabel) {
  const rate = String(ratePercentLabel || "").trim();
  if (stage === PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION) {
    return {
      title: "New request",
      titleKey: "bookingDetails.status.newRequest.title",
      detail: "Waiting for your confirmation.",
      detailKey: "bookingDetails.status.newRequest.detail",
    };
  }
  if (stage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT) {
    return {
      title: "Vehicle confirmed",
      titleKey: "bookingDetails.status.awaitingPayment.title",
      detail: rate
        ? `Waiting for the customer to pay the ${rate}% booking payment.`
        : "Waiting for the customer to pay the booking payment.",
      detailKey: rate
        ? "bookingDetails.status.awaitingPayment.detail"
        : "bookingDetails.status.awaitingPayment.detailNoRate",
      values: { rate },
    };
  }
  if (stage === PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE) {
    return {
      title: "Replacement offered",
      titleKey: "bookingDetails.status.replacementOffered.title",
      detail: "Waiting for the customer to accept this replacement.",
      detailKey: "bookingDetails.status.replacementOffered.detail",
    };
  }
  if (
    stage === PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED ||
    stage === PLATFORM_WORKFLOW_STAGE.COMPLETION_PENDING
  ) {
    return {
      title: "Confirmed and paid",
      titleKey: "bookingDetails.status.confirmedPaid.title",
      detail: "The customer has paid the Rovaro booking payment.",
      detailKey: "bookingDetails.status.confirmedPaid.detail",
    };
  }
  if (stage === PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED) {
    return {
      title: "Declined",
      titleKey: "bookingDetails.status.declined.title",
      detail: "",
      detailKey: "",
    };
  }
  return {
    title: stage || "Booking",
    titleKey: "bookingDetails.status.generic.title",
    detail: "",
    detailKey: "",
  };
}

export function newRequestActionLabels(view) {
  return (view?.actions || []).map((action) => action.label);
}

export { NEW_REQUEST_ACTIONS };
