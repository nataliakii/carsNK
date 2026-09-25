/**
 * Pre-payment equivalent replacement. This is not the later-breakdown rule.
 * Offering a replacement does not confirm the booking and does not charge
 * the Booking Fee.
 *
 * The specification fields are optional; the guarantees are not. Anything the
 * supplier leaves blank on the guaranteed path is taken from the original
 * booking, so an empty form still promises the customer a concrete vehicle:
 * same or higher class, identical transmission, no fewer seats, no less
 * luggage where it is known, and never a higher price. A value the original
 * booking does not record cannot be guaranteed and is rejected, not guessed.
 */

import crypto from "crypto";
import { classRank } from "@/domain/booking/vehicleClassLadder";
import {
  GUARANTEED_EQUIVALENT_MODEL,
  REPLACEMENT_SOURCE,
  resolveReplacementSource,
} from "@/domain/booking/equivalentReplacementCopy";
import { replacementGuaranteeFloor } from "@/domain/booking/replacementGuarantee";

export {
  equivalentReplacementDisclosure,
  equivalentReplacementPayCta,
  replacementMayChargeBookingFee,
  replacementAcceptanceOnVerifiedPayment,
  resolveReplacementSource,
  GUARANTEED_EQUIVALENT_MODEL,
  REPLACEMENT_SOURCE,
  REPLACEMENT_SOURCES,
} from "@/domain/booking/equivalentReplacementCopy";

/** Bumped when the stored proposal body changes shape. */
export const REPLACEMENT_PROPOSAL_VERSION = 2;

function text(value) {
  return String(value ?? "").trim();
}

