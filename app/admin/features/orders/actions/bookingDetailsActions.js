/**
 * Every server call the Booking Details modal makes.
 *
 * The modal itself never calls `fetch`. Each action reuses an endpoint that
 * already exists and already enforces the capability resolver, and returns a
 * normalised `{ ok, message }` result.
 */

import { SUPPLIER_RESPONSE_PAYLOAD } from "@/domain/orders/supplierResponseStatus";

import { updateOrder, updateOrderSupplierResponse } from "@utils/action";

import {
  askRovaroAboutBooking,
  loadAlternativeCars,
  offerEquivalentReplacement,
  suggestAlternativeVehicle,
} from "./supplierBookingActions";
import { reportPlatformBookingProblem } from "./bookingCompletionActions";

export { loadAdminOrder } from "./loadAdminOrder";
export { loadSignedDrivingLicence } from "./drivingLicenceDocuments";

/** Replacement kinds accepted by the equivalent-replacement rules. */
export const REPLACEMENT_KIND = Object.freeze({
  COMPANY_VEHICLE: "COMPANY_VEHICLE",
  EXTERNAL_VEHICLE: "EXTERNAL_VEHICLE",
  GUARANTEED_CLASS: "GUARANTEED_CLASS",
});

/** Who asked for a superadmin amendment. */
export const AMENDMENT_REQUESTER = Object.freeze({
  CUSTOMER: "CUSTOMER",
  SUPPLIER: "SUPPLIER",
  ROVARO: "ROVARO",
});

/** Issue categories offered by the Contact Rovaro dialog. */
export const SUPPORT_CATEGORY = Object.freeze({
  BOOKING_DETAILS: "BOOKING_DETAILS",
  VEHICLE: "VEHICLE",
  DATES: "DATES",
  PRICE: "PRICE",
  CUSTOMER: "CUSTOMER",
  OTHER: "OTHER",
});

export const SUPPORT_CATEGORIES = Object.freeze(Object.values(SUPPORT_CATEGORY));

/**
 * The supplier commits to the requested vehicle. Idempotent server-side: a
 * repeated call returns the same state rather than a second confirmation.
 */
export async function confirmRequestedVehicle(orderId) {
  const result = await updateOrderSupplierResponse(orderId, {
    response: SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED,
  });
  return {
    ok: result?.success === true,
    idempotent: result?.idempotent === true,
    message: result?.message || "",
    data: result?.data || null,
  };
}

export async function declineBookingRequest(orderId, reason) {
  const result = await updateOrderSupplierResponse(orderId, {
    response: SUPPLIER_RESPONSE_PAYLOAD.DECLINED,
    reason,
  });
  return {
    ok: result?.success === true,
    message: result?.message || "",
    data: result?.data || null,
  };
}

/**
 * A structured replacement proposal. The original vehicle field is never
 * mutated; the server stores this as an immutable snapshot the customer then
 * accepts by paying.
 */
/** Fleet cars the supplier may offer for this booking (scoped to the order's company). */
export async function loadReplacementFleetCars(orderId) {
  return loadAlternativeCars(orderId);
}

export async function proposeEquivalentReplacement(orderId, proposal) {
  const source = proposal.replacementSource;
  if (source === REPLACEMENT_KIND.COMPANY_VEHICLE) {
    const carId = String(proposal.proposedCarId || "").trim();
    if (!carId) {
      return { ok: false, message: "Choose a vehicle from your fleet." };
    }
    const result = await suggestAlternativeVehicle(
      orderId,
      carId,
      proposal.supplierMessage
    );
    return { ok: result?.ok === true, message: result?.message || "" };
  }

  const result = await offerEquivalentReplacement(orderId, {
    replacementSource: source,
    model: proposal.model,
    category: proposal.category,
    transmission: proposal.transmission,
    seats: Number(proposal.seats) || 0,
    luggage: proposal.luggage === "" ? null : Number(proposal.luggage),
    totalPrice: Number(proposal.totalPrice),
    supplierMessage: proposal.supplierMessage,
  });
  return { ok: result?.ok === true, message: result?.message || "" };
}

/**
 * Superadmin exception handling. The route re-validates the reason, the
 * requester and the paid-terms rule; this only carries them.
 */
export async function amendPlatformBooking(orderId, { changes, reason, requestedBy, consent }) {
  const result = await updateOrder(orderId, {
    ...changes,
    amendmentReason: reason,
    amendmentRequestedBy: requestedBy,
    customerConsentRecorded: consent?.recorded === true,
    customerConsentNote: consent?.note || "",
  });
  return {
    ok: result?.success === true,
    message: result?.message || "",
    data: result?.updatedOrder || null,
  };
}

/**
 * Opens a platform support task against the booking. It never mutates the
 * booking itself.
 */
export async function contactRovaroAboutBooking(orderId, { category, message }) {
  const label = String(category || SUPPORT_CATEGORY.OTHER).trim();
  const body = String(message || "").trim();
  const result = await askRovaroAboutBooking(orderId, `[${label}] ${body}`);
  return { ok: result?.ok === true, message: result?.message || "" };
}

/**
 * Urgent post-payment problem. Preserves the confirmed booking snapshot and
 * alerts the superadmin; it does not cancel or refund anything.
 */
export async function reportBookingProblem(orderId, { message } = {}) {
  const flagged = await reportPlatformBookingProblem(orderId);
  if (!flagged.ok) return { ok: false, message: flagged.message || "" };
  const note = String(message || "").trim();
  if (note) {
    await contactRovaroAboutBooking(orderId, {
      category: SUPPORT_CATEGORY.OTHER,
      message: note,
    });
  }
  return { ok: true, message: "" };
}
