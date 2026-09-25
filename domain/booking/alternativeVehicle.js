/**
 * Alternative vehicle workflow.
 *
 * Rules enforced here, not left to the caller:
 *   - Spain MARKETPLACE_REQUEST unpaid P0 only (paid → SUPERADMIN/manual)
 *   - a fleet replacement is a stored same-company car
 *   - an unlisted or guaranteed-class replacement is allowed only when it
 *     meets the equivalent-replacement guarantees and does not charge a fee
 *   - price is server-calculated and never higher than the original
 *   - key characteristics may not be downgraded
 *   - one active OFFERED row per order (DB partial unique index + CAS)
 *   - creating a fleet offer moves operational `order.car` onto that vehicle
 *     (calendar move parity); it still does not create a hold or Stripe
 *   - the customer must accept before hold + Checkout
 *   - original request is snapshotted immutably before the operational car changes
 *
 * Consistency (Mongo transactions are optional and not used in standalone
 * tests). See docs/alternative-offer-indexes.md.
 */

import { Order } from "@models/order";
import { Car } from "@models/car";
import Company from "@models/company";
import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import { connectToDB } from "@lib/database";

import {
  RENTAL_STATE,
  RENTAL_STATE_TO_BOOKING_STATUS,
  applyRentalStateTransition,
  resolveRentalState,
} from "./rentalBookingState";
import { BOOKING_STATUS } from "./bookingStatus";
import { resolveConfirmationFinancials } from "./partnerBookingConfirmation";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { loadLegalSettings } from "@/domain/legal/legalSettingsService";
import {
  assertPartnerCanOperate,
  auditPartnerComplianceBlock,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import {
  AVAILABILITY_PURPOSE,
  evaluateRentalAvailability,
} from "@/domain/booking/availabilityEngine";
import {
  acquireMarketplaceHold,
  findOverlappingActiveHold,
  markHoldForRetry,
  releaseMarketplaceHold,
  restoreMarketplaceHoldAfterFailedAcquire,
} from "@/domain/booking/bookingHold";
import { calculateAuthoritativeRentalPrice } from "@/domain/orders/rentalPricingService";
import { snapshotMarketplaceBookingFeeBps } from "@/domain/orders/marketplaceBookingFee";
import {
  isMarketplaceFeePaid,
  paidPlatformAmountMinor,
} from "@/domain/orders/marketplacePriceCorrection";
import { calculateDeliveryPrice } from "@/domain/delivery/calculateDeliveryPrice";
import { computePriceSnapshotChecksum } from "@/domain/orders/priceSnapshotChecksum";
import { fromMinorUnits } from "@/domain/money/minorUnits";
import { equivalentReplacementDisclosure } from "@/domain/booking/equivalentReplacementCopy";
import { LOCATION_KIND } from "@/domain/orders/locationSnapshot";
import {
  archiveStripeSession,
  STRIPE_SESSION_ARCHIVE,
} from "@/domain/orders/stripePaymentRefs";
import {
  clampStripeExpiresMinutes,
  createRentalCheckoutSession,
  expireRentalCheckoutSession,
} from "@/domain/orders/rentalStripeCheckout";
import { ROLE } from "@models/user";
import {
  ALTERNATIVE_OFFER_CODE,
  CURRENT_OFFER_ID_HEX_LENGTH,
  LEGACY_OFFER_ID_HEX_LENGTH,
  OFFER_ID_BYTES,
  OFFER_ID_PREFIX,
  VEHICLE_CLASS_RANK,
  applyReplacementPriceCap,
  assertDeliveryQuoteSafe,
  assertProposedCarCompany,
  buildCappedAuthoritativePrice,
  buildCustomerVehicleSnapshot,
  buildOfferChecksum,
  buildOfferChecksumPayload,
  buildOriginalRequestSnapshot,
  buildProposedLocationSnapshot,
  classRank,
  compareMaterialRentalTerms,
  evaluateAutomaticAlternativeEligibility,
  evaluateOfficeCompatibility,
  extractTermsSlice,
  generateOfferId,
  isOrderPaid,
  isValidOfferCapabilityId,
  normalizeOfferCapabilityId,
  publicExclusionReason,
  sanitizeReason,
  verifyOfferChecksum,
} from "./alternativeOfferCore";
import {
  sendAlternativeAcceptedNotice,
  sendAlternativeDeclinedNotice,
  sendAlternativeExpiredNotice,
  sendAlternativeOfferedEmail,
  sendAlternativePaymentLinkEmail,
  sendAlternativeWithdrawnEmail,
} from "@/domain/orders/marketplaceAlternativeEmails";

export const VEHICLE_CLASS_ORDER = VEHICLE_CLASS_RANK;

export {
  CURRENT_OFFER_ID_HEX_LENGTH,
  LEGACY_OFFER_ID_HEX_LENGTH,
  OFFER_ID_BYTES,
  OFFER_ID_PREFIX,
  generateOfferId,
  isValidOfferCapabilityId,
  normalizeOfferCapabilityId,
};

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
    String(original.transmission).trim().toLowerCase() !==
      String(alternative.transmission).trim().toLowerCase()
  ) {
    return {
      ok: false,
      code: "transmission_downgrade",
      message: "The replacement must have the same transmission as the requested vehicle",
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

function actorFromSession(session) {
  const user = session?.user || session || {};
  return {
    role: Number(user.role),
    ownerId: user.ownerId || user.companyId || null,
    email: user.email || "",
    userId: user.id || user._id || null,
    isSuperadmin: Number(user.role) === ROLE.SUPERADMIN,
  };
}

function originalVehicleFromOrder(order, car) {
  return {
    priceMinor: resolveConfirmationFinancials(order).grossMinor,
    category: car?.class || "",
    transmission: car?.transmission || "",
    seats: car?.seats ?? car?.numberOfSeats,
    luggage: car?.luggage ?? car?.luggageCapacity,
    photos: [],
  };
}

async function loadCompany(order) {
  if (!order?.ownerId) return null;
  return Company.findById(order.ownerId).lean();
}

async function loadOriginalCar(order) {
  if (!order?.car) return null;
  return Car.findById(order.car);
}

function quotedFeesFromSnapshot(snapshot) {
  const pickup = snapshot?.pickup || {};
  const ret = snapshot?.return || snapshot?.dropoff || {};
  return {
    quotedPickupFeeMinor: Math.round((Number(pickup.feeMajor) || 0) * 100),
    quotedReturnFeeMinor: Math.round((Number(ret.feeMajor) || 0) * 100),
  };
}

async function quoteProposedDelivery({ order, car, company, eligible }) {
  const snap = order.locationSnapshot;
  const pickup = snap?.pickup || {};
  const ret = snap?.return || snap?.dropoff || {};
  const pickupOffice = pickup.kind === LOCATION_KIND.OFFICE;
  const returnOffice = ret.kind === LOCATION_KIND.OFFICE;
  if (pickupOffice && returnOffice) {
    return {
      ok: true,
      delivery: {
        deliveryIn: 0,
        deliveryOut: 0,
        deliveryBlockedIn: false,
        deliveryBlockedOut: false,
        officeFreeIn: true,
        officeFreeOut: true,
      },
    };
  }

  try {
    const delivery = await calculateDeliveryPrice({
      placeIn: pickup.name || order.placeIn,
      placeOut: ret.name || order.placeOut,
      companyId: company?._id || order.ownerId,
      timeIn: order.pickupAtUtc || order.timeIn,
      timeOut: order.returnAtUtc || order.timeOut,
      carOffices: eligible && eligible.length ? eligible : car.offices,
      placeInDetail: pickup.address || order.placeInDetail,
      placeOutDetail: ret.address || order.placeOutDetail,
      placeInLat: pickup.lat,
      placeInLon: pickup.lon,
      placeOutLat: ret.lat,
      placeOutLon: ret.lon,
      placeInLocality: pickup.city || pickup.name,
      placeOutLocality: ret.city || ret.name,
    });
    const safe = assertDeliveryQuoteSafe({ originalSnapshot: snap, delivery });
    if (!safe.ok) return safe;
    return { ok: true, delivery };
  } catch (err) {
    return {
      ok: false,
      code: ALTERNATIVE_OFFER_CODE.DELIVERY_UNPRICED,
      message: err?.message || "Delivery could not be priced for this car",
    };
  }
}

async function evaluateProposedAvailability({ car, order, purpose }) {
  const pickup = order.pickupAtUtc || order.timeIn;
  const ret = order.returnAtUtc || order.timeOut;
  const existingOrders = await Order.find({ car: car._id }).lean();
  const availability = evaluateRentalAvailability({
    carId: car._id,
    pickupAtUtc: pickup,
    returnAtUtc: ret,
    timezone: order.timezone,
    existingOrders,
    excludeOrderId: order._id,
    purpose: purpose || AVAILABILITY_PURPOSE.CONFIRM,
    bookingMode: order.bookingMode,
  });
  if (availability.hardConflict) {
    return {
      ok: false,
      code: ALTERNATIVE_OFFER_CODE.AVAILABILITY_CONFLICT,
      message: availability.userSafeReason || "Those dates are not available for this car",
    };
  }
  const overlappingHold = await findOverlappingActiveHold({
    carId: car._id,
    pickupAtUtc: pickup,
    returnAtUtc: ret,
    excludeOrderId: order._id,
  });
  if (overlappingHold) {
    return {
      ok: false,
      code: ALTERNATIVE_OFFER_CODE.HOLD_CONFLICT,
      message: "Those dates are already held for another booking",
    };
  }
  return { ok: true, availability };
}

async function buildProposedQuote({ order, car, company }) {
  const office = evaluateOfficeCompatibility({ order, car, company });
  if (!office.ok) return office;

  const deliveryQuote = await quoteProposedDelivery({
    order,
    car,
    company,
    eligible: office.eligible,
  });
  if (!deliveryQuote.ok) return deliveryQuote;

  const proposedLocation = buildProposedLocationSnapshot({
    originalSnapshot: order.locationSnapshot,
    delivery: deliveryQuote.delivery,
    eligible: office.eligible,
    company,
  });
  const fees = quotedFeesFromSnapshot(proposedLocation);
  const snapshotFee = snapshotMarketplaceBookingFeeBps(order);
  const quote = await calculateAuthoritativeRentalPrice({
    car,
    pickupAtUtc: order.pickupAtUtc || order.timeIn,
    returnAtUtc: order.returnAtUtc || order.timeOut,
    timezone: order.timezone,
    insurance: order.insurance,
    childSeats: order.ChildSeats ?? order.childSeats ?? 0,
    secondDriver: Boolean(order.secondDriver),
    placeIn: proposedLocation.pickup?.name || order.placeIn,
    placeOut: proposedLocation.return?.name || order.placeOut,
    placeInDetail: proposedLocation.pickup?.address || order.placeInDetail,
    placeOutDetail: proposedLocation.return?.address || order.placeOutDetail,
    carOffices: office.eligible,
    company,
    bookingMode: order.bookingMode,
    marketplaceBookingFeeBps: snapshotFee.bps,
    ignoreClientGeo: true,
    quotedPickupFeeMinor: fees.quotedPickupFeeMinor,
    quotedReturnFeeMinor: fees.quotedReturnFeeMinor,
  });
  const financials = resolveConfirmationFinancials(order);
  const cap = applyReplacementPriceCap({
    calculatedGrossMinor: quote.grossMinor,
    originalGrossMinor: financials.grossMinor,
    feeBps: snapshotFee.bps,
    fixedPaidPlatformAmountMinor: isMarketplaceFeePaid(order)
      ? paidPlatformAmountMinor(order)
      : undefined,
  });
  const originalCar = await loadOriginalCar(order);
  const originalTerms = extractTermsSlice({
    order,
    car: originalCar,
    company,
  });
  const proposedVehicle = buildCustomerVehicleSnapshot(car, { company });
  const proposedTerms = extractTermsSlice({
    order,
    car,
    company,
    vehicle: proposedVehicle,
  });
  const terms = compareMaterialRentalTerms(originalTerms, proposedTerms);
  const original = originalVehicleFromOrder(order, originalCar);
  const check = validateAlternativeNotWorse({
    original,
    alternative: {
      priceMinor: cap.offeredGrossMinor,
      category: proposedVehicle.category,
      transmission: proposedVehicle.transmission,
      seats: proposedVehicle.seats,
      luggage: proposedVehicle.luggage,
      photos: proposedVehicle.photos,
      reasonForReplacement: "preview",
    },
  });
  if (!check.ok && check.code !== "reason_required") {
    return { ok: false, status: 400, ...check };
  }

  const availability = await evaluateProposedAvailability({
    car,
    order,
    purpose: AVAILABILITY_PURPOSE.CONFIRM,
  });

  return {
    ok: true,
    proposedVehicle,
    proposedLocation,
    proposedTerms,
    originalTerms,
    terms,
    quote,
    cap,
    authoritativePrice: buildCappedAuthoritativePrice(quote, cap),
    availability,
    office,
  };
}

async function audit(action, extra = {}) {
  await recordAuditEvent({
    action,
    severity: extra.severity || "high",
    result: extra.result || "success",
    userRole: extra.userRole || "admin",
    userEmail: extra.userEmail || "",
    userId: extra.userId || undefined,
    ipAddress: extra.ipAddress || "",
    userAgent: extra.userAgent || "",
    reason: extra.reason || "",
    orderData: extra.orderData,
    metadata: extra.metadata,
    errorMessage: extra.errorMessage,
  });
}

async function releaseOwnUnpaidHold(order, reason) {
  if (isOrderPaid(order)) return;
  const released = await releaseMarketplaceHold(order._id, { reason }).catch(() => null);
  if (released?.hold) {
    await audit("ALTERNATIVE_HOLD_RELEASED", {
      userRole: "system",
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { reason, carId: released.hold.carId },
    });
  }
}

async function staleOriginalCheckout(order) {
  const pay = order.payment && typeof order.payment === "object" ? order.payment : {};
  if (pay.status === "paid") return;
  if (!pay.providerPaymentId && !pay.checkoutUrl) return;
  await expireRentalCheckoutSession(order._id).catch(() => {});
  const archived = archiveStripeSession(pay, {
    status: STRIPE_SESSION_ARCHIVE.REPLACED,
  });
  if (typeof order.set === "function") {
    order.set(
      "payment",
      {
        ...archived,
        providerPaymentId: "",
        checkoutUrl: "",
        status: pay.status === "paid" ? pay.status : "expired",
        staleBecause: "alternative_offered",
        lastCheckoutError: "",
      },
      { strict: false }
    );
  } else {
    order.payment = {
      ...archived,
      providerPaymentId: "",
      checkoutUrl: "",
      status: "expired",
      staleBecause: "alternative_offered",
    };
  }
}

/**
 * Preview or persist an alternative built from a stored car.
 * Caller-supplied totals, snapshots, currency and fees are ignored.
 */
export async function previewAlternativeOffer({
  orderId,
  proposedCarId,
  order: orderHint,
  actor,
}) {
  await connectToDB();
  const order = orderHint || (await Order.findById(orderId));
  const eligibility = evaluateAutomaticAlternativeEligibility(order, { actor });
  if (!eligibility.ok) return eligibility;

  const carId = String(proposedCarId || "").trim();
  if (!carId) {
    return {
      ok: false,
      status: 400,
      code: ALTERNATIVE_OFFER_CODE.CAR_REQUIRED,
      message: "An alternative must be a stored vehicle from this company's fleet",
    };
  }

  const car = await Car.findById(carId);
  const carCheck = assertProposedCarCompany({ car, order, proposedCarId: carId });
  if (!carCheck.ok) return carCheck;

  const company = await loadCompany(order);
  try {
    const built = await buildProposedQuote({ order, car, company });
    if (!built.ok) {
      return { ok: false, status: 400, ...built };
    }
    return {
      ok: true,
      orderId: String(order._id),
      proposedCarId: String(car._id),
      unpublished: car.isActive === false,
      ...built,
    };
  } catch (err) {
    return {
      ok: false,
      status: 400,
      code: err?.code || "pricing_failed",
      message: err?.message || "Could not price this alternative",
    };
  }
}

export async function listEligibleAlternativeCars({ orderId, actor }) {
  await connectToDB();
  const order = await Order.findById(orderId);
  const eligibility = evaluateAutomaticAlternativeEligibility(order, { actor });
  if (!eligibility.ok) return { ...eligibility, cars: [], excluded: [] };

  const company = await loadCompany(order);
  const originalCar = await loadOriginalCar(order);
  const fleet = await Car.find({ ownerId: order.ownerId });
  const eligible = [];
  const excluded = [];

  for (const car of fleet) {
    const carCheck = assertProposedCarCompany({ car, order, proposedCarId: car._id });
    if (!carCheck.ok) {
      excluded.push({
        carId: String(car._id),
        name: car.model,
        unpublished: car.isActive === false,
        ...publicExclusionReason(carCheck.code, carCheck.message),
      });
      continue;
    }
    try {
      const built = await buildProposedQuote({ order, car, company });
      if (!built.ok) {
        excluded.push({
          carId: String(car._id),
          name: car.model,
          category: car.class,
          unpublished: car.isActive === false,
          ...publicExclusionReason(built.code, built.message),
        });
        continue;
      }
      if (!built.availability?.ok) {
        excluded.push({
          carId: String(car._id),
          name: car.model,
          category: car.class,
          unpublished: car.isActive === false,
          ...publicExclusionReason(
            built.availability?.code,
            built.availability?.message || "This car is not available for the requested dates"
          ),
        });
        continue;
      }
      eligible.push({
        carId: String(car._id),
        carNumber: car.carNumber || "",
        name: [car.make, car.model].filter(Boolean).join(" ") || car.model,
        category: car.class,
        transmission: car.transmission,
        seats: car.seats,
        unpublished: car.isActive === false,
        photos: built.proposedVehicle.photos,
        cap: built.cap,
        termsChanged: built.terms.termsChanged,
        changedTerms: built.terms.changedTerms,
        availabilityRecheckedOnAccept: true,
        availabilityNote:
          "Final availability is rechecked when the customer accepts. No hold is created yet.",
      });
    } catch (err) {
      excluded.push({
        carId: String(car._id),
        name: car.model,
        unpublished: car.isActive === false,
        ...publicExclusionReason(err?.code, err?.message),
      });
    }
  }

  return {
    ok: true,
    originalCarId: originalCar ? String(originalCar._id) : String(order.car || ""),
    originalName: order.carModel || originalCar?.model || "",
    cars: eligible,
    excluded,
  };
}

/**
 * Create an offer. For a fleet car, also moves `order.car` onto that vehicle
 * immediately (same operational effect as calendar move-to-car).
 */
export async function offerAlternativeVehicle({
  orderId,
  alternative = {},
  proposedCarId,
  offeredByEmail = "",
  offeredByRole,
  offeredByUserId,
  actor,
  expiresInHours,
  session,
}) {
  await connectToDB();
  const order = await Order.findById(orderId);
  const resolvedActor = actor || actorFromSession(session) || {
    email: offeredByEmail,
    role: offeredByRole,
    userId: offeredByUserId,
  };

  if (order) {
    const offerGate = await assertPartnerCanOperate(order.ownerId, {
      purpose: PARTNER_OPERATION_PURPOSE.ALTERNATIVE,
      overrideReason: resolvedActor.isSuperadmin
        ? String(alternative.complianceOverrideReason || "")
        : "",
      overrideByRole: resolvedActor.isSuperadmin ? "superadmin" : "admin",
      overrideByEmail: resolvedActor.email || "",
      audit: { orderId: order._id },
    });
    if (!offerGate.allowed) {
      await auditPartnerComplianceBlock({
        purpose: PARTNER_OPERATION_PURPOSE.ALTERNATIVE,
        result: offerGate,
        actorEmail: resolvedActor.email || "",
        actorRole: resolvedActor.isSuperadmin ? "superadmin" : "admin",
        orderId: order._id,
      });
      return {
        ok: false,
        status: 403,
        error: offerGate.error,
        code: offerGate.code,
        message: offerGate.partnerMessage,
      };
    }
  }

  const eligibility = evaluateAutomaticAlternativeEligibility(order, {
    actor: resolvedActor,
  });
  if (!eligibility.ok) {
    await audit("ALTERNATIVE_OFFER_REJECTED", {
      result: "failure",
      userEmail: resolvedActor.email,
      userRole: resolvedActor.isSuperadmin ? "superadmin" : "admin",
      orderData: order
        ? { orderId: order._id, orderNumber: order.orderNumber }
        : undefined,
      metadata: { code: eligibility.code },
      errorMessage: eligibility.message,
    });
    return eligibility;
  }

  const carId = String(proposedCarId || alternative.carId || "").trim();
  if (!carId) {
    return {
      ok: false,
      status: 400,
      code: ALTERNATIVE_OFFER_CODE.CAR_REQUIRED,
      message: "An alternative must be a stored vehicle from this company's fleet",
    };
  }

  const reasonCheck = sanitizeReason(
    alternative.reasonForReplacement || alternative.reason,
    { required: true }
  );
  if (!reasonCheck.ok) return { ok: false, status: 400, ...reasonCheck };

  const existing = await AlternativeVehicleOffer.findOne({
    orderId: order._id,
    status: "OFFERED",
    expiresAt: { $gt: new Date() },
  }).lean();
  if (existing) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.ACTIVE_OFFER_EXISTS,
      message: "This booking already has an active alternative offer",
      offerId: existing.offerId,
    };
  }

  const preview = await previewAlternativeOffer({
    orderId,
    proposedCarId: carId,
    order,
    actor: resolvedActor,
  });
  if (!preview.ok) {
    await audit("ALTERNATIVE_OFFER_REJECTED", {
      result: "failure",
      userEmail: resolvedActor.email,
      userRole: resolvedActor.isSuperadmin ? "superadmin" : "admin",
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { code: preview.code, proposedCarId: carId },
      errorMessage: preview.message,
    });
    return preview;
  }

  const settings = await loadLegalSettings();
  const hours =
    Number(expiresInHours) > 0
      ? Number(expiresInHours)
      : settings.alternativeOfferExpirationHours;
  const offerId = generateOfferId();
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  const originalRequest = buildOriginalRequestSnapshot({
    order,
    car: await loadOriginalCar(order),
    company: await loadCompany(order),
  });
  const checksum = buildOfferChecksum(
    buildOfferChecksumPayload({
      orderId: order._id,
      offerId,
      proposedCarId: carId,
      originalCarId: originalRequest.carId,
      offeredGrossMinor: preview.cap.offeredGrossMinor,
      calculatedGrossMinor: preview.cap.calculatedGrossMinor,
      replacementDiscountMinor: preview.cap.replacementDiscountMinor,
      prepaymentMinor: preview.cap.prepaymentMinor,
      currency: "EUR",
      locationSnapshot: preview.proposedLocation,
      termsHash: preview.proposedTerms.hash,
      expiresAt,
    })
  );

  let offer;
  try {
    offer = await AlternativeVehicleOffer.create({
      offerId,
      orderId: order._id,
      companyId: order.ownerId || null,
      proposedCarId: carId,
      originalCarId: originalRequest.carId,
      vehicle: {
        carId,
        make: preview.proposedVehicle.make,
        model: preview.proposedVehicle.model || "Alternative",
        category: preview.proposedVehicle.category,
        transmission: preview.proposedVehicle.transmission,
        seats: preview.proposedVehicle.seats,
        luggage: preview.proposedVehicle.luggage,
        doors: preview.proposedVehicle.doors,
        fuel: preview.proposedVehicle.fuel,
        year: preview.proposedVehicle.year,
        modelGroup: preview.proposedVehicle.modelGroup,
        photos: preview.proposedVehicle.photos,
        mileagePolicy: preview.proposedVehicle.mileagePolicy,
        fuelPolicy: preview.proposedVehicle.fuelPolicy,
        insuranceExcessMajor: preview.proposedVehicle.insuranceExcessMajor,
        securityDepositMajor: preview.proposedVehicle.securityDepositMajor,
      },
      priceMinor: preview.cap.offeredGrossMinor,
      currency: "EUR",
      originalPriceMinor: preview.cap.originalGrossMinor,
      depositMinor:
        preview.proposedVehicle.securityDepositMajor == null
          ? null
          : Math.round(Number(preview.proposedVehicle.securityDepositMajor) * 100),
      insurance: order.insurance || "",
      pickup: {
        atUtc: order.pickupAtUtc || order.timeIn || null,
        place: preview.proposedLocation.pickup?.name || order.placeIn || "",
        detail: preview.proposedLocation.pickup?.address || order.placeInDetail || "",
      },
      reasonForReplacement: reasonCheck.reason,
      expiresAt,
      offeredByEmail: offeredByEmail || resolvedActor.email || "",
      afterPayment: false,
      originalRequest,
      proposedLocationSnapshot: preview.proposedLocation,
      proposedAuthoritativePrice: preview.authoritativePrice,
      calculatedAlternativeGrossMinor: preview.cap.calculatedGrossMinor,
      replacementDiscountMinor: preview.cap.replacementDiscountMinor,
      offeredGrossMinor: preview.cap.offeredGrossMinor,
      marketplaceBookingFeeBps: preview.cap.marketplaceBookingFeeBps,
      prepaymentMinor: preview.cap.prepaymentMinor,
      balanceMinor: preview.cap.balanceMinor,
      snapshotChecksum: checksum,
      termsChanged: preview.terms.termsChanged,
      changedTerms: preview.terms.changedTerms,
      originalTermsHash: preview.terms.originalTermsHash,
      proposedTermsHash: preview.terms.proposedTermsHash,
      availabilityNote:
        "Final availability is rechecked when the customer accepts. No hold is created yet.",
    });
  } catch (err) {
    if (err?.code === 11000) {
      return {
        ok: false,
        status: 409,
        code: ALTERNATIVE_OFFER_CODE.ACTIVE_OFFER_EXISTS,
        message: "This booking already has an active alternative offer",
      };
    }
    throw err;
  }

  await releaseOwnUnpaidHold(order, "alternative_offered");
  await staleOriginalCheckout(order);

  const state = resolveRentalState(order);
  if (state !== RENTAL_STATE.ALTERNATIVE_OFFERED) {
    const moved = applyRentalStateTransition(order, RENTAL_STATE.ALTERNATIVE_OFFERED);
    if (!moved.ok) {
      await AlternativeVehicleOffer.updateOne(
        { offerId, status: "OFFERED" },
        {
          $set: {
            status: "WITHDRAWN",
            decidedAt: new Date(),
            declineReason: "illegal_transition",
          },
        }
      ).catch(() => {});
      return {
        ok: false,
        status: 409,
        code: ALTERNATIVE_OFFER_CODE.INVALID_STATE,
        message: `Cannot offer an alternative while the booking is ${moved.from || state}`,
      };
    }
  }
  if (!order.originalRequestSnapshot) {
    if (typeof order.set === "function") {
      order.set("originalRequestSnapshot", originalRequest, { strict: false });
    } else {
      order.originalRequestSnapshot = originalRequest;
    }
  }
  // Calendar-parity: booking sits on the replacement car while the customer decides.
  const proposedCarDoc = await Car.findById(carId);
  if (proposedCarDoc) {
    order.car = proposedCarDoc._id;
    order.carNumber = proposedCarDoc.carNumber;
    const label = [proposedCarDoc.make, proposedCarDoc.model]
      .filter(Boolean)
      .join(" ");
    if (label) order.carModel = label;
    if (proposedCarDoc.regNumber) order.regNumber = proposedCarDoc.regNumber;
  }
  await order.save();

  await audit("ALTERNATIVE_OFFER_CREATED", {
    userEmail: offeredByEmail || resolvedActor.email,
    userRole: resolvedActor.isSuperadmin ? "superadmin" : "admin",
    userId: resolvedActor.userId,
    orderData: { orderId: order._id, orderNumber: order.orderNumber },
    metadata: {
      offerId,
      proposedCarId: carId,
      originalCarId: originalRequest.carId,
      offeredGrossMinor: preview.cap.offeredGrossMinor,
      replacementDiscountMinor: preview.cap.replacementDiscountMinor,
      termsChanged: preview.terms.termsChanged,
      reason: reasonCheck.reason,
    },
  });

  const mailed = await sendAlternativeOfferedEmail({
    order: order.toObject ? order.toObject() : order,
    offer: offer.toObject ? offer.toObject() : offer,
  }).catch((err) => ({ ok: false, message: err?.message || String(err) }));

  return {
    ok: true,
    offerId,
    offer: offer.toObject(),
    email: mailed,
    holdCreated: false,
    stripeCreated: false,
  };
}

