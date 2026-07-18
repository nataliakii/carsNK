/**
 * pricingDrift.js
 *
 * Detects changes to pricing-affecting fields on a confirmed order
 * by comparing new values against the frozen PriceBreakdown.
 *
 * Returns a drift object { fieldName: { frozen, current } } or null if no drift.
 */

const PRICING_FIELDS = [
  "insurance",
  "ChildSeats",
  "secondDriver",
  "rentalStartDate",
  "rentalEndDate",
  "timeIn",
  "timeOut",
  "car",
  "placeIn",
  "placeOut",
];

function normalizeForComparison(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value._id) return String(value._id);
  if (typeof value === "object" && value.toString && value.constructor?.name === "ObjectId")
    return String(value);
  return value;
}

/**
 * Build a drift map for a confirmed order given the payload of changes.
 *
 * @param {Object} params
 * @param {Object} params.order        - current Mongoose order document
 * @param {Object} params.payload      - incoming update payload
 * @param {Object} params.breakdown    - frozen PriceBreakdown document (plain object)
 * @param {Object|null} params.existingDrift - order.pricingDrift (may already have entries)
 * @returns {Object|null} drift map or null if no drift
 */
export function detectPricingDrift({ order, payload, breakdown, existingDrift }) {
  const drift = existingDrift ? { ...existingDrift } : {};

  for (const field of PRICING_FIELDS) {
    if (payload[field] === undefined) continue;

    const frozenValue = getFrozenValue(field, order, breakdown);
    const newValue = normalizeForComparison(payload[field]);
    const frozenNorm = normalizeForComparison(frozenValue);

    if (frozenNorm !== newValue) {
      drift[field] = { frozen: frozenNorm, current: newValue };
    } else {
      delete drift[field];
    }
  }

  return Object.keys(drift).length > 0 ? drift : null;
}

/**
 * Get the "frozen" value for a field from breakdown or order.
 * Breakdown stores some fields under different names.
 */
function getFrozenValue(field, order, breakdown) {
  if (!breakdown) return order[field];

  switch (field) {
    case "insurance":
      return breakdown.insurance ?? order.insurance;
    case "ChildSeats":
      return breakdown.childSeatsCount ?? order.ChildSeats;
    case "secondDriver":
      return breakdown.secondDriverEnabled ?? order.secondDriver;
    case "placeIn":
      return breakdown.placeIn ?? order.placeIn;
    case "placeOut":
      return breakdown.placeOut ?? order.placeOut;
    default:
      return order[field];
  }
}

export { PRICING_FIELDS };
