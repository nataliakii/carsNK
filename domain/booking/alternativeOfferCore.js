/**
 * Spain marketplace alternative-vehicle helpers used by
 * `domain/booking/alternativeVehicle.js`.
 *
 * This is not a second offer system: it completes the existing offer
 * document, statuses, and customer page with server-authoritative pricing,
 * snapshots, eligibility, and terms comparison.
 */

import { BOOKING_STATUS } from "./bookingStatus";
import { BOOKING_MODES, isMarketplaceRequestMode } from "./bookingMode";
import {
  RENTAL_STATE,
  canTransitionRentalState,
  resolveRentalState,
} from "./rentalBookingState";
import { listCarPhotos } from "@/domain/cars/carPhotos";
import { computeSnapshotChecksum } from "@/domain/legal/checksum";
import { BOOKING_PREPAYMENT_PERCENT } from "@/domain/legal/legalSettings";
import { marketplaceFinancialSplit } from "@/domain/orders/marketplaceFinancialSplit";
import { toAuthoritativePriceDoc } from "@/domain/orders/rentalPricingService";
import { LOCATION_KIND } from "@/domain/orders/locationSnapshot";
import {
  findEligibleOffice,
  officeIdString,
  resolveEligibleOffices,
} from "@/domain/company/officeRecord";
import { hashRentalTermsSource } from "@/domain/company/customerRentalTerms";
import crypto from "crypto";

export const ALTERNATIVE_OFFER_CODE = Object.freeze({
  NOT_FOUND: "not_found",
  NOT_MARKETPLACE: "not_marketplace",
  PAID_REQUIRES_MANUAL: "paid_requires_manual",
  INVALID_STATE: "invalid_state",
  UNPAID_REQUIRED: "unpaid_required",
  CAR_REQUIRED: "car_required",
  CAR_NOT_FOUND: "car_not_found",
  CAR_DELETED: "car_deleted",
  WRONG_COMPANY_CAR: "wrong_company_car",
  WRONG_COMPANY_ORDER: "wrong_company_order",
  SAME_CAR: "same_car",
  CATEGORY_DOWNGRADE: "category_downgrade",
  TRANSMISSION_DOWNGRADE: "transmission_downgrade",
  SEATS_DOWNGRADE: "seats_downgrade",
  LUGGAGE_DOWNGRADE: "luggage_downgrade",
  PHOTOS_REQUIRED: "photos_required",
  REASON_REQUIRED: "reason_required",
  OFFICE_INCOMPATIBLE: "office_incompatible",
  DELIVERY_UNSUPPORTED: "delivery_unsupported",
  DELIVERY_UNPRICED: "delivery_unpriced",
  LOCATION_SNAPSHOT_MISSING: "location_snapshot_missing",
  ACTIVE_OFFER_EXISTS: "active_offer_exists",
  AVAILABILITY_CONFLICT: "availability_conflict",
  TERMS_CONSENT_REQUIRED: "terms_consent_required",
  SNAPSHOT_MISMATCH: "snapshot_mismatch",
  EXPIRED: "expired",
  WITHDRAWN: "withdrawn",
  NOT_DECIDABLE: "not_decidable",
  HOLD_CONFLICT: "hold_conflict",
});

/** Same ranking as `alternativeVehicle.js`, plus stored Car.class values. */
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

/** Prefix for customer capability IDs. Public routes never use Mongo `_id`. */
export const OFFER_ID_PREFIX = "ALT-";
/** New offers: 16 bytes → 32 hex chars (128-bit). */
export const OFFER_ID_BYTES = 16;
/** Legacy issued IDs used 8 bytes → 16 hex chars (64-bit). Still decidable. */
export const LEGACY_OFFER_ID_HEX_LENGTH = 16;
export const CURRENT_OFFER_ID_HEX_LENGTH = OFFER_ID_BYTES * 2;

const OFFER_ID_PATTERN = new RegExp(
  `^${OFFER_ID_PREFIX}[0-9A-F]{${LEGACY_OFFER_ID_HEX_LENGTH}}$|^${OFFER_ID_PREFIX}[0-9A-F]{${CURRENT_OFFER_ID_HEX_LENGTH}}$`
);