/**
 * Equivalent replacement when the exact car is unlisted or not yet known.
 * Does not confirm the booking and does not create Stripe.
 */
export async function offerUnlistedEquivalent({
  orderId,
  proposal = {},
  actor,
  session,
  expiresInHours,
}) {
  await connectToDB();
  const { evaluateEquivalentReplacement, REPLACEMENT_SOURCE } = await import(
    "@/domain/booking/equivalentReplacement"
  );
  const order = await Order.findById(orderId);
  const resolvedActor = actor || actorFromSession(session) || {};
  const eligibility = evaluateAutomaticAlternativeEligibility(order, { actor: resolvedActor });
  if (!eligibility.ok) return eligibility;

  const originalCar = await loadOriginalCar(order);
  const original = {
    carId: originalCar?._id,
    model: order.carModel || originalCar?.model,
    category: originalCar?.class,
    transmission: originalCar?.transmission,
    seats: originalCar?.seats,
    luggage: originalCar?.luggageCapacity ?? originalCar?.luggage,
    fuel: originalCar?.fueltype,
    totalPrice: order.totalPrice,
    rentalStartDate: order.rentalStartDate,
    rentalEndDate: order.rentalEndDate,
    placeIn: order.placeIn,
    placeOut: order.placeOut,
  };
  const check = evaluateEquivalentReplacement({ original, proposal });
  if (!check.ok) return { ok: false, status: 400, ...check };

  const reasonCheck = sanitizeReason(proposal.supplierMessage || proposal.reason, { required: true });
  if (!reasonCheck.ok) return { ok: false, status: 400, ...reasonCheck };

  const existing = await AlternativeVehicleOffer.findOne({
    orderId: order._id,
    status: "OFFERED",
    expiresAt: { $gt: new Date() },
  }).lean();
  if (existing) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.ACTIVE_OFFER_EXISTS,
      message: "This booking already has an active alternative offer",
      offerId: existing.offerId,
    };
  }

  const settings = await loadLegalSettings();
  const hours = Number(expiresInHours) > 0 ? Number(expiresInHours) : settings.alternativeOfferExpirationHours;
  const offerId = generateOfferId();
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  const originalRequest = buildOriginalRequestSnapshot({
    order,
    car: originalCar,
    company: await loadCompany(order),
  });
  const grossMinor =
    Number(order.authoritativePrice?.grossMinor) || Math.round(Number(order.totalPrice) * 100);
  const feeBps = Number(order.marketplaceBookingFeeBps) || 1000;
  const prepaymentMinor = Math.round((grossMinor * feeBps) / 10000);
  const model =
    check.snapshot.replacementSource === REPLACEMENT_SOURCE.GUARANTEED_CLASS
      ? "Guaranteed same or higher class"
      : check.snapshot.replacement.model;

  const offer = await AlternativeVehicleOffer.create({
    offerId,
    orderId: order._id,
    companyId: order.ownerId,
    proposedCarId: null,
    originalCarId: originalRequest.carId || null,
    replacementSource: check.snapshot.replacementSource,
    supplierMessage: reasonCheck.reason,
    createdBy: resolvedActor.userId || resolvedActor.email || "",
    vehicle: {
      make: check.snapshot.replacement.make,
      model,
      category: check.snapshot.replacement.class,
      transmission: check.snapshot.replacement.transmission,
      seats: check.snapshot.replacement.seats,
      luggage: check.snapshot.replacement.luggage,
      fuel: check.snapshot.replacement.fuel,
    },
    priceMinor: grossMinor,
    currency: "EUR",
    originalPriceMinor: grossMinor,
    reasonForReplacement: reasonCheck.reason,
    expiresAt,
    offeredByEmail: resolvedActor.email || "",
    afterPayment: false,
    originalRequest,
    prepaymentMinor,
    balanceMinor: grossMinor - prepaymentMinor,
    snapshotChecksum: check.snapshot.checksum,
    termsChanged: false,
  });

  const moved = applyRentalStateTransition(order, RENTAL_STATE.ALTERNATIVE_OFFERED);
  if (!moved.ok) {
    await AlternativeVehicleOffer.deleteOne({ offerId });
    return { ok: false, status: 409, code: ALTERNATIVE_OFFER_CODE.INVALID_STATE, message: moved.message };
  }
  await order.save();

  const mailed = await sendAlternativeOfferedEmail({
    order: order.toObject ? order.toObject() : order,
    offer: offer.toObject ? offer.toObject() : offer,
  }).catch((err) => ({ ok: false, message: err?.message || String(err) }));

  return {
    ok: true,
    offerId,
    offer: offer.toObject(),
    email: mailed,
    holdCreated: false,
    stripeCreated: false,
    paymentStatus: "unpaid",
  };
}

