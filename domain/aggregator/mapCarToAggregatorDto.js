/**
 * Aggregator API helpers — map fleet cars to a stable public DTO.
 */

import { getBaseUrl } from "@config/domain";

/** Booking / public links always use SEO canonical (carsnk.gr), never peer mirror. */
export function getAggregatorBookingBaseUrl() {
  return getBaseUrl();
}

export function buildCloudinaryImageUrl(photoUrl) {
  if (!photoUrl || typeof photoUrl !== "string") return null;
  const trimmed = photoUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const cloud =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    "";
  if (!cloud) return trimmed;
  return `https://res.cloudinary.com/${cloud}/image/upload/${trimmed}`;
}

export function getMinPriceFromTiers(pricingTiers) {
  if (pricingTiers == null) return 0;
  const tiers =
    pricingTiers instanceof Map
      ? Object.fromEntries(pricingTiers)
      : pricingTiers;
  let min = Infinity;
  for (const tier of Object.values(tiers || {})) {
    const days = tier?.days;
    if (days == null) continue;
    const dayMap = days instanceof Map ? Object.fromEntries(days) : days;
    for (const value of Object.values(dayMap || {})) {
      const n = Number(value);
      if (Number.isFinite(n) && n < min) min = n;
    }
  }
  return Number.isFinite(min) ? min : 0;
}

function capitalizeWord(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function buildCarTitle(model, transmission) {
  return [model, transmission]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .map(capitalizeWord)
    .filter(Boolean)
    .join(" ");
}

/**
 * Flatten pricing tiers to a plain object for JSON.
 * @param {unknown} pricingTiers
 * @returns {Record<string, Record<string, number>> | null}
 */
export function serializePricingTiers(pricingTiers) {
  if (pricingTiers == null) return null;
  const tiers =
    pricingTiers instanceof Map
      ? Object.fromEntries(pricingTiers)
      : pricingTiers;
  const out = {};
  for (const [season, tier] of Object.entries(tiers || {})) {
    const days = tier?.days;
    if (days == null) continue;
    const dayMap = days instanceof Map ? Object.fromEntries(days) : days;
    out[season] = {};
    for (const [k, v] of Object.entries(dayMap || {})) {
      const n = Number(v);
      if (Number.isFinite(n)) out[season][k] = n;
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * @param {Record<string, unknown>} doc - lean car document
 * @param {{ includePricing?: boolean }} [options]
 */
export function mapCarToAggregatorDto(doc, options = {}) {
  const baseUrl = getAggregatorBookingBaseUrl();
  const slug = String(doc.slug || "").trim();
  const model = String(doc.model || "").trim();
  const transmission = String(doc.transmission || "").trim().toLowerCase();
  const seats = Number(doc.seats);

  const dto = {
    id: String(doc._id),
    carNumber: doc.carNumber != null ? String(doc.carNumber) : null,
    title: buildCarTitle(model, transmission),
    model: model || null,
    slug: slug || null,
    class: doc.class != null ? String(doc.class).toLowerCase() : null,
    transmission: transmission || null,
    fueltype: doc.fueltype ? String(doc.fueltype).toLowerCase() : null,
    seats: Number.isFinite(seats) && seats > 0 ? seats : 5,
    numberOfDoors: Number.isFinite(Number(doc.numberOfDoors))
      ? Number(doc.numberOfDoors)
      : null,
    registration: Number.isFinite(Number(doc.registration))
      ? Number(doc.registration)
      : null,
    color: doc.color != null ? String(doc.color) : null,
    airConditioning:
      typeof doc.airConditioning === "boolean" ? doc.airConditioning : null,
    engine: doc.engine != null ? String(doc.engine) : null,
    enginePower: Number.isFinite(Number(doc.enginePower))
      ? Number(doc.enginePower)
      : null,
    deposit: Number.isFinite(Number(doc.deposit)) ? Number(doc.deposit) : null,
    franchise: Number.isFinite(Number(doc.franchise))
      ? Number(doc.franchise)
      : null,
    priceFrom: getMinPriceFromTiers(doc.pricingTiers),
    currency: "EUR",
    image: buildCloudinaryImageUrl(
      typeof doc.photoUrl === "string" ? doc.photoUrl : null
    ),
    imageId: typeof doc.photoUrl === "string" ? doc.photoUrl : null,
    bookingUrl: slug
      ? `${baseUrl}/en/cars/${encodeURIComponent(slug)}`
      : `${baseUrl}/en`,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };

  if (options.includePricing) {
    dto.pricingTiers = serializePricingTiers(doc.pricingTiers);
  }

  return dto;
}

/** Accept Bearer or X-API-Key against AGGREGATOR_API_KEY (fallback INTERNAL_API_TOKEN). */
export function getExpectedAggregatorApiKey() {
  const primary = String(process.env.AGGREGATOR_API_KEY || "").trim();
  if (primary) return primary;
  return String(process.env.INTERNAL_API_TOKEN || "").trim();
}

/**
 * @param {Request} request
 * @returns {boolean}
 */
export function isAggregatorRequestAuthorized(request) {
  const expected = getExpectedAggregatorApiKey();
  if (!expected) return false;

  const apiKeyHeader = request.headers.get("x-api-key")?.trim();
  if (apiKeyHeader && apiKeyHeader === expected) return true;

  const auth = request.headers.get("authorization")?.trim() || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token && token === expected) return true;
  }

  return false;
}

export const AGGREGATOR_CAR_SELECT =
  "_id carNumber model transmission slug photoUrl pricingTiers fueltype seats class registration color numberOfDoors airConditioning enginePower engine deposit franchise updatedAt";