export function normalizeOfferCapabilityId(value) {
  const raw = String(value || "").trim().toUpperCase();
  return OFFER_ID_PATTERN.test(raw) ? raw : "";
}

export function isValidOfferCapabilityId(value) {
  return Boolean(normalizeOfferCapabilityId(value));
}

export function generateOfferId() {
  const bytes = crypto.randomBytes(OFFER_ID_BYTES);
  if (!Buffer.isBuffer(bytes) || bytes.length !== OFFER_ID_BYTES) {
    throw new Error("Failed to generate alternative offer capability id");
  }
  return `${OFFER_ID_PREFIX}${bytes.toString("hex").toUpperCase()}`;
}

const CANCELLED_STATUSES = new Set([
  BOOKING_STATUS.CUSTOMER_CANCELLED,
  BOOKING_STATUS.SUPPLIER_CANCELLED,
  BOOKING_STATUS.ADMIN_CANCELLED,
]);

const CLOSED_STATUSES = new Set([
  ...CANCELLED_STATUSES,
  BOOKING_STATUS.SUPPLIER_DECLINED,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.BOOKING_CONFIRMED,
]);

function text(value) {
  const str = String(value ?? "").trim();
  return str || "";
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function classRank(value) {
  const idx = VEHICLE_CLASS_RANK.indexOf(String(value || "").trim().toLowerCase());
  return idx === -1 ? null : idx;
}

export function isOrderPaid(order) {
  const status = String(order?.payment?.status || "").toLowerCase();
  if (status === "paid" || status === "succeeded") return true;
  if (resolveRentalState(order) === RENTAL_STATE.CONFIRMED) return true;
  if (String(order?.bookingStatus) === BOOKING_STATUS.BOOKING_CONFIRMED) {
    return true;
  }
  return false;
}

export function isSpainMarketplaceUnpaidOrder(order) {
  return (
    isMarketplaceRequestMode(order?.bookingMode) &&
    String(order?.countryCode || "").toUpperCase() !== "GR" &&
    !isOrderPaid(order)
  );
}

/**
 * Automatic P0 alternative flow: unpaid Spain MARKETPLACE_REQUEST only.
 * Paid bookings require SUPERADMIN/manual resolution — not this path.
 */
export function evaluateAutomaticAlternativeEligibility(order, { actor } = {}) {
  if (!order) {
    return {
      ok: false,
      status: 404,
      code: ALTERNATIVE_OFFER_CODE.NOT_FOUND,
      message: "Booking not found",
    };
  }

  if (order.offline === true && !isMarketplaceRequestMode(order.bookingMode)) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.NOT_MARKETPLACE,
      message: "Automatic alternative offers are only for unpaid Spain marketplace requests",
    };
  }

  if (!isMarketplaceRequestMode(order.bookingMode)) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.NOT_MARKETPLACE,
      message: "Automatic alternative offers are only for unpaid Spain marketplace requests",
    };
  }

  if (isOrderPaid(order)) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.PAID_REQUIRES_MANUAL,
      message:
        "This booking is already paid. Replacing the car requires SUPERADMIN/manual resolution — the automatic alternative flow cannot run.",
    };
  }

  const stored = String(order.bookingStatus || "").trim();
  if (CLOSED_STATUSES.has(stored) || resolveRentalState(order) === RENTAL_STATE.COMPLETED) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.INVALID_STATE,
      message: "This booking cannot receive an alternative offer in its current state",
    };
  }

  if (stored === BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.INVALID_STATE,
      message: "An alternative has already been accepted for this booking",
    };
  }

  const state = resolveRentalState(order);
  if (
    state !== RENTAL_STATE.ALTERNATIVE_OFFERED &&
    !canTransitionRentalState(state, RENTAL_STATE.ALTERNATIVE_OFFERED)
  ) {
    return {
      ok: false,
      status: 409,
      code: ALTERNATIVE_OFFER_CODE.INVALID_STATE,
      message: `Cannot offer an alternative while the booking is ${state}`,
    };
  }

  const actorRole = Number(actor?.role);
  const actorCompany = actor?.ownerId ? String(actor.ownerId) : "";
  const orderCompany = order.ownerId ? String(order.ownerId) : "";
  const isSuperadmin = actorRole === 2 || actor?.isSuperadmin === true;

  if (!isSuperadmin) {
    if (!actorCompany || !orderCompany || actorCompany !== orderCompany) {
      return {
        ok: false,
        status: 403,
        code: ALTERNATIVE_OFFER_CODE.WRONG_COMPANY_ORDER,
        message: "This booking belongs to another fleet",
      };
    }
  }

  return { ok: true, isSuperadmin, orderCompany };
}

