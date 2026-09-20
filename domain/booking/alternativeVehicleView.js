/**
 * Read-only view of an alternative vehicle offer for the customer page.
 *
 * The decision itself stays in `domain/booking/alternativeVehicle.js`; nothing
 * here writes. Safe to call from a GET / server component render.
 *
 * The offer document already holds everything about the replacement. The
 * originally booked vehicle is not copied into the offer, so it is read back
 * from the order and its car using the same field mapping as
 * `createConfirmedBookingSnapshot`. Whatever has no stored value stays null so
 * the page can say "not specified" instead of inventing a figure.
 */

import { Order } from "@models/order";
import { Car } from "@models/car";
import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import { connectToDB } from "@lib/database";
import { toMinorUnits } from "@/domain/money/minorUnits";
import { resolveBusinessTimezone } from "@/domain/time/resolveBusinessTimezone";
import { absoluteUrl } from "@config/domain";

/** Offer statuses the customer can still answer. */
const DECIDABLE_STATUS = "OFFERED";

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function text(value) {
  const str = String(value ?? "").trim();
  return str || null;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function photoList(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => text(item)).filter(Boolean);
}

/**
 * The customer-facing link for an offer.
 *
 * The offer id is the capability, exactly as the API route treats it, so the
 * link carries no token of its own and nothing identifies the customer.
 *
 * @param {string} offerId
 * @param {string} [locale] UI locale for the landing page
 */
export function buildAlternativeOfferUrl(offerId, locale = "en") {
  const safeLocale = String(locale || "en").trim().toLowerCase() || "en";
  return absoluteUrl(
    `/${safeLocale}/booking/alternative/${encodeURIComponent(String(offerId || ""))}`
  );
}

/**
 * @param {object} offer lean AlternativeVehicleOffer
 * @param {Date} now
 */
export function resolveOfferStatus(offer, now = new Date()) {
  const stored = String(offer?.status || "").trim();
  if (stored === DECIDABLE_STATUS && offer?.expiresAt && new Date(offer.expiresAt) <= now) {
    return "EXPIRED";
  }
  return stored || "EXPIRED";
}

function offeredVehicleSide(offer) {
  const vehicle = offer.vehicle || {};
  const name = [text(vehicle.make), text(vehicle.model)].filter(Boolean).join(" ");

  return {
    name: text(name),
    category: text(vehicle.category),
    transmission: text(vehicle.transmission),
    seats: num(vehicle.seats),
    luggage: num(vehicle.luggage),
    year: num(vehicle.year),
    modelGroup: text(vehicle.modelGroup),
    photos: photoList(vehicle.photos),
    priceMinor: num(offer.priceMinor),
    depositMinor: num(offer.depositMinor),
    insurance: text(offer.insurance),
    mileagePolicy: text(vehicle.mileagePolicy),
    pickup: {
      atUtc: iso(offer.pickup?.atUtc),
      place: text(offer.pickup?.place),
      detail: text(offer.pickup?.detail),
    },
  };
}

/**
 * The booked vehicle as stored. `luggage`, `modelGroup` and `mileagePolicy`
 * are not held on the car or the order, so they stay null rather than being
 * guessed from the alternative.
 */
function bookedVehicleSide({ offer, order, car }) {
  const depositMajor = car?.deposit ?? order?.franchiseOrder ?? null;

  return {
    name: text(order?.carModel || car?.model),
    category: text(car?.class),
    transmission: text(car?.transmission),
    seats: num(car?.seats ?? car?.numberOfSeats),
    luggage: null,
    year: num(car?.registration),
    modelGroup: null,
    photos: photoList(car?.photoUrl),
    priceMinor: num(offer.originalPriceMinor),
    depositMinor: depositMajor == null ? null : toMinorUnits(depositMajor, offer.currency),
    insurance: text(order?.insurance),
    mileagePolicy: null,
    pickup: {
      atUtc: iso(order?.pickupAtUtc || order?.timeIn || order?.rentalStartDate),
      place: text(order?.placeIn),
      detail: text(order?.placeInDetail),
    },
  };
}

/**
 * Everything the offer page renders, or null when the id is unknown.
 *
 * No customer contact details are included: a leaked link must not become a
 * way to read personal data.
 *
 * @param {string} offerId
 * @param {Date} [now]
 */
export async function buildAlternativeOfferView(offerId, now = new Date()) {
  const id = String(offerId || "").trim();
  if (!id) return null;

  await connectToDB();
  const offer = await AlternativeVehicleOffer.findOne({ offerId: id }).lean();
  if (!offer) return null;

  const order = await Order.findById(offer.orderId)
    .select(
      "orderNumber carModel car insurance franchiseOrder placeIn placeInDetail pickupAtUtc timeIn rentalStartDate timezone"
    )
    .lean()
    .catch(() => null);

  const car = order?.car
    ? await Car.findById(order.car)
        .select("model class transmission seats registration photoUrl deposit")
        .lean()
        .catch(() => null)
    : null;

  const status = resolveOfferStatus(offer, now);

  return {
    offerId: offer.offerId,
    orderNumber: text(order?.orderNumber),
    status,
    decidable: status === DECIDABLE_STATUS,
    currency: String(offer.currency || "EUR").toUpperCase(),
    /** Times are shown in the rental's local zone, like an airline ticket. */
    timezone: resolveBusinessTimezone({ order }),
    reasonForReplacement: text(offer.reasonForReplacement),
    /** True when the original booking was already paid: declining owes a refund. */
    afterPayment: Boolean(offer.afterPayment),
    offeredAt: iso(offer.offeredAt),
    expiresAt: iso(offer.expiresAt),
    decidedAt: iso(offer.decidedAt),
    booked: bookedVehicleSide({ offer, order, car }),
    offered: offeredVehicleSide(offer),
  };
}