function decisionIdempotent(existing) {
  return {
    ok: true,
    idempotent: true,
    status: existing.status,
    afterPayment: Boolean(existing.afterPayment),
    message: `This offer was already ${String(existing.status).toLowerCase()}`,
    offerId: existing.offerId,
    paymentUrl: existing.checkoutUrl || "",
    paymentLinkGenerationFailed: Boolean(existing.paymentLinkGenerationFailed),
  };
}

async function reopenOrderForAnotherOffer(order) {
  const state = resolveRentalState(order);
  if (state === RENTAL_STATE.ALTERNATIVE_OFFERED) {
    applyRentalStateTransition(order, RENTAL_STATE.ALTERNATIVE_DECLINED);
  } else if (state !== RENTAL_STATE.ALTERNATIVE_DECLINED) {
    order.bookingStatus = BOOKING_STATUS.NO_AVAILABILITY;
  }
  await order.save();
}

async function acceptDisclosedReplacement({ offer, order, now, ipAddress, userAgent }) {
  const disclosure = equivalentReplacementDisclosure({
    vehicle: order.carModel || "vehicle",
    transmission: offer.vehicle?.transmission || "the same",
    seats: offer.vehicle?.seats ?? "the booked",
  });
  const casOffer = await AlternativeVehicleOffer.findOneAndUpdate(
    { offerId: offer.offerId, status: "OFFERED", expiresAt: { $gt: now } },
    {
      $set: {
        status: "ACCEPTED",
        decidedAt: now,
        decisionIp: ipAddress,
        decisionUserAgent: userAgent,
      },
    },
    { new: true }
  );
  if (!casOffer) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.NOT_DECIDABLE,
      message: "This offer can no longer be accepted",
    };
  }

  const casOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      bookingStatus: {
        $in: [
          BOOKING_STATUS.ALTERNATIVE_PROPOSED,
          BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
          BOOKING_STATUS.NO_AVAILABILITY,
        ],
      },
    },
    {
      $set: {
        carModel: casOffer.vehicle?.model || order.carModel,
        bookingStatus: RENTAL_STATE_TO_BOOKING_STATUS[RENTAL_STATE.ALTERNATIVE_ACCEPTED],
        acceptedAlternativeOfferId: casOffer.offerId,
        pendingReplacementProposal: {
          offerId: casOffer.offerId,
          checksum: casOffer.snapshotChecksum,
          version: 1,
        },
        replacementDisclosure: disclosure,
      },
    },
    { new: true }
  );
  if (!casOrder) {
    await AlternativeVehicleOffer.updateOne(
      { offerId: casOffer.offerId, status: "ACCEPTED" },
      { $set: { status: "OFFERED", decidedAt: null } }
    ).catch(() => {});
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.INVALID_STATE,
      message: "This booking can no longer accept an alternative",
    };
  }

  await staleOriginalCheckout(casOrder);
  const checkout = await createRentalCheckoutSession(String(casOrder._id), {
    forceNew: true,
    emailCustomer: false,
  });
  if (!checkout.ok || !checkout.url) {
    return {
      ok: true,
      status: "ACCEPTED",
      paymentLinkGenerationFailed: true,
      paymentUrl: "",
      holdCreated: false,
      stripeCreated: false,
      orderId: String(casOrder._id),
      message: "The replacement was accepted but the payment link could not be created.",
    };
  }

  await AlternativeVehicleOffer.updateOne(
    { offerId: casOffer.offerId },
    { $set: { stripeSessionId: checkout.sessionId || "", checkoutUrl: checkout.url } }
  );
  return {
    ok: true,
    status: "ACCEPTED",
    paymentUrl: checkout.url,
    holdCreated: false,
    stripeCreated: true,
    bookingConfirmed: false,
    orderId: String(casOrder._id),
  };
}

