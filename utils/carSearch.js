/**
 * Client-side catalog search: match query against car model and detail fields.
 */

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Build a searchable text blob for a car (model + specs).
 * @param {object} car
 * @returns {string}
 */
export function buildCarSearchText(car) {
  if (!car || typeof car !== "object") return "";

  const parts = [
    car.model,
    car.carNumber,
    car.slug,
    car.class,
    car.transmission,
    car.fueltype,
    car.color,
    car.regNumber,
    car.engine,
    car.registration,
    car.seats,
    car.numberOfDoors,
    car.enginePower,
    car.deposit,
    car.franchise,
    car.PriceChildSeats,
    car.PriceKacko,
  ];

  if (car.airConditioning === true) {
    parts.push("ac", "a/c", "air conditioning", "airconditioning", "климат");
  }
  if (car.airConditioning === false) {
    parts.push("no ac", "без кондиционера");
  }

  return normalize(parts.filter((v) => v != null && v !== "").join(" "));
}

/**
 * @param {object} car
 * @param {string} query
 * @returns {boolean}
 */
export function carMatchesSearchQuery(car, query) {
  const q = normalize(query);
  if (!q) return true;

  const haystack = buildCarSearchText(car);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // Every token must appear somewhere in the car details
  return tokens.every((token) => haystack.includes(token));
}
