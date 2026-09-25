/**
 * The vehicle as it was when the customer asked for it.
 *
 * A Car document is a living record: its price tiers, its photo, even its
 * registration plate change while a booking sits in the calendar. What the
 * customer requested and what the contractor is confirming must not move with
 * it, so the booking-relevant specification is copied once at creation and
 * never rewritten afterwards.
 *
 * Only what a booking needs is copied. Pricing tiers, maintenance notes,
 * office assignments and anything else belonging to fleet administration stay
 * out of it.
 */

/** Car fields the booking depends on, mapped to their booking-facing names. */
const SNAPSHOT_FIELDS = Object.freeze({
  class: "class",
  transmission: "transmission",
  fueltype: "fuelType",
  seats: "seats",
  numberOfDoors: "doors",
  airConditioning: "airConditioning",
  registration: "modelYear",
  carNumber: "fleetCode",
  regNumber: "registrationNumber",
  photoUrl: "image",
  deposit: "deposit",
  franchise: "insuranceExcess",
});

function text(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function id(value) {
  const normalised = text(value?._id ?? value);
  return normalised || null;
}

/**
 * The fleet stores one display string such as "Audi A3". Splitting it gives
 * the header a make to lead with; when there is nothing to split, the whole
 * string stays the model rather than being guessed apart.
 */
export function splitVehicleName(displayName) {
  const name = text(displayName);
  if (!name) return { make: null, model: null };
  const [first, ...rest] = name.split(/\s+/);
  if (!rest.length) return { make: null, model: first };
  return { make: first, model: rest.join(" ") };
}

/**
 * @param {object|null} car a Car document or plain object
 * @param {object} [booking] the order, for the selections made against the car
 * @returns {object|null} a plain, storable snapshot
 */
export function buildVehicleSnapshot(car, booking = {}) {
  if (!car) return null;

  const displayName = text(car.model);
  const { make, model } = splitVehicleName(displayName);

  const snapshot = {
    capturedAt: new Date(),
    carId: id(car._id ?? car.id),
    companyId: id(car.ownerId),
    displayName,
    make,
    model,
  };

  for (const [carField, snapshotField] of Object.entries(SNAPSHOT_FIELDS)) {
    const raw = car[carField];
    if (raw == null || raw === "") continue;
    if (typeof raw === "boolean") {
      snapshot[snapshotField] = raw;
      continue;
    }
    const numeric = finiteNumber(raw);
    snapshot[snapshotField] =
      typeof raw === "number" || numeric != null ? numeric : text(raw);
  }

  // What the customer chose against this vehicle is part of the same
  // contractual picture and moves for the same reason, so it is captured here.
  const selectedInsurance = text(booking.insurance);
  if (selectedInsurance) snapshot.selectedInsurance = selectedInsurance;

  const childSeats = finiteNumber(booking.ChildSeats ?? booking.childSeats);
  const extras = [];
  if (childSeats) extras.push({ code: "CHILD_SEATS", quantity: childSeats });
  if (booking.secondDriver) extras.push({ code: "SECOND_DRIVER", quantity: 1 });
  if (extras.length) snapshot.selectedExtras = extras;

  return snapshot;
}

/**
 * A lean `car` field may still be an ObjectId. Those are objects in JS, but
 * they are not a fleet document and must not be treated as one — otherwise
 * the name-only `carModel` fallback never runs and the modal looks empty.
 */
export function isPopulatedCarDocument(car) {
  if (!car || typeof car !== "object") return false;
  if (car._bsontype === "ObjectId") return false;
  return Boolean(
    text(car.model) ||
      text(car.class) ||
      text(car.transmission) ||
      car.seats != null
  );
}

/**
 * What the booking screens should render as the vehicle.
 *
 * Orders created before snapshots existed have none. Their live car is shown
 * rather than an empty block, but it is flagged as such: presenting today's
 * fleet record as the agreed specification would be a quiet lie.
 *
 * @returns {{ vehicle: object|null, legacy: boolean }}
 */
export function readVehicleSnapshot(order) {
  const stored = order?.vehicleSnapshot;
  if (stored && (stored.displayName || stored.carId)) {
    return { vehicle: stored, legacy: false };
  }

  const car = isPopulatedCarDocument(order?.car) ? order.car : null;
  const fallback = buildVehicleSnapshot(car, order);
  if (fallback?.displayName) return { vehicle: fallback, legacy: true };

  // Not even a populated car: the header still needs the name the order
  // carries, and everything else is honestly absent.
  const displayName = text(order?.carModel);
  if (!displayName) return { vehicle: null, legacy: true };
  const { make, model } = splitVehicleName(displayName);
  return {
    vehicle: {
      displayName,
      make,
      model,
      fleetCode: text(order?.carNumber),
      registrationNumber: text(order?.regNumber),
    },
    legacy: true,
  };
}

/** True when the booking carries its own captured specification. */
export function hasVehicleSnapshot(order) {
  return readVehicleSnapshot(order).legacy === false;
}
