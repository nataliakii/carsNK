/**
 * Reuse a company's rental cars as the transfer fleet.
 * Does not create transfer-vehicle documents.
 */

import { CAR_CLASSES } from "@models/enums";

const CLASS_TO_CATEGORY = Object.freeze({
  [CAR_CLASSES.ECONOMY]: "STANDARD",
  [CAR_CLASSES.COMPACT]: "STANDARD",
  [CAR_CLASSES.COMBI]: "STANDARD",
  [CAR_CLASSES.CROSSOVER]: "COMFORT",
  [CAR_CLASSES.PREMIUM]: "COMFORT",
  [CAR_CLASSES.CONVERTIBLE]: "COMFORT",
  [CAR_CLASSES.LIMOUSINE]: "BUSINESS",
  [CAR_CLASSES.RACE]: "COMFORT",
  [CAR_CLASSES.MINIBUS]: "MINIBUS",
});

function ownerKey(value) {
  if (value == null) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

/**
 * Active rental cars only. Disabled, hidden, deleted, test, or missing cars
 * are never offered for transfers.
 */
export function isEligibleTransferCar(car) {
  if (!car) return false;
  if (car.isActive === false) return false;
  if (car.testingCar === true) return false;
  if (car.isHidden === true) return false;
  if (car.deletedAt) return false;
  if (car.unavailable === true) return false;
  if (car.status && String(car.status).toLowerCase() === "unavailable") {
    return false;
  }
  const seats = Number(car.seats);
  return Number.isFinite(seats) && seats >= 1;
}

export function mapCarClassToTransferCategory(car) {
  const seats = Number(car?.seats) || 0;
  const raw = String(car?.class || "")
    .trim()
    .toLowerCase();
  const mapped = CLASS_TO_CATEGORY[raw];
  if (mapped === "MINIBUS" && seats > 0 && seats <= 7) return "MINIVAN";
  if (mapped) return mapped;
  if (seats >= 8) return "MINIBUS";
  if (seats >= 6) return "MINIVAN";
  return "STANDARD";
}

/**
 * Categories a single car can fulfil. Larger cars may cover smaller classes.
 */
export function transferCategoriesForCar(car) {
  const primary = mapCarClassToTransferCategory(car);
  const seats = Number(car?.seats) || 0;
  const codes = new Set([primary, "STANDARD"]);
  if (primary === "COMFORT" || primary === "BUSINESS" || seats >= 4) {
    codes.add("COMFORT");
  }
  if (primary === "BUSINESS") codes.add("BUSINESS");
  if (seats >= 6 || primary === "MINIVAN" || primary === "MINIBUS") {
    codes.add("MINIVAN");
  }
  if (seats >= 8 || primary === "MINIBUS") codes.add("MINIBUS");
  return [...codes];
}

export function childSeatsFromCar(car) {
  if (!car) return 0;
  if (car.childSeatsAvailable != null && car.childSeatsAvailable !== "") {
    const n = Number(car.childSeatsAvailable);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (car.childSeats != null && typeof car.childSeats !== "object") {
    const n = Number(car.childSeats);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  // PriceChildSeats is a priced extra, not guaranteed inventory.
  return 0;
}

export const CHILD_SEAT_STATUS = Object.freeze({
  NOT_NEEDED: "not_needed",
  INVENTORY: "inventory",
  CONFIRMATION_REQUIRED: "confirmation_required",
  UNAVAILABLE: "unavailable",
});

/**
 * Priced child-seat extras never guarantee stock. Only explicit inventory fields
 * count as available; otherwise confirmation is required at claim time.
 */
export function carChildSeatStatus(car, requestedRaw) {
  const requested = Number(requestedRaw || 0);
  if (!Number.isFinite(requested) || requested <= 0) {
    return { ok: true, status: CHILD_SEAT_STATUS.NOT_NEEDED, available: 0 };
  }
  const available = childSeatsFromCar(car);
  if (available >= requested) {
    return { ok: true, status: CHILD_SEAT_STATUS.INVENTORY, available };
  }
  if (Number(car?.PriceChildSeats) > 0) {
    return {
      ok: true,
      status: CHILD_SEAT_STATUS.CONFIRMATION_REQUIRED,
      available,
    };
  }
  return { ok: false, status: CHILD_SEAT_STATUS.UNAVAILABLE, available };
}

export function fleetChildSeatStatus(cars, transfer) {
  const requested = Number(transfer?.childSeats || 0);
  if (!Number.isFinite(requested) || requested <= 0) {
    return { ok: true, status: CHILD_SEAT_STATUS.NOT_NEEDED, available: 0 };
  }
  const eligible = listEligibleFleetCars(cars);
  let best = {
    ok: false,
    status: CHILD_SEAT_STATUS.UNAVAILABLE,
    available: 0,
  };
  for (const car of eligible) {
    const status = carChildSeatStatus(car, requested);
    if (status.status === CHILD_SEAT_STATUS.INVENTORY) return status;
    if (status.status === CHILD_SEAT_STATUS.CONFIRMATION_REQUIRED) {
      best = status;
    }
  }
  return best;
}

export function listEligibleFleetCars(cars) {
  return (Array.isArray(cars) ? cars : []).filter(isEligibleTransferCar);
}

export function groupCarsByOwner(cars) {
  const map = new Map();
  for (const car of Array.isArray(cars) ? cars : []) {
    const key = ownerKey(car?.ownerId);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(car);
  }
  return map;
}

export function summarizeCarForTransfer(car) {
  return {
    id: car?._id ? String(car._id) : "",
    model: String(car?.model || "").trim(),
    seats: Number(car.seats) || 0,
    category: mapCarClassToTransferCategory(car),
    categories: transferCategoriesForCar(car),
    childSeats: childSeatsFromCar(car),
    isActive: car?.isActive !== false,
  };
}

export function buildFleetCapacity(cars) {
  const eligible = listEligibleFleetCars(cars);
  const categories = new Set();
  let maxPassengers = 0;
  let childSeatsAvailable = 0;
  for (const car of eligible) {
    maxPassengers = Math.max(maxPassengers, Number(car.seats) || 0);
    childSeatsAvailable = Math.max(childSeatsAvailable, childSeatsFromCar(car));
    for (const code of transferCategoriesForCar(car)) categories.add(code);
  }
  return {
    carCount: eligible.length,
    maxPassengers,
    childSeatsAvailable,
    boosterSeatsAvailable: 0,
    vehicleCategories: [...categories],
  };
}

export function carFitsTransferRequest(car, transfer) {
  if (!isEligibleTransferCar(car)) return false;
  const pax = Number(transfer?.passengers || transfer?.adults || 0);
  if (pax > (Number(car.seats) || 0)) return false;
  const category = String(transfer?.vehicleCategory || "STANDARD").toUpperCase();
  if (category && category !== "*") {
    const cats = transferCategoriesForCar(car);
    if (!cats.includes(category)) return false;
  }
  const seats = carChildSeatStatus(car, transfer?.childSeats);
  if (!seats.ok) return false;
  return true;
}

/**
 * True when at least one eligible rental car can fulfil this request.
 * New eligible cars are included automatically because the list is live.
 */
export function anyFleetCarFitsTransfer(cars, transfer) {
  return listEligibleFleetCars(cars).some((car) =>
    carFitsTransferRequest(car, transfer)
  );
}