/**
 * Customer decision on an offer.
 */
export async function decideAlternativeVehicle({
  offerId,
  accept,
  ipAddress = "",
  userAgent = "",
  declineReason = "",
  termsAccepted = false,
}) {
  await connectToDB();
  const now = new Date();
  const capabilityId = normalizeOfferCapabilityId(offerId);
  if (!capabilityId) {
    return {
      ok: false,
      status: 404,
      code: ALTERNATIVE_OFFER_CODE.NOT_FOUND,
      message: "Offer not found",
    };
  }
  const existing = await AlternativeVehicleOffer.findOne({ offerId: capabilityId });
  if (!existing) {
    return {
      ok: false,
      status: 404,
      code: ALTERNATIVE_OFFER_CODE.NOT_FOUND,
      message: "Offer not found",
    };
  }

  if (existing.status !== "OFFERED") {
    if (accept && existing.status === "ACCEPTED") {
      return replayAcceptedOffer(existing, { ipAddress, userAgent });
    }
    if (!accept && existing.status === "DECLINED") {
      return decisionIdempotent(existing.toObject ? existing.toObject() : existing);
    }
    if (existing.status === "EXPIRED" || (existing.expiresAt && existing.expiresAt <= now && existing.status === "OFFERED")) {
      return {
        ok: false,
        status: 410,
        code: ALTERNATIVE_OFFER_CODE.EXPIRED,
        message: "This offer has expired",
      };
    }
    if (existing.status === "WITHDRAWN") {
      return {
        ok: false,
        status: 409,
        code: ALTERNATIVE_OFFER_CODE.WITHDRAWN,
        message: "This offer was withdrawn",
      };
    }
    return decisionIdempotent(existing.toObject ? existing.toObject() : existing);
  }

  if (existing.expiresAt && existing.expiresAt <= now) {
    await AlternativeVehicleOffer.updateOne(
      { offerId: capabilityId, status: "OFFERED" },
      { $set: { status: "EXPIRED" } }
    ).catch(() => {});
    const order = await Order.findById(existing.orderId);
    if (order) await reopenOrderForAnotherOffer(order);
    return {
      ok: false,
      status: 410,
      code: ALTERNATIVE_OFFER_CODE.EXPIRED,
      message: "This offer has expired",
    };
  }

  if (!accept) {
    return declineAlternativeOffer({
      offer: existing,
      ipAddress,
      userAgent,
      declineReason,
    });
  }

  const orderForGate = await Order.findById(existing.orderId);
  const acceptGate = await assertPartnerCanOperate(orderForGate?.ownerId, {
    purpose: PARTNER_OPERATION_PURPOSE.ALTERNATIVE,
  });
  if (!acceptGate.allowed) {
    await auditPartnerComplianceBlock({
      purpose: PARTNER_OPERATION_PURPOSE.ALTERNATIVE,
      result: acceptGate,
      actorRole: "system",
      ipAddress,
      userAgent,
      orderId: existing.orderId,
    });
    return {
      ok: false,
      status: 404,
      code: ALTERNATIVE_OFFER_CODE.NOT_FOUND,
      message: "Offer not found",
    };
  }

  return acceptAlternativeOffer({
    offer: existing,
    ipAddress,
    userAgent,
    termsAccepted,
  });
}

