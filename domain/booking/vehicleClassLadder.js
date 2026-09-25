/**
 * The vehicle class vocabulary, ordered from lowest to highest.
 *
 * This is the single ranking behind every "same or higher class" decision:
 * the server rules that reject a downgrade and the supplier dialogs that must
 * not offer one in the first place. It lives on its own because it has to be
 * importable from a client component — no crypto, no models, no database.
 */

export const VEHICLE_CLASS_RANK = Object.freeze([
  "mini",
  "economy",
  "compact",
  "combi",
  "convertible",
  "intermediate",
  "standard",
  "fullsize",
  "crossover",
  "suv",
  "van",
  "minibus",
  "premium",
  "luxury",
  "limousine",
  "race car",
]);

export function classRank(value) {
  const idx = VEHICLE_CLASS_RANK.indexOf(String(value || "").trim().toLowerCase());
  return idx === -1 ? null : idx;
}

/**
 * Every class that satisfies "same or higher" for `value`, the class itself
 * first. An unrecognised class yields an empty list so the caller fails closed
 * instead of presenting a guess as a guarantee.
 */
export function vehicleClassesAtOrAbove(value) {
  const rank = classRank(value);
  if (rank == null) return [];
  return VEHICLE_CLASS_RANK.slice(rank);
}
