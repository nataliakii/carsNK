/**
 * Alternative vehicle workflow.
 *
 * Rules enforced here, not left to the caller:
 *   - the alternative may never cost the customer more than the original
 *   - key characteristics may not be downgraded (category, transmission,
 *     seats, luggage)
 *   - the offer must carry photographs and a reason
 *   - the booking is never silently changed: the customer must accept
 *   - after payment, a declined offer starts the refund/replacement workflow
 *     instead of cancelling unilaterally
 */

import crypto from "crypto";

import { Order } from "@models/order";
import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import { connectToDB } from "@lib/database";

import {
  RENTAL_STATE,
  RENTAL_STATE_TO_BOOKING_STATUS,
  canTransitionRentalState,
  resolveRentalState,
} from "./rentalBookingState";
import { resolveConfirmationFinancials, createConfirmedBookingSnapshot } from "./partnerBookingConfirmation";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { loadLegalSettings } from "@/domain/legal/legalSettingsService";

/** Ordered from lowest to highest so a downgrade is detectable. */
export const VEHICLE_CLASS_ORDER = Object.freeze([
  "mini",
  "economy",
  "compact",
  "intermediate",
  "standard",
  "fullsize",
  "suv",
  "van",
  "premium",
  "luxury",
]);

function classRank(value) {
  const idx = VEHICLE_CLASS_ORDER.indexOf(
    String(value || "").trim().toLowerCase()
  );
  return idx === -1 ? null : idx;
}