async function declineAlternativeOffer({
  offer,
  ipAddress,
  userAgent,
  declineReason,
}) {
  const now = new Date();
  const updated = await AlternativeVehicleOffer.findOneAndUpdate(
    { offerId: offer.offerId, status: "OFFERED", expiresAt: { $gt: now } },
    {
      $set: {
        status: "DECLINED",
        decidedAt: now,
        decisionIp: ipAddress,
        decisionUserAgent: userAgent,
        declineReason: String(declineReason || "").slice(0, 500),
      },
    },
    { new: true }
  );
  if (!updated) {
    const latest = await AlternativeVehicleOffer.findOne({ offerId: offer.offerId }).lean();
    if (latest?.status === "DECLINED") return decisionIdempotent(latest);
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.NOT_DECIDABLE,
      message: "This offer can no longer be declined",
    };
  }

  const order = await Order.findById(updated.orderId);
  if (order) await reopenOrderForAnotherOffer(order);

  await audit("ALTERNATIVE_OFFER_DECLINED", {
    ipAddress,
    userAgent,
    reason: declineReason,
    orderData: order
      ? { orderId: order._id, orderNumber: order.orderNumber }
      : { orderId: updated.orderId },
    metadata: { offerId: updated.offerId, afterPayment: false },
  });

  if (order) {
    await sendAlternativeDeclinedNotice({
      order: order.toObject ? order.toObject() : order,
      offer: updated.toObject ? updated.toObject() : updated,
    }).catch(() => {});
  }

  return {
    ok: true,
    idempotent: false,
    status: "DECLINED",
    refundRequired: false,
    holdCreated: false,
    stripeCreated: false,
    orderId: order ? String(order._id) : String(updated.orderId),
  };
}