export function assertProposedCarCompany({ car, order, proposedCarId }) {
  const carId = String(proposedCarId || car?._id || "").trim();
  if (!carId) {
    return {
      ok: false,
      status: 400,
      code: ALTERNATIVE_OFFER_CODE.CAR_REQUIRED,
      message: "An alternative must be a stored vehicle from this company's fleet",
    };
  }
  if (!car) {
    return {
      ok: false,
      status: 404,
      code: ALTERNATIVE_OFFER_CODE.CAR_NOT_FOUND,
      message: "That vehicle was not found",
    };
  }
  if (car.deletedAt || car.archived === true) {
    return {
      ok: false,
      status: 400,
      code: ALTERNATIVE_OFFER_CODE.CAR_DELETED,
      message: "That vehicle is no longer in the fleet",
    };
  }
  const carCompany = car.ownerId ? String(car.ownerId) : "";
  const orderCompany = order.ownerId ? String(order.ownerId) : "";
  if (!carCompany || !orderCompany || carCompany !== orderCompany) {
    return {
      ok: false,
      status: 403,
      code: ALTERNATIVE_OFFER_CODE.WRONG_COMPANY_CAR,
      message: "The alternative must belong to the same rental company as the booking",
    };
  }
  if (order.car && String(order.car) === String(car._id)) {
    return {
      ok: false,
      status: 400,
      code: ALTERNATIVE_OFFER_CODE.SAME_CAR,
      message: "Choose a different vehicle than the one originally requested",
    };
  }
  return { ok: true };
}

export function applyReplacementPriceCap({
  calculatedGrossMinor,
  originalGrossMinor,
  feeBps,
  fixedPaidPlatformAmountMinor,
} = {}) {
  const calculated = Math.max(0, Math.round(Number(calculatedGrossMinor) || 0));
  const original = Math.max(0, Math.round(Number(originalGrossMinor) || 0));
  const replacementDiscountMinor = Math.max(0, calculated - original);
  const offeredGrossMinor = Math.min(calculated, original);
  const paidPlatform = Math.round(Number(fixedPaidPlatformAmountMinor) || 0);
  const split = paidPlatform > 0
    ? {
        ...marketplaceFinancialSplit(
          {
            grossMinor: offeredGrossMinor,
            currency: "EUR",
            marketplaceBookingFeeBps: feeBps,
            platformAmountMinor: paidPlatform,
            prepaymentMinor: paidPlatform,
            stripeAmountMinor: paidPlatform,
            supplierBalanceMinor: Math.max(0, offeredGrossMinor - paidPlatform),
            balanceMinor: Math.max(0, offeredGrossMinor - paidPlatform),
          },
          { feeBps }
        ),
      }
    : marketplaceFinancialSplit(
        {
          grossMinor: offeredGrossMinor,
          currency: "EUR",
          marketplaceBookingFeeBps: feeBps,
        },
        { feeBps }
      );
  return {
    calculatedGrossMinor: calculated,
    originalGrossMinor: original,
    replacementDiscountMinor,
    offeredGrossMinor,
    marketplaceBookingFeeBps: split.marketplaceBookingFeeBps,
    prepaymentMinor: split.prepaymentMinor,
    balanceMinor: split.balanceMinor,
    prepaymentPercent: split.prepaymentPercent,
    feePercent: split.feePercent,
    stripeAmountMinor: split.stripeAmountMinor,
    platformAmountMinor: split.platformAmountMinor,
    supplierBalanceMinor: split.supplierBalanceMinor,
    payoutMinor: split.payoutMinor,
    currency: split.currency,
  };
}

