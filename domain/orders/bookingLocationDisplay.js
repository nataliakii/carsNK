/**
 * Pickup / return lines for emails and admin notifications.
 * Spain stores the city in `placeIn` and the hotel/street in `placeInDetail`.
 */

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function formatBookingLocationLine(place, detail) {
  const p = normalizeText(place);
  const d = normalizeText(detail);
  if (!p && !d) return "";
  if (!d) return p;
  if (!p) return d;
  if (p.toLowerCase() === d.toLowerCase()) return p;
  return `${p} — ${d}`;
}

export function formatHandoverLocationLine({
  place,
  detail,
  method,
  officeLabel = "",
  deliveryLabel = "",
} = {}) {
  const loc = formatBookingLocationLine(place, detail);
  const m = normalizeText(method).toLowerCase();
  if (m === "office" && officeLabel) {
    return loc ? `${officeLabel}: ${loc}` : officeLabel;
  }
  if (m === "delivery" && deliveryLabel) {
    return loc ? `${deliveryLabel}: ${loc}` : deliveryLabel;
  }
  return loc;
}