async function acceptAlternativeOffer({
  offer,
  ipAddress,
  userAgent,
  termsAccepted,
}) {
  const now = new Date();
  if (offer.termsChanged && termsAccepted !== true) {
    return {
      ok: false,
      status: 400,
      code: ALTERNATIVE_OFFER_CODE.TERMS_CONSENT_REQUIRED,
      message: "You must accept the changed rental conditions to continue with this car",
    };
  }

  const checksum = verifyOfferChecksum(offer.toObject ? offer.toObject() : offer);
  if (!checksum.ok) return { ok: false, status: 409, ...checksum };

  const order = await Order.findById(offer.orderId);
  if (!order) {
    return {
      ok: false,
      status: 404,
      code: ALTERNATIVE_OFFER_CODE.NOT_FOUND,
      message: "Booking not found",
    };
  }
  const eligibility = evaluateAutomaticAlternativeEligibility(order, {
    actor: { role: ROLE.SUPERADMIN, isSuperadmin: true, ownerId: order.ownerId },
  });
  if (!eligibility.ok) return eligibility;

  const orderCompany = order.ownerId ? String(order.ownerId) : "";
  const offerCompany = offer.companyId ? String(offer.companyId) : "";
  if (offerCompany && orderCompany && offerCompany !== orderCompany) {
    return {
      ok: false,
      status: 403,
      code: ALTERNATIVE_OFFER_CODE.WRONG_COMPANY_ORDER,
      message: "This offer does not belong to the booking's rental company",
    };
  }

  if (
    !offer.proposedCarId &&
    (offer.replacementSource === "EXTERNAL_VEHICLE" ||
      offer.replacementSource === "GUARANTEED_CLASS")
  ) {
    return acceptDisclosedReplacement({ offer, order, now, ipAddress, userAgent });
  }

  const car = await Car.findById(offer.proposedCarId || offer.vehicle?.carId);
  const carCheck = assertProposedCarCompany({
    car,
    order,
    proposedCarId: offer.proposedCarId || offer.vehicle?.carId,
  });
  if (!carCheck.ok) return carCheck;

  const availability = await evaluateProposedAvailability({ car, order });
  if (!availability.ok) {
    await audit("ALTERNATIVE_OFFER_AVAILABILITY_FAILED", {
      result: "failure",
      ipAddress,
      userAgent,
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { offerId: offer.offerId, code: availability.code },
      errorMessage: availability.message,
    });
    return { ok: false, status: 409, ...availability };
  }

  const settings = await loadLegalSettings().catch(() => ({
    paymentLinkExpirationMinutes: 60,
  }));
  const expireMinutes = clampStripeExpiresMinutes(
    settings.paymentLinkExpirationMinutes
  );
  const holdExpiresAt = new Date(now.getTime() + expireMinutes * 60 * 1000);

  const hold = await acquireMarketplaceHold({
    carId: car._id,
    orderId: order._id,
    companyId: order.ownerId,
    pickupAtUtc: order.pickupAtUtc || order.timeIn,
    returnAtUtc: order.returnAtUtc || order.timeOut,
    holdExpiresAt,
    timezone: order.timezone,
    bookingMode: order.bookingMode,
    offerId: offer.offerId,
  });
  if (!hold.ok) {
    await audit("BOOKING_HOLD_CONFLICT", {
      result: "failure",
      ipAddress,
      userAgent,
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { offerId: offer.offerId, code: hold.code, proposedCarId: String(car._id) },
      errorMessage: hold.message,
    });
    return {
      ok: false,
      status: 409,
      code: hold.code || ALTERNATIVE_OFFER_CODE.HOLD_CONFLICT,
      message: hold.message || "Those dates are not available for this car",
    };
  }

  const casOffer = await AlternativeVehicleOffer.findOneAndUpdate(
    {
      offerId: offer.offerId,
      status: "OFFERED",
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: "ACCEPTED",
        decidedAt: now,
        decisionIp: ipAddress,
        decisionUserAgent: userAgent,
        termsConsent: offer.termsChanged
          ? {
              accepted: true,
              acceptedAt: now,
              termsHash: offer.proposedTermsHash,
              originalTermsHash: offer.originalTermsHash,
              ipAddress,
              userAgent,
            }
          : {
              accepted: false,
              required: false,
              recordedAt: now,
              termsHash: offer.proposedTermsHash,
              ipAddress,
              userAgent,
            },
        acceptedHoldId: hold.hold?._id ? String(hold.hold._id) : "",
      },
    },
    { new: true }
  );

  if (!casOffer) {
    const latest = await AlternativeVehicleOffer.findOne({ offerId: offer.offerId });
    if (latest?.status === "ACCEPTED") {
      return replayAcceptedOffer(latest, { ipAddress, userAgent });
    }
    await restoreMarketplaceHoldAfterFailedAcquire({
      orderId: order._id,
      previousHold: hold.previousHold,
      reason: "alternative_cas_lost",
    });
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.NOT_DECIDABLE,
      message: "This offer can no longer be accepted",
    };
  }

  await AlternativeVehicleOffer.updateMany(
    {
      orderId: order._id,
      offerId: { $ne: offer.offerId },
      status: "OFFERED",
    },
    { $set: { status: "WITHDRAWN", decidedAt: now, declineReason: "superseded_by_acceptance" } }
  ).catch(() => {});

  const originalRequest =
    order.originalRequestSnapshot ||
    casOffer.originalRequest ||
    buildOriginalRequestSnapshot({
      order,
      car: await loadOriginalCar(order),
      company: await loadCompany(order),
    });

  const casOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      bookingStatus: {
        $in: [
          BOOKING_STATUS.ALTERNATIVE_PROPOSED,
          BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
          BOOKING_STATUS.NO_AVAILABILITY,
        ],
      },
      $or: [
        { payment: null },
        { payment: { $exists: false } },
        { "payment.status": { $nin: ["paid", "succeeded"] } },
      ],
    },
    {
      $set: {
        car: car._id,
        carNumber: car.carNumber,
        carModel: car.model,
        regNumber: car.regNumber || "",
        locationSnapshot: casOffer.proposedLocationSnapshot,
        authoritativePrice: casOffer.proposedAuthoritativePrice,
        totalPrice: fromMinorUnits(casOffer.offeredGrossMinor ?? casOffer.priceMinor, "EUR"),
        bookingStatus:
          RENTAL_STATE_TO_BOOKING_STATUS[RENTAL_STATE.ALTERNATIVE_ACCEPTED],
        originalRequestSnapshot: originalRequest,
        acceptedAlternativeOfferId: casOffer.offerId,
        pendingReplacementProposal: {
          offerId: casOffer.offerId,
          checksum: casOffer.snapshotChecksum,
          version: 1,
        },
        replacementDisclosure: equivalentReplacementDisclosure({
          vehicle: order.carModel || "vehicle",
          transmission: casOffer.vehicle?.transmission || "the same",
          seats: casOffer.vehicle?.seats ?? "the booked",
        }),
        franchiseOrder:
          car.franchise != null ? car.franchise : order.franchiseOrder,
        deposit: car.deposit != null ? car.deposit : order.deposit,
      },
    },
    { new: true }
  );

  if (!casOrder) {
    await AlternativeVehicleOffer.updateOne(
      { offerId: casOffer.offerId, status: "ACCEPTED" },
      { $set: { status: "OFFERED", decidedAt: null, acceptedHoldId: "" } }
    ).catch(() => {});
    await restoreMarketplaceHoldAfterFailedAcquire({
      orderId: order._id,
      previousHold: hold.previousHold,
      reason: "alternative_order_update_failed",
    });
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.INVALID_STATE,
      message: "This booking can no longer accept an alternative",
    };
  }

  await audit("ALTERNATIVE_HOLD_ACQUIRED", {
    userRole: "system",
    ipAddress,
    userAgent,
    orderData: { orderId: casOrder._id, orderNumber: casOrder.orderNumber },
    metadata: {
      offerId: casOffer.offerId,
      carId: String(car._id),
      originalCarId: originalRequest.carId,
    },
  });

  if (casOffer.termsChanged) {
    await audit("ALTERNATIVE_TERMS_REACCEPTED", {
      ipAddress,
      userAgent,
      orderData: { orderId: casOrder._id, orderNumber: casOrder.orderNumber },
      metadata: {
        offerId: casOffer.offerId,
        proposedTermsHash: casOffer.proposedTermsHash,
        originalTermsHash: casOffer.originalTermsHash,
      },
    });
  }

  await staleOriginalCheckout(casOrder);
  await casOrder.save().catch(() => {});

  const checkout = await createRentalCheckoutSession(String(casOrder._id), {
    forceNew: true,
    emailCustomer: false,
  });

  if (!checkout.ok || !checkout.url) {
    await markHoldForRetry(casOrder._id, {
      reason: checkout.code || "alternative_checkout_failed",
    });
    await AlternativeVehicleOffer.updateOne(
      { offerId: casOffer.offerId },
      {
        $set: {
          paymentLinkGenerationFailed: true,
          stripeSessionId: "",
        },
      }
    );
    await casOrder.save().catch(() => {});
    await audit("ALTERNATIVE_CHECKOUT_FAILED", {
      severity: "critical",
      result: "failure",
      ipAddress,
      userAgent,
      orderData: { orderId: casOrder._id, orderNumber: casOrder.orderNumber },
      metadata: { offerId: casOffer.offerId, code: checkout.code },
      errorMessage: checkout.message,
    });
    await notifySuperadmin({
      title: `⚠️ Alternative accepted but payment link failed — #${casOrder.orderNumber || casOrder._id}`,
      bodyLines: [
        checkout.message || checkout.code || "Checkout failed",
        `Offer ${casOffer.offerId}`,
        "Hold is preserved for retry. No customer payment email was sent.",
      ],
      meta: { orderId: casOrder._id, offerId: casOffer.offerId },
    }).catch(() => {});

    await sendAlternativeAcceptedNotice({
      order: casOrder.toObject ? casOrder.toObject() : casOrder,
      offer: casOffer.toObject ? casOffer.toObject() : casOffer,
    }).catch(() => {});

    return {
      ok: true,
      status: "ACCEPTED",
      paymentLinkGenerationFailed: true,
      paymentUrl: "",
      holdCreated: true,
      proposedCarId: String(car._id),
      originalCarId: originalRequest.carId,
      orderId: String(casOrder._id),
      message:
        "The replacement was accepted but the payment link could not be created. Rovaro has been notified.",
    };
  }

  await AlternativeVehicleOffer.updateOne(
    { offerId: casOffer.offerId },
    {
      $set: {
        stripeSessionId: checkout.sessionId || "",
        checkoutUrl: checkout.url || "",
        paymentLinkGenerationFailed: false,
      },
    }
  );

  const mailed = await sendAlternativePaymentLinkEmail({
    order: casOrder.toObject ? casOrder.toObject() : casOrder,
    offer: { ...casOffer.toObject(), checkoutUrl: checkout.url },
    paymentUrl: checkout.url,
    expiresAt: checkout.expiresAt,
    stripeSessionId: checkout.sessionId,
  }).catch((err) => ({ ok: false, message: err?.message || String(err) }));

  await sendAlternativeAcceptedNotice({
    order: casOrder.toObject ? casOrder.toObject() : casOrder,
    offer: casOffer.toObject ? casOffer.toObject() : casOffer,
  }).catch(() => {});

  await audit("ALTERNATIVE_OFFER_ACCEPTED", {
    ipAddress,
    userAgent,
    orderData: { orderId: casOrder._id, orderNumber: casOrder.orderNumber },
    metadata: {
      offerId: casOffer.offerId,
      proposedCarId: String(car._id),
      originalCarId: originalRequest.carId,
      stripeSessionId: checkout.sessionId,
      prepaymentMinor: casOffer.prepaymentMinor,
      emailFailed: mailed?.ok === false,
    },
  });

  return {
    ok: true,
    idempotent: false,
    status: "ACCEPTED",
    refundRequired: false,
    holdCreated: true,
    stripeCreated: true,
    paymentUrl: checkout.url,
    paymentExpiresAt: checkout.expiresAt || null,
    proposedCarId: String(car._id),
    originalCarId: originalRequest.carId,
    orderId: String(casOrder._id),
    email: mailed,
  };
}

