/**
 * Maps booking/order location labels to DeliveryZone.name in MongoDB.
 * ORDERED_LOCATION_OPTIONS and legacy data may differ from seeded zone names.
 */
const ALIASES = {
  airport: "Thessaloniki Airport",
  "agios nikolaos": "Agios Nikolaos Halkidiki",
};

/**
 * @param {string} [place]
 * @returns {string} trimmed label to match DeliveryZone.name (case-insensitive match in query)
 */
export function resolveDeliveryZoneName(place) {
  const t = typeof place === "string" ? place.trim() : "";
  if (!t) return "";
  const key = t.toLowerCase();
  return ALIASES[key] ?? t;
}
