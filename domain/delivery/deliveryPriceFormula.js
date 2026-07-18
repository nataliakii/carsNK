/**
 * Pure delivery price formula - no DB, no side effects.
 * Usable in both server (Node) and client (React) environments.
 *
 * Formula: distanceKm x pricePerKm (one-way from base to zone)
 * Overrides: fixedPrice (flat rate, including explicit 0) or isFreeDelivery.
 */

/**
 * @param {Object} zone
 * @param {number} zone.distanceKm
 * @param {number|null} [zone.fixedPrice]
 * @param {boolean} [zone.isFreeDelivery]
 * @param {number} pricePerKm
 * @returns {number} delivery price for one direction
 */
export function computeZoneDeliveryPrice(zone, pricePerKm) {
  if (!zone) return 0;
  if (zone.isFreeDelivery) return 0;

  const fixedPrice = Number(zone.fixedPrice);
  if (zone.fixedPrice != null && Number.isFinite(fixedPrice) && fixedPrice >= 0) {
    return fixedPrice;
  }

  const distanceKm = Number(zone.distanceKm);
  const perKm = Number(pricePerKm);

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  if (!Number.isFinite(perKm) || perKm <= 0) return 0;

  return Math.round(distanceKm * perKm * 100) / 100;
}