async function replayAcceptedOffer(offer, { ipAddress, userAgent } = {}) {
  const order = await Order.findById(offer.orderId);
  if (offer.paymentLinkGenerationFailed || !offer.checkoutUrl) {
    const checkout = await createRentalCheckoutSession(String(offer.orderId), {
      forceNew: false,
      emailCustomer: false,
    });
    if (checkout.ok && checkout.url) {
      await AlternativeVehicleOffer.updateOne(
        { offerId: offer.offerId },
        {
          $set: {
            stripeSessionId: checkout.sessionId || "",
            checkoutUrl: checkout.url,
            paymentLinkGenerationFailed: false,
          },
        }
      );
      return {
        ok: true,
        idempotent: true,
        status: "ACCEPTED",
        paymentUrl: checkout.url,
        holdCreated: true,
        stripeCreated: !checkout.reused,
        orderId: String(offer.orderId),
      };
    }
  }
  return {
    ok: true,
    idempotent: true,
    status: "ACCEPTED",
    paymentUrl: offer.checkoutUrl || order?.payment?.checkoutUrl || "",
    paymentLinkGenerationFailed: Boolean(offer.paymentLinkGenerationFailed),
    holdCreated: true,
    orderId: String(offer.orderId),
    ipAddress,
    userAgent,
  };
}