/** A price of zero or less is not a cheaper rental, it is a missing figure. */
function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** An unset optional field, as opposed to a deliberate value. */
function blank(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function count(value) {
  if (blank(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function seatCount(value) {
  const n = count(value);
  return n != null && n > 0 ? n : null;
}

/** NaN rather than 0 for an absent number, so a missing value cannot pass. */
function numberOrNaN(value) {
  return value == null ? Number.NaN : Number(value);
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
  const source = resolveReplacementSource(proposal?.replacementSource);
  if (!source) {
    return fail(
      "replacement_source",
      "Choose a vehicle from your fleet or a guaranteed equivalent."
    );
  }
  if (proposal?.surcharge != null || proposal?.hiddenSurcharge != null || proposal?.extraFee != null) {
    return fail("hidden_surcharge", "A replacement cannot add a surcharge.");
  }

  // Only the guaranteed path may leave a specification unstated: it is
  // promising the original's own specification rather than describing a car.
  const guaranteed = source === REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT;
  const floor = replacementGuaranteeFloor(original);
  const derivedFromOriginal = [];
  const derive = (field, typed, fallback) => {
    if (!blank(typed)) return typed;
    if (!guaranteed || fallback == null || fallback === "") return null;
    derivedFromOriginal.push(field);
    return fallback;
  };

  const nextClassText = derive(
    "class",
    text(proposal?.category || proposal?.class).toLowerCase() || null,
    floor.classAtLeast
  );
  const originalClass = classRank(original?.category || original?.class);
  const nextClass = classRank(nextClassText);
  if (originalClass == null || nextClass == null || nextClass < originalClass) {
    return fail("category_downgrade", "The replacement class must be the same or higher.");
  }

  const originalTransmission = text(original?.transmission).toLowerCase();
  const nextTransmission = derive(
    "transmission",
    text(proposal?.transmission).toLowerCase() || null,
    floor.transmission
  );
  if (!originalTransmission || !nextTransmission || originalTransmission !== nextTransmission) {
    return fail("transmission_mismatch", "The replacement must have the same transmission.");
  }

  const originalSeats = Number(original?.seats);
  const nextSeats = numberOrNaN(
    derive("seats", seatCount(proposal?.seats), floor.seatsAtLeast)
  );
  if (!Number.isFinite(originalSeats) || !Number.isFinite(nextSeats) || nextSeats < originalSeats) {
    return fail("seats_downgrade", "The replacement must have at least as many seats.");
  }

  const originalLuggage = Number(original?.luggage);
  const nextLuggage = numberOrNaN(
    derive("luggage", count(proposal?.luggage), floor.luggageAtLeast)
  );
  if (
    Number.isFinite(originalLuggage) &&
    Number.isFinite(nextLuggage) &&
    nextLuggage < originalLuggage
  ) {
    return fail("luggage_downgrade", "Luggage capacity must not be lower when it is known.");
  }

  const originalPrice = money(original?.totalPrice ?? original?.price);
  const nextPrice = money(
    derive("totalPrice", money(proposal?.totalPrice ?? proposal?.price), floor.totalPriceAtMost)
  );
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

  const snapshot = buildReplacementProposalSnapshot({
    original,
    proposal,
    source,
    resolved: {
      class: nextClassText,
      transmission: nextTransmission,
      seats: nextSeats,
      luggage: Number.isFinite(nextLuggage) ? nextLuggage : null,
      totalPrice: nextPrice,
    },
    derivedFromOriginal,
  });
  return { ok: true, snapshot, derivedFromOriginal: snapshot.derivedFromOriginal };
}

export function buildReplacementProposalSnapshot({
  original,
  proposal,
  source,
  resolved,
  derivedFromOriginal = [],
  createdBy,
  now = new Date(),
}) {
  const floor = replacementGuaranteeFloor(original);
  const spec = resolved || {
    class: text(proposal?.category || proposal?.class).toLowerCase(),
    transmission: text(proposal?.transmission).toLowerCase(),
    seats: Number(proposal?.seats),
    luggage: count(proposal?.luggage),
    totalPrice: money(proposal?.totalPrice ?? proposal?.price),
  };
  const body = {
    version: REPLACEMENT_PROPOSAL_VERSION,
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
        source === REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT
          ? text(proposal?.model) || GUARANTEED_EQUIVALENT_MODEL
          : text(proposal?.model),
      class: text(spec.class).toLowerCase(),
      transmission: text(spec.transmission).toLowerCase(),
      seats: Number(spec.seats),
      luggage: Number.isFinite(Number(spec.luggage)) ? Number(spec.luggage) : null,
      fuel: text(proposal?.fuel),
    },
    // The promise itself, read off the original booking rather than off the
    // form, so it survives a supplier who filled nothing in.
    guarantees: {
      classAtLeast: floor.classAtLeast,
      transmission: floor.transmission,
      seatsAtLeast: floor.seatsAtLeast,
      luggageAtLeast: floor.luggageAtLeast,
      totalPriceAtMost: floor.totalPriceAtMost,
      datesUnchanged: true,
      locationsUnchanged: true,
      noSurcharge: true,
    },
    /** Which fields the supplier left to the guarantee instead of stating. */
    derivedFromOriginal: [...new Set(derivedFromOriginal)].sort(),
    totalPrice: money(spec.totalPrice),
    pickup: text(original?.placeIn),
    return: text(original?.placeOut),
    rentalStartDate: original?.rentalStartDate || null,
    rentalEndDate: original?.rentalEndDate || null,
    supplierMessage: text(proposal?.supplierMessage || proposal?.reason),
    createdAt: new Date(now).toISOString(),
    createdBy: text(createdBy),
  };
  const checksum = replacementProposalChecksum(body);
  return { ...body, checksum };
}

export function replacementProposalChecksum(body) {
  const { checksum, ...rest } = body || {};
  return crypto.createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}

/**
 * The customer accepts one exact version of one exact proposal, so the stored
 * body has to still hash to the checksum the acceptance refers to.
 */
export function verifyReplacementProposalSnapshot(snapshot, { expectedChecksum } = {}) {
  const mismatch = fail(
    "snapshot_mismatch",
    "This replacement proposal no longer matches its stored snapshot."
  );
  // Every proposal is written with its checksum, so a body without one has
  // been altered since it was written. It is refused, not re-checksummed.
  const stored = text(snapshot?.checksum);
  if (!stored) return mismatch;
  if (replacementProposalChecksum(snapshot) !== stored) return mismatch;
  const expected = text(expectedChecksum);
  if (expected && expected !== stored) return mismatch;
  return { ok: true, checksum: stored };
}