function photoIds(car) {
  return listCarPhotos(car);
}

export function buildCustomerVehicleSnapshot(car, { company } = {}) {
  const name = [text(car?.make), text(car?.model)].filter(Boolean).join(" ");
  return {
    carId: car?._id != null ? String(car._id) : "",
    ownerCompanyId: car?.ownerId ? String(car.ownerId) : company?._id ? String(company._id) : "",
    make: text(car?.make),
    model: text(car?.model),
    name: name || text(car?.model),
    category: text(car?.class),
    transmission: text(car?.transmission),
    seats: num(car?.seats ?? car?.numberOfSeats),
    luggage: num(car?.luggage ?? car?.luggageCapacity),
    doors: num(car?.numberOfDoors ?? car?.doors),
    fuel: text(car?.fueltype || car?.fuel),
    year: num(car?.registration ?? car?.year),
    modelGroup: text(car?.modelGroup),
    photos: photoIds(car),
    insuranceExcessMajor: num(car?.franchise),
    securityDepositMajor: num(car?.deposit),
    mileagePolicy: text(car?.mileagePolicy || car?.mileage),
    fuelPolicy: text(car?.fuelPolicy),
    minDriverAge: num(car?.minDriverAge ?? company?.minDriverAge),
    requiredDrivingExperienceYears: num(
      car?.requiredDrivingExperienceYears ?? company?.requiredDrivingExperienceYears
    ),
    includedEquipment: Array.isArray(car?.includedEquipment)
      ? car.includedEquipment.map((item) => text(item)).filter(Boolean).slice(0, 24)
      : [],
  };
}

export function buildOriginalRequestSnapshot({ order, car, company } = {}) {
  const vehicle = buildCustomerVehicleSnapshot(car || {}, { company });
  if (!vehicle.model) vehicle.model = text(order?.carModel);
  if (!vehicle.name) vehicle.name = text(order?.carModel);
  const terms = extractTermsSlice({
    order,
    car,
    company,
    vehicle,
  });
  return {
    carId: order?.car != null ? String(order.car) : vehicle.carId,
    vehicle,
    locationSnapshot: order?.locationSnapshot || null,
    authoritativePrice: order?.authoritativePrice || null,
    insurance: text(order?.insurance),
    terms,
    termsHash: terms.hash,
    termsVersion: terms.version,
    priceChecksum: text(order?.payment?.priceChecksum || order?.priceChecksum),
    orderTimestamp: iso(order?.date || order?.createdAt),
    bookingRequestId: text(order?.orderNumber) || (order?._id != null ? String(order._id) : ""),
    capturedAt: new Date().toISOString(),
  };
}

function companyTermsHash(company) {
  const source = company?.customerRentalTerms?.sourceEn;
  if (company?.customerRentalTerms?.sourceHash) {
    return String(company.customerRentalTerms.sourceHash);
  }
  if (source) return hashRentalTermsSource(source);
  return "";
}

export function extractTermsSlice({ order, car, company, vehicle } = {}) {
  const veh = vehicle || buildCustomerVehicleSnapshot(car || {}, { company });
  const companyHash = companyTermsHash(company);
  const platform = order?.termsAcceptance?.platform || {};
  const slice = {
    companyId: order?.ownerId
      ? String(order.ownerId)
      : company?._id
        ? String(company._id)
        : "",
    insurance: text(order?.insurance),
    insuranceExcessMajor: veh.insuranceExcessMajor,
    securityDepositMajor: veh.securityDepositMajor,
    mileagePolicy: veh.mileagePolicy,
    fuelPolicy: veh.fuelPolicy,
    minDriverAge: veh.minDriverAge,
    requiredDrivingExperienceYears: veh.requiredDrivingExperienceYears,
    companyTermsHash: companyHash,
    platformTermsChecksum: text(platform.checksum),
    platformTermsVersion: Number(platform.version) || 0,
  };
  return {
    ...slice,
    hash: computeSnapshotChecksum(slice),
    version: slice.platformTermsVersion || 1,
  };
}