export async function withdrawAlternativeOffer({
  offerId,
  orderId,
  reason,
  actor,
  ipAddress = "",
  userAgent = "",
}) {
  await connectToDB();
  const reasonCheck = sanitizeReason(reason, { required: true, max: 500 });
  if (!reasonCheck.ok) return { ok: false, status: 400, ...reasonCheck };

  const offer = await AlternativeVehicleOffer.findOne({
    offerId,
    ...(orderId ? { orderId } : {}),
  });
  if (!offer) {
    return {
      ok: false,
      status: 404,
      code: ALTERNATIVE_OFFER_CODE.NOT_FOUND,
      message: "Offer not found",
    };
  }
  const order = await Order.findById(offer.orderId);
  const eligibility = evaluateAutomaticAlternativeEligibility(order, { actor });
  if (!eligibility.ok && eligibility.code !== ALTERNATIVE_OFFER_CODE.INVALID_STATE) {
    return eligibility;
  }
  if (offer.status !== "OFFERED") {
    if (offer.status === "WITHDRAWN") {
      return decisionIdempotent(offer.toObject ? offer.toObject() : offer);
    }
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.NOT_DECIDABLE,
      message: "Only an open offer can be withdrawn",
    };
  }

  const now = new Date();
  const updated = await AlternativeVehicleOffer.findOneAndUpdate(
    { offerId: offer.offerId, status: "OFFERED" },
    {
      $set: {
        status: "WITHDRAWN",
        decidedAt: now,
        declineReason: reasonCheck.reason,
        withdrawnByEmail: actor?.email || "",
      },
    },
    { new: true }
  );
  if (!updated) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.NOT_DECIDABLE,
      message: "This offer can no longer be withdrawn",
    };
  }
  if (order) await reopenOrderForAnotherOffer(order);

  await audit("ALTERNATIVE_OFFER_WITHDRAWN", {
    userEmail: actor?.email,
    userRole: actor?.isSuperadmin ? "superadmin" : "admin",
    ipAddress,
    userAgent,
    reason: reasonCheck.reason,
    orderData: order
      ? { orderId: order._id, orderNumber: order.orderNumber }
      : { orderId: offer.orderId },
    metadata: { offerId: offer.offerId },
  });

  if (order) {
    await sendAlternativeWithdrawnEmail({
      order: order.toObject ? order.toObject() : order,
      offer: updated.toObject ? updated.toObject() : updated,
    }).catch(() => {});
  }

  return { ok: true, status: "WITHDRAWN", offerId: offer.offerId };
}

export async function expireOpenAlternativeOffers({
  now = new Date(),
  limit = 50,
  trigger = "cron",
} = {}) {
  await connectToDB();
  const due = await AlternativeVehicleOffer.find({
    status: "OFFERED",
    expiresAt: { $lte: now },
  })
    .limit(Math.min(200, Math.max(1, Number(limit) || 50)))
    .lean();

  let expired = 0;
  let emailed = 0;
  const failed = [];
  for (const row of due) {
    try {
      const updated = await AlternativeVehicleOffer.findOneAndUpdate(
        { offerId: row.offerId, status: "OFFERED" },
        { $set: { status: "EXPIRED", decidedAt: now } },
        { new: true }
      );
      if (!updated) continue;
      expired += 1;
      const order = await Order.findById(updated.orderId);
      if (order) await reopenOrderForAnotherOffer(order);
      await audit("ALTERNATIVE_OFFER_EXPIRED", {
        userRole: "system",
        orderData: order
          ? { orderId: order._id, orderNumber: order.orderNumber }
          : { orderId: updated.orderId },
        metadata: { offerId: updated.offerId, trigger },
      });
      if (order) {
        const mailed = await sendAlternativeExpiredNotice({
          order: order.toObject ? order.toObject() : order,
          offer: updated.toObject ? updated.toObject() : updated,
        }).catch(() => ({ ok: false }));
        if (mailed?.ok) emailed += 1;
      }
    } catch (err) {
      failed.push({ offerId: row.offerId, message: err?.message || String(err) });
    }
  }
  return { scanned: due.length, expired, emailed, failed, trigger };
}

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

export { ALTERNATIVE_OFFER_CODE, evaluateAutomaticAlternativeEligibility };
