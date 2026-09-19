/**
 * Great-circle distance in km (WGS84 sphere approximation).
 */
export function haversineKm(a, b) {
  const lat1 = Number(a?.lat);
  const lon1 = Number(a?.lon ?? a?.lng);
  const lat2 = Number(b?.lat);
  const lon2 = Number(b?.lon ?? b?.lng);
  if (
    ![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))
  ) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * @param {number|null|undefined} orderRadiusKm — null/undefined = unlimited
 * @param {number|null} distanceKm
 */
export function isWithinOrderRadius(orderRadiusKm, distanceKm) {
  if (orderRadiusKm == null || orderRadiusKm === "") return true;
  const radius = Number(orderRadiusKm);
  if (!Number.isFinite(radius) || radius < 0) return true;
  if (distanceKm == null || !Number.isFinite(distanceKm)) return true;
  return distanceKm <= radius + 0.05; // tiny tolerance for float
}

export function parseLatLon(coords) {
  if (!coords) return null;
  const lat = Number(coords.lat);
  const lon = Number(coords.lon ?? coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}