const TERM_LABELS = Object.freeze({
  companyId: "rental_company",
  insurance: "insurance_type",
  insuranceExcessMajor: "insurance_excess",
  securityDepositMajor: "security_deposit",
  mileagePolicy: "mileage",
  fuelPolicy: "fuel_policy",
  minDriverAge: "minimum_driver_age",
  requiredDrivingExperienceYears: "driving_experience",
  companyTermsHash: "company_rental_terms",
  platformTermsChecksum: "platform_terms",
});

/**
 * Material car-specific conditions only. Cosmetic differences (colour, photos,
 * year) are not legal-term changes.
 */
export function compareMaterialRentalTerms(originalTerms, proposedTerms) {
  const original = originalTerms || {};
  const proposed = proposedTerms || {};
  const changedTerms = [];
  for (const [field, key] of Object.entries(TERM_LABELS)) {
    const left = original[field] ?? null;
    const right = proposed[field] ?? null;
    const same =
      left == null && right == null
        ? true
        : String(left ?? "") === String(right ?? "");
    if (!same) {
      changedTerms.push({
        key,
        field,
        original: left,
        proposed: right,
      });
    }
  }
  return {
    termsChanged: changedTerms.length > 0,
    changedTerms,
    originalTermsHash: original.hash || "",
    proposedTermsHash: proposed.hash || "",
  };
}

export function evaluateOfficeCompatibility({ order, car, company }) {
  const snap = order?.locationSnapshot;
  if (!snap || typeof snap !== "object") {
    return {
      ok: false,
      code: ALTERNATIVE_OFFER_CODE.LOCATION_SNAPSHOT_MISSING,
      message: "This booking has no stored pickup/return snapshot, so an alternative cannot be priced safely",
    };
  }
  const eligible = resolveEligibleOffices({ car, company });
  const pickup = snap.pickup || {};
  const ret = snap.return || snap.dropoff || {};

  if (pickup.kind === LOCATION_KIND.OFFICE) {
    const officeId = officeIdString(pickup.officeId);
    if (!officeId || !findEligibleOffice(eligible, officeId)) {
      return {
        ok: false,
        code: ALTERNATIVE_OFFER_CODE.OFFICE_INCOMPATIBLE,
        message: "This car is not eligible for the selected pickup office",
        leg: "pickup",
      };
    }
  }
  if (ret.kind === LOCATION_KIND.OFFICE) {
    const officeId = officeIdString(ret.officeId);
    if (!officeId || !findEligibleOffice(eligible, officeId)) {
      return {
        ok: false,
        code: ALTERNATIVE_OFFER_CODE.OFFICE_INCOMPATIBLE,
        message: "This car is not eligible for the selected return office",
        leg: "return",
      };
    }
  }
  return { ok: true, eligible };
}

function cloneLeg(leg) {
  return leg && typeof leg === "object" ? { ...leg } : null;
}

/**
 * Rebuild the proposed location snapshot from the original verified legs and
 * car B office eligibility. Does not change the customer's address.
 */
