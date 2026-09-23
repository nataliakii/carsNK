/**
 * Read-only view of an alternative vehicle offer for the customer page.
 *
 * The decision itself stays in `domain/booking/alternativeVehicle.js`; nothing
 * here writes. Safe to call from a GET / server component render.
 *
 * Original history is taken from the immutable offer snapshot when present so
 * a later live-car edit cannot rewrite what the customer was shown.
 */

import { Order } from "@models/order";
import { Car } from "@models/car";
import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import { connectToDB } from "@lib/database";
import { toMinorUnits } from "@/domain/money/minorUnits";
import { resolveBusinessTimezone } from "@/domain/time/resolveBusinessTimezone";
import { absoluteUrl } from "@config/domain";
import { listCarPhotos } from "@/domain/cars/carPhotos";
import { formatLocationLegLine } from "@/domain/orders/locationSnapshot";
import { normalizeOfferCapabilityId } from "@/domain/booking/alternativeOfferCore";
import {
  deriveMarketplaceBookingFeeBpsFromAmounts,
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
} from "@/domain/orders/marketplaceBookingFee";

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
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return listCarPhotos(value);
  }
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => text(item)).filter(Boolean);
}

export function buildAlternativeOfferUrl(offerId, locale = "en") {
  const safeLocale = String(locale || "en").trim().toLowerCase() || "en";
  return absoluteUrl(
    `/${safeLocale}/booking/alternative/${encodeURIComponent(String(offerId || ""))}`
  );
}

export function resolveOfferStatus(offer, now = new Date()) {
  const stored = String(offer?.status || "").trim();
  if (stored === DECIDABLE_STATUS && offer?.expiresAt && new Date(offer.expiresAt) <= now) {
    return "EXPIRED";
  }
  return stored || "EXPIRED";
}

function fromVehicle(vehicle, priceMinor, extras = {}) {
  const name = [text(vehicle?.make), text(vehicle?.model)].filter(Boolean).join(" ");
  return {
    name: text(name) || text(vehicle?.name),
    category: text(vehicle?.category || vehicle?.class),
    transmission: text(vehicle?.transmission),
    seats: num(vehicle?.seats),
    luggage: num(vehicle?.luggage),
    doors: num(vehicle?.doors),
    fuel: text(vehicle?.fuel),
    year: num(vehicle?.year),
    modelGroup: text(vehicle?.modelGroup),
    photos: photoList(vehicle?.photos || vehicle),
    priceMinor: num(priceMinor),
    depositMinor:
      num(extras.depositMinor) ??
      (vehicle?.securityDepositMajor == null
        ? null
        : toMinorUnits(vehicle.securityDepositMajor, extras.currency || "EUR")),
    insurance: text(extras.insurance),
    insuranceExcessMajor: num(vehicle?.insuranceExcessMajor),
    mileagePolicy: text(vehicle?.mileagePolicy),
    fuelPolicy: text(vehicle?.fuelPolicy),
    minDriverAge: num(vehicle?.minDriverAge),
    pickup: extras.pickup || { atUtc: null, place: null, detail: null },
  };
}

function offeredVehicleSide(offer) {
  const vehicle = offer.vehicle || {};
  return fromVehicle(vehicle, offer.offeredGrossMinor ?? offer.priceMinor, {
    currency: offer.currency,
    depositMinor: offer.depositMinor,
    insurance: offer.insurance,
    pickup: {
      atUtc: iso(offer.pickup?.atUtc),
      place: text(offer.pickup?.place),
      detail: text(offer.pickup?.detail),
    },
  });
}

function bookedFromSnapshot(offer) {
  const original = offer.originalRequest;
  if (!original?.vehicle) return null;
  const loc = original.locationSnapshot?.pickup;
  return fromVehicle(original.vehicle, offer.originalPriceMinor, {
    currency: offer.currency,
    insurance: original.insurance || offer.insurance,
    pickup: {
      atUtc: iso(offer.pickup?.atUtc),
      place: text(loc?.name || offer.pickup?.place),
      detail: text(loc?.address || offer.pickup?.detail),
    },
  });
}

