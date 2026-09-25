/**
 * What a guaranteed equivalent replacement promises, and which values a
 * supplier may pick when proposing one.
 *
 * The promise is derived from the original booking, never from what the
 * supplier typed: the specification fields are optional, the guarantee is not.
 * The option lists exist so the dialog can only offer values that the rules in
 * `equivalentReplacement.js` would accept — a dropdown of real values instead
 * of a free-text box.
 *
 * Client-safe on purpose: the contractor dialogs import this directly.
 */

import { CAR_CLASSES, TRANSMISSION_TYPES } from "@models/enums";
import { classRank, vehicleClassesAtOrAbove } from "./vehicleClassLadder";

/** A minibus is the largest thing a rental fleet offers. */
export const REPLACEMENT_SEATS_MAX = 9;
export const REPLACEMENT_LUGGAGE_MAX = 8;

/** The classes a vehicle in this system can actually have. */
const FLEET_CLASSES = Object.freeze(Object.values(CAR_CLASSES));

function text(value) {
  return String(value ?? "").trim();
}

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function counted(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function range(from, to) {
  const list = [];
  for (let n = from; n <= to; n += 1) list.push(n);
  return list;
}

/**
 * The original vehicle in one shape, whichever spelling the caller holds: the
 * server reads `category` off the booking while the vehicle snapshot the
 * dialogs render calls the same thing `class`.
 */
export function normalizeOriginalVehicle(original = {}) {
  return {
    class: text(original.class ?? original.category).toLowerCase(),
    transmission: text(original.transmission).toLowerCase(),
    seats: positive(original.seats),
    luggage: counted(original.luggage ?? original.luggageCapacity),
    totalPrice: positive(original.totalPrice ?? original.price),
  };
}

/**
 * The floor the supplier commits to when they type nothing at all. Anything
 * the original booking does not record stays null or empty, so validation
 * fails closed rather than guaranteeing something nobody can check later.
 */
export function replacementGuaranteeFloor(original) {
  const vehicle = normalizeOriginalVehicle(original);
  return {
    classAtLeast: classRank(vehicle.class) == null ? "" : vehicle.class,
    transmission: vehicle.transmission,
    seatsAtLeast: vehicle.seats,
    luggageAtLeast: vehicle.luggage,
    totalPriceAtMost: vehicle.totalPrice,
  };
}

/**
 * True when the original booking records enough to make the promise concrete.
 * Both the dialog and the rules need this answer, and they must agree.
 */
export function canGuaranteeEquivalent(original) {
  const floor = replacementGuaranteeFloor(original);
  return Boolean(floor.classAtLeast) && Boolean(floor.transmission) && floor.seatsAtLeast != null;
}

/** The requested class and every higher class the fleet vocabulary knows. */
export function replacementClassOptions(originalClass) {
  const allowed = vehicleClassesAtOrAbove(originalClass);
  if (!allowed.length) return [];
  const offered = allowed.filter((value) => FLEET_CLASSES.includes(value));
  const requested = text(originalClass).toLowerCase();
  return offered.includes(requested) ? offered : [requested, ...offered];
}

/**
 * An identical transmission is a hard guarantee, so there is exactly one value
 * to offer. A dropdown still beats a text box: nothing else can be submitted.
 */
export function replacementTransmissionOptions(originalTransmission) {
  const requested = text(originalTransmission).toLowerCase();
  return Object.values(TRANSMISSION_TYPES).filter((value) => value === requested);
}

export function replacementSeatOptions(originalSeats) {
  const from = positive(originalSeats);
  if (from == null) return [];
  return range(from, Math.max(from, REPLACEMENT_SEATS_MAX));
}

/**
 * Luggage capacity is not always recorded on the original booking. When it is
 * not, the rules cannot call a number a downgrade, so the whole range is open.
 */
export function replacementLuggageOptions(originalLuggage) {
  const from = counted(originalLuggage) ?? 0;
  return range(from, Math.max(from, REPLACEMENT_LUGGAGE_MAX));
}

/** The `car.value.*` label every class and transmission value already has. */
export function carValueLabelKey(value) {
  const slug = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `car.value.${slug}` : "";
}