export function buildProposedLocationSnapshot({
  originalSnapshot,
  delivery,
  eligible,
  company,
}) {
  const pickup = cloneLeg(originalSnapshot?.pickup) || {};
  const ret = cloneLeg(originalSnapshot?.return || originalSnapshot?.dropoff) || {};
  const pickupKind = pickup.kind === LOCATION_KIND.OFFICE ? LOCATION_KIND.OFFICE : LOCATION_KIND.DELIVERY;
  const returnKind = ret.kind === LOCATION_KIND.OFFICE ? LOCATION_KIND.OFFICE : LOCATION_KIND.DELIVERY;

  if (pickupKind === LOCATION_KIND.OFFICE) {
    pickup.feeMajor = 0;
  } else {
    pickup.feeMajor = Number(delivery?.deliveryIn) || 0;
    pickup.distanceKm =
      delivery?.pickupMeta?.distanceKm ?? delivery?.inResult?.distanceKm ?? pickup.distanceKm;
    pickup.blocked = Boolean(delivery?.deliveryBlockedIn || delivery?.inResult?.blocked);
  }
  if (returnKind === LOCATION_KIND.OFFICE) {
    ret.feeMajor = 0;
  } else {
    ret.feeMajor = Number(delivery?.deliveryOut) || 0;
    ret.distanceKm =
      delivery?.returnMeta?.distanceKm ?? delivery?.outResult?.distanceKm ?? ret.distanceKm;
    ret.blocked = Boolean(delivery?.deliveryBlockedOut || delivery?.outResult?.blocked);
  }

  pickup.ruleId = company?.deliveryPricing?.strategy || pickup.ruleId || "";
  pickup.ruleVersion = String(company?.deliveryPricing?.version ?? pickup.ruleVersion ?? "");
  ret.ruleId = company?.deliveryPricing?.strategy || ret.ruleId || "";
  ret.ruleVersion = String(company?.deliveryPricing?.version ?? ret.ruleVersion ?? "");

  return {
    pickup,
    return: ret,
    currency: "EUR",
    calculatedAt: new Date().toISOString(),
    pricingVersion: String(company?.deliveryPricing?.version ?? originalSnapshot?.pricingVersion ?? ""),
    eligibleOfficeIds: (eligible || []).map((row) => officeIdString(row._id)).filter(Boolean),
  };
}

export function assertDeliveryQuoteSafe({ originalSnapshot, delivery }) {
  const pickup = originalSnapshot?.pickup || {};
  const ret = originalSnapshot?.return || originalSnapshot?.dropoff || {};
  if (delivery?.deliveryBlockedIn || delivery?.deliveryBlockedOut) {
    return {
      ok: false,
      code: ALTERNATIVE_OFFER_CODE.DELIVERY_UNSUPPORTED,
      message: "Delivery is not available for this car at the customer's address",
    };
  }
  const originalPickupFee = Number(pickup.feeMajor) || 0;
  const originalReturnFee = Number(ret.feeMajor) || 0;
  const newPickup = Number(delivery?.deliveryIn);
  const newReturn = Number(delivery?.deliveryOut);
  if (pickup.kind !== LOCATION_KIND.OFFICE && originalPickupFee > 0) {
    if (!Number.isFinite(newPickup) || (newPickup === 0 && !delivery?.officeFreeIn)) {
      const dist = delivery?.pickupMeta?.distanceKm;
      if (dist == null && !delivery?.officeFreeIn) {
        return {
          ok: false,
          code: ALTERNATIVE_OFFER_CODE.DELIVERY_UNPRICED,
          message: "Pickup delivery could not be priced for this car",
        };
      }
    }
  }
  if (ret.kind !== LOCATION_KIND.OFFICE && originalReturnFee > 0) {
    if (!Number.isFinite(newReturn) || (newReturn === 0 && !delivery?.officeFreeOut)) {
      const dist = delivery?.returnMeta?.distanceKm;
      if (dist == null && !delivery?.officeFreeOut) {
        return {
          ok: false,
          code: ALTERNATIVE_OFFER_CODE.DELIVERY_UNPRICED,
          message: "Return delivery could not be priced for this car",
        };
      }
    }
  }
  return { ok: true };
}