function bookedVehicleSide({ offer, order, car }) {
  const fromSnap = bookedFromSnapshot(offer);
  if (fromSnap) return fromSnap;

  const depositMajor = car?.deposit ?? order?.franchiseOrder ?? null;
  return {
    name: text(order?.carModel || car?.model),
    category: text(car?.class),
    transmission: text(car?.transmission),
    seats: num(car?.seats ?? car?.numberOfSeats),
    luggage: null,
    doors: num(car?.numberOfDoors),
    fuel: text(car?.fueltype),
    year: num(car?.registration),
    modelGroup: null,
    photos: photoList(car),
    priceMinor: num(offer.originalPriceMinor),
    depositMinor: depositMajor == null ? null : toMinorUnits(depositMajor, offer.currency),
    insurance: text(order?.insurance),
    insuranceExcessMajor: num(car?.franchise),
    mileagePolicy: null,
    fuelPolicy: null,
    minDriverAge: null,
    pickup: {
      atUtc: iso(order?.pickupAtUtc || order?.timeIn || order?.rentalStartDate),
      place: text(order?.placeIn),
      detail: text(order?.placeInDetail),
    },
  };
}

function locationSummary(offer, order) {
  const snap = offer.proposedLocationSnapshot || order?.locationSnapshot;
  if (!snap) {
    return {
      pickup: [order?.placeIn, order?.placeInDetail].filter(Boolean).join(" — ") || null,
      return: [order?.placeOut, order?.placeOutDetail].filter(Boolean).join(" — ") || null,
      pickupFeeMinor: null,
      returnFeeMinor: null,
    };
  }
  return {
    pickup: formatLocationLegLine(snap.pickup, {
      officeLabel: "Office",
      deliveryLabel: "Delivery",
    }),
    return: formatLocationLegLine(snap.return || snap.dropoff, {
      officeLabel: "Office",
      deliveryLabel: "Delivery",
    }),
    pickupFeeMinor: snap.pickup ? Math.round((Number(snap.pickup.feeMajor) || 0) * 100) : null,
    returnFeeMinor: snap.return
      ? Math.round((Number(snap.return.feeMajor) || 0) * 100)
      : null,
  };
}

export async function buildAlternativeOfferView(offerId, now = new Date()) {
  const id = normalizeOfferCapabilityId(offerId);
  if (!id) return null;

  await connectToDB();
  const offer = await AlternativeVehicleOffer.findOne({ offerId: id }).lean();
  if (!offer) return null;

  const order = await Order.findById(offer.orderId)
    .select(
      "orderNumber carModel car insurance franchiseOrder placeIn placeInDetail pickupAtUtc timeIn rentalStartDate timezone locationSnapshot originalRequestSnapshot"
    )
    .lean()
    .catch(() => null);

  const originalCarId = offer.originalRequest?.carId || offer.originalCarId || order?.car;
  const car = originalCarId
    ? await Car.findById(originalCarId)
        .select("model class transmission seats registration photoUrl photos deposit franchise numberOfDoors fueltype")
        .lean()
        .catch(() => null)
    : null;

  const status = resolveOfferStatus(offer, now);
  const locations = locationSummary(offer, order);

  return {
    offerId: offer.offerId,
    orderNumber: text(order?.orderNumber),
    status,
    decidable: status === DECIDABLE_STATUS,
    currency: String(offer.currency || "EUR").toUpperCase(),
    timezone: resolveBusinessTimezone({ order }),
    reasonForReplacement: text(offer.reasonForReplacement),
    afterPayment: Boolean(offer.afterPayment),
    offeredAt: iso(offer.offeredAt),
    expiresAt: iso(offer.expiresAt),
    decidedAt: iso(offer.decidedAt),
    booked: bookedVehicleSide({ offer, order, car }),
    offered: offeredVehicleSide(offer),
    sameOrBetter: true,
    calculatedGrossMinor: num(offer.calculatedAlternativeGrossMinor),
    replacementDiscountMinor: num(offer.replacementDiscountMinor) || 0,
    offeredGrossMinor: num(offer.offeredGrossMinor ?? offer.priceMinor),
    prepaymentMinor: num(offer.prepaymentMinor),
    balanceMinor: num(offer.balanceMinor),
    marketplaceBookingFeeBps:
      num(offer.marketplaceBookingFeeBps) ||
      deriveMarketplaceBookingFeeBpsFromAmounts({
        grossMinor: offer.offeredGrossMinor ?? offer.priceMinor,
        platformAmountMinor: offer.prepaymentMinor,
      }) ||
      DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
    locations,
    termsChanged: Boolean(offer.termsChanged),
    changedTerms: Array.isArray(offer.changedTerms) ? offer.changedTerms : [],
    availabilityNote: text(offer.availabilityNote),
    paymentUrl: status === "ACCEPTED" ? text(offer.checkoutUrl) : null,
    paymentLinkGenerationFailed:
      status === "ACCEPTED" ? Boolean(offer.paymentLinkGenerationFailed) : false,
  };
}