export function generateOfferId() {
  return `ALT-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

/**
 * Reject an offer that would put the customer in a worse position.
 *
 * @param {{ original: object, alternative: object }} params
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validateAlternativeNotWorse({ original, alternative }) {
  if (Number(alternative.priceMinor) > Number(original.priceMinor)) {
    return {
      ok: false,
      code: "price_increase",
      message: "An alternative vehicle may not cost the customer more than the original booking",
    };
  }

  const originalRank = classRank(original.category);
  const altRank = classRank(alternative.category);
  if (originalRank !== null && altRank !== null && altRank < originalRank) {
    return {
      ok: false,
      code: "category_downgrade",
      message: "The alternative must be of the same or a higher vehicle class",
    };
  }

  if (
    original.transmission &&
    alternative.transmission &&
    String(original.transmission).toLowerCase() === "automatic" &&
    String(alternative.transmission).toLowerCase() !== "automatic"
  ) {
    return {
      ok: false,
      code: "transmission_downgrade",
      message: "An automatic booking cannot be replaced with a manual vehicle without a new booking",
    };
  }

  for (const [field, label] of [
    ["seats", "seats"],
    ["luggage", "luggage capacity"],
  ]) {
    const originalValue = Number(original[field]);
    const altValue = Number(alternative[field]);
    if (
      Number.isFinite(originalValue) &&
      Number.isFinite(altValue) &&
      altValue < originalValue
    ) {
      return {
        ok: false,
        code: `${field}_downgrade`,
        message: `The alternative offers fewer ${label} than the booked vehicle`,
      };
    }
  }

  if (!Array.isArray(alternative.photos) || alternative.photos.length === 0) {
    return {
      ok: false,
      code: "photos_required",
      message: "The customer must be shown photographs of the alternative vehicle",
    };
  }

  if (!String(alternative.reasonForReplacement || "").trim()) {
    return {
      ok: false,
      code: "reason_required",
      message: "A reason for the replacement is required",
    };
  }

  return { ok: true };
}

/**
 * Create an offer. Does not modify the booking beyond marking it as having a
 * pending alternative.
 *
 * @param {{ orderId: string, alternative: object, offeredByEmail?: string,
 *           expiresInHours?: number }} params
 */
export async function offerAlternativeVehicle({
  orderId,
  alternative,
  offeredByEmail = "",
  expiresInHours,
}) {
  await connectToDB();
  const order = await Order.findById(orderId);
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Booking not found" };
  }

  const state = resolveRentalState(order);
  if (!canTransitionRentalState(state, RENTAL_STATE.ALTERNATIVE_OFFERED)) {
    return {
      ok: false,
      status: 409,
      code: "invalid_state",
      message: `Cannot offer an alternative while the booking is ${state}`,
    };
  }

  const financials = resolveConfirmationFinancials(order);
  const original = {
    priceMinor: financials.grossMinor,
    category: alternative.originalCategory || "",
    transmission: alternative.originalTransmission || "",
    seats: alternative.originalSeats,
    luggage: alternative.originalLuggage,
  };

  const check = validateAlternativeNotWorse({ original, alternative });
  if (!check.ok) return { ok: false, status: 400, ...check };

  const settings = await loadLegalSettings();
  const hours =
    Number(expiresInHours) > 0
      ? Number(expiresInHours)
      : settings.alternativeOfferExpirationHours;

  const offerId = generateOfferId();
  const afterPayment = order.payment?.status === "paid";

  const offer = await AlternativeVehicleOffer.create({
    offerId,
    orderId,
    companyId: order.ownerId || null,
    vehicle: {
      carId: alternative.carId || "",
      make: alternative.make || "",
      model: alternative.model,
      category: alternative.category || "",
      transmission: alternative.transmission || "",
      seats: alternative.seats ?? null,
      luggage: alternative.luggage ?? null,
      year: alternative.year ?? null,
      modelGroup: alternative.modelGroup || "",
      photos: alternative.photos,
      mileagePolicy: alternative.mileagePolicy || "",
    },
    priceMinor: Number(alternative.priceMinor),
    currency: financials.currency,
    originalPriceMinor: financials.grossMinor,
    depositMinor: alternative.depositMinor ?? null,
    insurance: alternative.insurance || order.insurance || "",
    pickup: {
      atUtc: alternative.pickupAtUtc || order.pickupAtUtc || order.timeIn || null,
      place: alternative.pickupPlace || order.placeIn || "",
      detail: alternative.pickupDetail || order.placeInDetail || "",
    },
    reasonForReplacement: alternative.reasonForReplacement,
    expiresAt: new Date(Date.now() + hours * 3600 * 1000),
    offeredByEmail,
    afterPayment,
  });

  order.bookingStatus = RENTAL_STATE_TO_BOOKING_STATUS[RENTAL_STATE.ALTERNATIVE_OFFERED];
  await order.save();

  await recordAuditEvent({
    action: "ALTERNATIVE_OFFER_CREATED",
    userRole: "admin",
    userEmail: offeredByEmail,
    severity: "high",
    orderData: { orderId: order._id, orderNumber: order.orderNumber },
    metadata: {
      offerId,
      afterPayment,
      reason: alternative.reasonForReplacement,
      priceMinor: offer.priceMinor,
      originalPriceMinor: offer.originalPriceMinor,
    },
  });

  return { ok: true, offerId, offer: offer.toObject() };
}

/**
 * Customer decision on an offer.
 *
 * @param {{ offerId: string, accept: boolean, ipAddress?: string,
 *           userAgent?: string, declineReason?: string }} params
 */
export async function decideAlternativeVehicle({
  offerId,
  accept,
  ipAddress = "",
  userAgent = "",
  declineReason = "",
}) {
  await connectToDB();
  const now = new Date();

  // Atomic decision — a double submit resolves to the first outcome.
  const offer = await AlternativeVehicleOffer.findOneAndUpdate(
    { offerId, status: "OFFERED", expiresAt: { $gt: now } },
    {
      $set: {
        status: accept ? "ACCEPTED" : "DECLINED",
        decidedAt: now,
        decisionIp: ipAddress,
        decisionUserAgent: userAgent,
        declineReason: accept ? "" : declineReason,
      },
    },
    { new: true }
  );

  if (!offer) {
    const existing = await AlternativeVehicleOffer.findOne({ offerId }).lean();
    if (!existing) {
      return { ok: false, status: 404, code: "not_found", message: "Offer not found" };
    }
    if (existing.status === "OFFERED" && existing.expiresAt <= now) {
      await AlternativeVehicleOffer.updateOne(
        { offerId },
        { $set: { status: "EXPIRED" } }
      ).catch(() => {});
      return {
        ok: false,
        status: 410,
        code: "expired",
        message: "This offer has expired",
      };
    }
    return {
      ok: true,
      idempotent: true,
      status: existing.status,
      message: `This offer was already ${existing.status.toLowerCase()}`,
    };
  }

  const order = await Order.findById(offer.orderId);
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Booking not found" };
  }

  if (accept) {
    order.bookingStatus =
      RENTAL_STATE_TO_BOOKING_STATUS[RENTAL_STATE.ALTERNATIVE_ACCEPTED];
    order.carModel = offer.vehicle.model || order.carModel;
    await order.save();

    // A new immutable snapshot rather than an edit to the original one.
    if (offer.afterPayment) {
      await createConfirmedBookingSnapshot({
        orderId: String(order._id),
        reason: `alternative_accepted:${offerId}`,
      }).catch((err) => {
        console.error("[alternative] snapshot failed", err?.message || err);
      });
    }
  } else {
    order.bookingStatus =
      RENTAL_STATE_TO_BOOKING_STATUS[RENTAL_STATE.ALTERNATIVE_DECLINED];
    await order.save();
  }

  await recordAuditEvent({
    action: accept ? "ALTERNATIVE_OFFER_ACCEPTED" : "ALTERNATIVE_OFFER_DECLINED",
    severity: "high",
    ipAddress,
    userAgent,
    reason: accept ? "" : declineReason,
    orderData: { orderId: order._id, orderNumber: order.orderNumber },
    metadata: { offerId, afterPayment: offer.afterPayment },
  });

  return {
    ok: true,
    idempotent: false,
    status: offer.status,
    /** Declining a paid booking must trigger a refund, never a silent change. */
    refundRequired: !accept && offer.afterPayment,
    orderId: String(order._id),
  };
}

/**
 * Offers a customer still has to answer.
 * @param {string} orderId
 */
export async function listOpenOffers(orderId) {
  await connectToDB();
  return AlternativeVehicleOffer.find({
    orderId,
    status: "OFFERED",
    expiresAt: { $gt: new Date() },
  })
    .sort({ offeredAt: -1 })
    .lean();
}

/** Full history for the superadmin booking legal audit. */
export async function listOffersForOrder(orderId) {
  await connectToDB();
  return AlternativeVehicleOffer.find({ orderId }).sort({ offeredAt: -1 }).lean();
}
