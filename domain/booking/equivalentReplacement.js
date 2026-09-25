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

  const originalClass = classRank(original?.category || original?.class);
  const nextClass = classRank(proposal?.category || proposal?.class);
  if (originalClass == null || nextClass == null || nextClass < originalClass) {
    return fail("category_downgrade", "The replacement class must be the same or higher.");
  }

  const originalTransmission = text(original?.transmission).toLowerCase();
  const nextTransmission = text(proposal?.transmission).toLowerCase();
  if (!originalTransmission || !nextTransmission || originalTransmission !== nextTransmission) {
    return fail("transmission_mismatch", "The replacement must have the same transmission.");
  }

  const originalSeats = Number(original?.seats);
  const nextSeats = Number(proposal?.seats);
  if (!Number.isFinite(originalSeats) || !Number.isFinite(nextSeats) || nextSeats < originalSeats) {
    return fail("seats_downgrade", "The replacement must have at least as many seats.");
  }

  const originalLuggage = Number(original?.luggage);
  const nextLuggage = Number(proposal?.luggage);
  if (
    Number.isFinite(originalLuggage) &&
    Number.isFinite(nextLuggage) &&
    nextLuggage < originalLuggage
  ) {
    return fail("luggage_downgrade", "Luggage capacity must not be lower when it is known.");
  }

  const originalPrice = money(original?.totalPrice ?? original?.price);
  const nextPrice = money(proposal?.totalPrice ?? proposal?.price);
  if (originalPrice == null || nextPrice == null || nextPrice > originalPrice) {
    return fail("price_increase", "The total rental price must not exceed the price already shown.");
  }

  if (
    proposal?.rentalStartDate &&
    !sameTime(proposal.rentalStartDate, original?.rentalStartDate)
  ) {
    return fail("dates_changed", "Pickup and return dates must stay the same.");
  }
  if (proposal?.rentalEndDate && !sameTime(proposal.rentalEndDate, original?.rentalEndDate)) {
    return fail("dates_changed", "Pickup and return dates must stay the same.");
  }
  if (proposal?.placeIn && text(proposal.placeIn) !== text(original?.placeIn)) {
    return fail("location_changed", "Pickup and return locations must stay the same.");
  }
  if (proposal?.placeOut && text(proposal.placeOut) !== text(original?.placeOut)) {
    return fail("location_changed", "Pickup and return locations must stay the same.");
  }

  const snapshot = buildReplacementProposalSnapshot({ original, proposal, source });
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