export function buildCappedAuthoritativePrice(quote, cap) {
  const doc = toAuthoritativePriceDoc(quote) || {};
  return {
    ...doc,
    currency: "EUR",
    grossMinor: cap.offeredGrossMinor,
    marketplaceBookingFeeBps: cap.marketplaceBookingFeeBps ?? quote?.marketplaceBookingFeeBps,
    feePercent: cap.feePercent ?? quote?.feePercent,
    prepaymentMinor: cap.prepaymentMinor,
    balanceMinor: cap.balanceMinor,
    prepaymentPercent: cap.prepaymentPercent,
    platformAmountMinor: cap.platformAmountMinor,
    stripeAmountMinor: cap.stripeAmountMinor,
    supplierBalanceMinor: cap.supplierBalanceMinor,
    payoutMinor: cap.payoutMinor ?? 0,
    calculatedGrossMinor: cap.calculatedGrossMinor,
    replacementDiscountMinor: cap.replacementDiscountMinor,
    pickupFeeMinor: quote?.pickupFeeMinor ?? doc.pickupFeeMinor ?? 0,
    returnFeeMinor: quote?.returnFeeMinor ?? doc.returnFeeMinor ?? 0,
  };
}

export function buildOfferChecksum(payload) {
  return computeSnapshotChecksum(payload);
}

export function buildOfferChecksumPayload({
  orderId,
  offerId,
  proposedCarId,
  originalCarId,
  offeredGrossMinor,
  calculatedGrossMinor,
  replacementDiscountMinor,
  prepaymentMinor,
  currency,
  locationSnapshot,
  termsHash,
  expiresAt,
}) {
  const pickup = locationSnapshot?.pickup || {};
  const ret = locationSnapshot?.return || locationSnapshot?.dropoff || {};
  return {
    orderId: String(orderId || ""),
    offerId: String(offerId || ""),
    proposedCarId: String(proposedCarId || ""),
    originalCarId: String(originalCarId || ""),
    offeredGrossMinor: Math.round(Number(offeredGrossMinor) || 0),
    calculatedGrossMinor: Math.round(Number(calculatedGrossMinor) || 0),
    replacementDiscountMinor: Math.round(Number(replacementDiscountMinor) || 0),
    prepaymentMinor: Math.round(Number(prepaymentMinor) || 0),
    currency: String(currency || "EUR").toUpperCase(),
    pickupKind: String(pickup.kind || ""),
    pickupOfficeId: String(pickup.officeId || ""),
    pickupPlaceId: String(pickup.placeId || ""),
    returnKind: String(ret.kind || ""),
    returnOfficeId: String(ret.officeId || ""),
    returnPlaceId: String(ret.placeId || ""),
    termsHash: String(termsHash || ""),
    expiresAt: iso(expiresAt),
  };
}

export function verifyOfferChecksum(offer) {
  const expected = text(offer?.snapshotChecksum);
  if (!expected) return { ok: true, skipped: true };
  const actual = buildOfferChecksum(
    buildOfferChecksumPayload({
      orderId: offer.orderId,
      offerId: offer.offerId,
      proposedCarId: offer.proposedCarId || offer.vehicle?.carId,
      originalCarId: offer.originalRequest?.carId || offer.originalCarId,
      offeredGrossMinor: offer.offeredGrossMinor ?? offer.priceMinor,
      calculatedGrossMinor: offer.calculatedAlternativeGrossMinor,
      replacementDiscountMinor: offer.replacementDiscountMinor,
      prepaymentMinor: offer.prepaymentMinor,
      currency: offer.currency,
      locationSnapshot: offer.proposedLocationSnapshot,
      termsHash: offer.proposedTermsHash,
      expiresAt: offer.expiresAt,
    })
  );
  if (actual !== expected) {
    return {
      ok: false,
      code: ALTERNATIVE_OFFER_CODE.SNAPSHOT_MISMATCH,
      message: "This offer no longer matches its stored snapshot",
    };
  }
  return { ok: true, actual };
}

export function sanitizeReason(value, { required = false, max = 500 } = {}) {
  const reason = text(value).slice(0, max);
  if (required && !reason) {
    return {
      ok: false,
      code: ALTERNATIVE_OFFER_CODE.REASON_REQUIRED,
      message: "A reason for the replacement is required",
    };
  }
  return { ok: true, reason };
}

export function publicExclusionReason(code, message) {
  return { code: code || "excluded", message: message || "This car cannot be offered" };
}

export { BOOKING_MODES, LOCATION_KIND, BOOKING_PREPAYMENT_PERCENT };
