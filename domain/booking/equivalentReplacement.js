/**
 * Pre-payment equivalent replacement. This is not the later-breakdown rule.
 * Offering a replacement does not confirm the booking and does not charge
 * the Booking Fee.
 */

import crypto from "crypto";
import { classRank } from "@/domain/booking/alternativeOfferCore";
import { REPLACEMENT_SOURCE } from "@/domain/booking/equivalentReplacementCopy";

export {
  equivalentReplacementDisclosure,
  equivalentReplacementPayCta,
  replacementMayChargeBookingFee,
  replacementAcceptanceOnVerifiedPayment,
  REPLACEMENT_SOURCE,
} from "@/domain/booking/equivalentReplacementCopy";

function text(value) {
  return String(value ?? "").trim();
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sameTime(left, right) {
  if (!left && !right) return true;
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return text(left) === text(right);
  return a === b;
}

function fail(code, message) {
  return { ok: false, code, message };
}

/**
 * Hard guarantees for a replacement known before payment.
 * Dates and pickup/return are copied from the booking; a different proposal is rejected.
 *
 * GUARANTEED_CLASS: supplier only acknowledges same/higher class, same
 * transmission, same/lower price. Specs are taken from the original booking
 * unless the proposal overrides them.
 */
export function evaluateEquivalentReplacement({ original, proposal } = {}) {
  const source = text(proposal?.replacementSource);
  if (
    source !== REPLACEMENT_SOURCE.COMPANY_VEHICLE &&
    source !== REPLACEMENT_SOURCE.EXTERNAL_VEHICLE &&
    source !== REPLACEMENT_SOURCE.GUARANTEED_CLASS
  ) {
    return fail("replacement_source", "Choose a company vehicle, an unlisted vehicle, or a guaranteed class.");
  }
  if (proposal?.surcharge != null || proposal?.hiddenSurcharge != null || proposal?.extraFee != null) {
    return fail("hidden_surcharge", "A replacement cannot add a surcharge.");
  }

  let effective = proposal || {};
  if (source === REPLACEMENT_SOURCE.GUARANTEED_CLASS) {
    if (proposal?.guaranteeAck !== true) {
      return fail(
        "guarantee_ack_required",
        "Confirm that the replacement keeps the same class, transmission and price ceiling."
      );
    }
    effective = {
      ...proposal,
      category:
        text(proposal?.category || proposal?.class) ||
        text(original?.category || original?.class),
      class:
        text(proposal?.class || proposal?.category) ||
        text(original?.class || original?.category),
      transmission:
        text(proposal?.transmission) || text(original?.transmission),
      seats:
        proposal?.seats != null && proposal?.seats !== ""
          ? proposal.seats
          : original?.seats,
      luggage:
        proposal?.luggage != null && proposal?.luggage !== ""
          ? proposal.luggage
          : original?.luggage,
      totalPrice:
        proposal?.totalPrice != null && proposal?.totalPrice !== ""
          ? proposal.totalPrice
          : original?.totalPrice ?? original?.price,
      model:
        text(proposal?.model) || "Guaranteed same or higher class",
    };
  }

  const originalClass = classRank(original?.category || original?.class);
  const nextClass = classRank(effective?.category || effective?.class);
  if (originalClass == null || nextClass == null || nextClass < originalClass) {
    return fail("category_downgrade", "The replacement class must be the same or higher.");
  }

  const originalTransmission = text(original?.transmission).toLowerCase();
  const nextTransmission = text(effective?.transmission).toLowerCase();
  if (!originalTransmission || !nextTransmission || originalTransmission !== nextTransmission) {
    return fail("transmission_mismatch", "The replacement must have the same transmission.");
  }

  const originalSeats = Number(original?.seats);
  const nextSeats = Number(effective?.seats);
  if (!Number.isFinite(originalSeats) || !Number.isFinite(nextSeats) || nextSeats < originalSeats) {
    return fail("seats_downgrade", "The replacement must have at least as many seats.");
  }

  const originalLuggage = Number(original?.luggage);
  const nextLuggage = Number(effective?.luggage);
  if (
    Number.isFinite(originalLuggage) &&
    Number.isFinite(nextLuggage) &&
    nextLuggage < originalLuggage
  ) {
    return fail("luggage_downgrade", "Luggage capacity must not be lower when it is known.");
  }

  const originalPrice = money(original?.totalPrice ?? original?.price);
  const nextPrice = money(effective?.totalPrice ?? effective?.price);
  if (originalPrice == null || nextPrice == null || nextPrice > originalPrice) {
    return fail("price_increase", "The total rental price must not exceed the price already shown.");
  }

  if (
    effective?.rentalStartDate &&
    !sameTime(effective.rentalStartDate, original?.rentalStartDate)
  ) {
    return fail("dates_changed", "Pickup and return dates must stay the same.");
  }
  if (effective?.rentalEndDate && !sameTime(effective.rentalEndDate, original?.rentalEndDate)) {
    return fail("dates_changed", "Pickup and return dates must stay the same.");
  }
  if (effective?.placeIn && text(effective.placeIn) !== text(original?.placeIn)) {
    return fail("location_changed", "Pickup and return locations must stay the same.");
  }
  if (effective?.placeOut && text(effective.placeOut) !== text(original?.placeOut)) {
    return fail("location_changed", "Pickup and return locations must stay the same.");
  }

  const snapshot = buildReplacementProposalSnapshot({
    original,
    proposal: effective,
    source,
  });
  return { ok: true, snapshot };
}

export function buildReplacementProposalSnapshot({ original, proposal, source, createdBy, now = new Date() }) {
  const body = {
    version: 1,
    replacementSource: source,
    originalVehicle: {
      vehicleId: text(original?.vehicleId || original?.carId),
      make: text(original?.make),
      model: text(original?.model || original?.carModel),
      class: text(original?.category || original?.class),
      transmission: text(original?.transmission).toLowerCase(),
      seats: Number(original?.seats),
      luggage: Number.isFinite(Number(original?.luggage)) ? Number(original.luggage) : null,
      fuel: text(original?.fuel),
    },
    replacement: {
      vehicleId: text(proposal?.vehicleId || proposal?.proposedCarId),
      make: text(proposal?.make),
      model:
        source === REPLACEMENT_SOURCE.GUARANTEED_CLASS
          ? text(proposal?.model) || "Guaranteed same or higher class"
          : text(proposal?.model),
      class: text(proposal?.category || proposal?.class).toLowerCase(),
      transmission: text(proposal?.transmission).toLowerCase(),
      seats: Number(proposal?.seats),
      luggage: Number.isFinite(Number(proposal?.luggage)) ? Number(proposal.luggage) : null,
      fuel: text(proposal?.fuel),
    },
    totalPrice: money(proposal?.totalPrice ?? proposal?.price),
    pickup: text(original?.placeIn),
    return: text(original?.placeOut),
    rentalStartDate: original?.rentalStartDate || null,
    rentalEndDate: original?.rentalEndDate || null,
    supplierMessage: text(proposal?.supplierMessage || proposal?.reason),
    createdAt: new Date(now).toISOString(),
    createdBy: text(createdBy),
  };
  const checksum = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  return { ...body, checksum };
}
