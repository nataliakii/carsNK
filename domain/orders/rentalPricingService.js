/**
 * Server-authoritative rental pricing.
 *
 * Reuses Car.calculateTotalRentalPricePerDay (seasonal tiers, DiscountSetting,
 * CDW, child seats, second driver) plus calculateDeliveryPrice. Does not
 * introduce a second formula.
 *
 * Newly persisted authoritative values are integer minor units (EUR cents).
 * Compatibility projection keeps the existing major-unit `totalPrice` float
 * for admin/calendar code that still depends on it.
 */

import { calculateDeliveryPrice } from "@/domain/delivery/calculateDeliveryPrice";
import {
  addMinor,
  fromMinorUnits,
  toMinorUnits,
} from "@/domain/money/minorUnits";
import { toBooleanField } from "@/domain/orders/fieldUtils";
import { BOOKING_MODES, isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { toBusinessDateTime } from "@/domain/orders/numberOfDays";
import {
  canonicalizeTimezone,
  LEGACY_FALLBACK_TZ,
} from "@/domain/time/resolveBusinessTimezone";
import { companyUsesSeasons } from "@/domain/orders/flatDailyRate";

export const RENTAL_PRICING_VERSION = 1;
export const RENTAL_CURRENCY = "EUR";

export const ALLOWED_INSURANCE = new Set(["TPL", "CDW"]);
const MAX_CHILD_SEATS = 8;

export class RentalPricingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RentalPricingError";
    this.code = code;
  }
}

export function resolveCurrency() {
  return RENTAL_CURRENCY;
}

/**
 * Prepayment percent resolution (snapshot only — no payment in this phase).
 * 1. explicit authorised booking override
 * 2. car override
 * 3. company override
 * 4. platform/country default
 * 5. 10 for Spain marketplace only; 0 for Greece OPS_CALENDAR
 */
export function resolvePrepaymentPercent({
  overridePercent,
  car,
  company,
  platformSettings,
  bookingMode,
} = {}) {
  const candidates = [
    overridePercent,
    car?.prepaymentPercent,
    company?.prepaymentPercent,
    platformSettings?.prepaymentPercent,
  ];
  for (const raw of candidates) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  }
  if (isMarketplaceRequestMode(bookingMode)) return 10;
  return 0;
}

function assertNonNegativeFinite(name, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || Number.isNaN(n)) {
    throw new RentalPricingError(
      "INVALID_AMOUNT",
      `Invalid ${name}`
    );
  }
  return n;
}

export function validateRentalPriceSelections({
  insurance,
  childSeats,
  secondDriver,
} = {}) {
  const ins = insurance == null || insurance === "" ? "TPL" : String(insurance).trim();
  if (!ALLOWED_INSURANCE.has(ins)) {
    throw new RentalPricingError("INVALID_INSURANCE", "Insurance choice is not valid for this car.");
  }
  const seats = childSeats == null || childSeats === "" ? 0 : Number(childSeats);
  if (!Number.isInteger(seats) || seats < 0 || seats > MAX_CHILD_SEATS) {
    throw new RentalPricingError("INVALID_EXTRAS", "Child seats selection is not valid.");
  }
  const sd = toBooleanField(secondDriver, false);
  return { insurance: ins, childSeats: seats, secondDriver: sd };
}

function majorToMinor(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return toMinorUnits(n, RENTAL_CURRENCY) ?? 0;
}

function buildLines({
  rentalDays,
  baseRentalMinor,
  discountMinor,
  insuranceMinor,
  extrasMinor,
  pickupFeeMinor,
  returnFeeMinor,
  insurance,
  childSeats,
  secondDriver,
}) {
  const lines = [
    {
      code: "BASE_RENTAL",
      label: "Rental",
      minor: baseRentalMinor,
      qty: rentalDays,
    },
  ];
  if (discountMinor > 0) {
    lines.push({
      code: "DISCOUNT",
      label: "Discount",
      minor: -discountMinor,
      qty: 1,
    });
  }
  if (insuranceMinor > 0) {
    lines.push({
      code: "INSURANCE",
      label: insurance,
      minor: insuranceMinor,
      qty: rentalDays,
    });
  }
  if (extrasMinor > 0) {
    lines.push({
      code: "EXTRAS",
      label: [
        childSeats > 0 ? `Child seats ×${childSeats}` : null,
        secondDriver ? "Second driver" : null,
      ]
        .filter(Boolean)
        .join(", ") || "Extras",
      minor: extrasMinor,
      qty: 1,
    });
  }
  if (pickupFeeMinor > 0) {
    lines.push({
      code: "PICKUP_FEE",
      label: "Pickup delivery",
      minor: pickupFeeMinor,
      qty: 1,
    });
  }
  if (returnFeeMinor > 0) {
    lines.push({
      code: "RETURN_FEE",
      label: "Return delivery",
      minor: returnFeeMinor,
      qty: 1,
    });
  }
  return lines;
}

/**
 * @param {object} params
 * @param {object} params.car — mongoose Car document with calculateTotalRentalPricePerDay
 */
export async function calculateAuthoritativeRentalPrice({
  car,
  pickupAtUtc,
  returnAtUtc,
  timezone,
  insurance,
  childSeats,
  secondDriver,
  placeIn,
  placeOut,
  placeInDetail,
  placeOutDetail,
  placeInLat,
  placeInLon,
  placeOutLat,
  placeOutLon,
  placeInLocality,
  placeOutLocality,
  company,
  bookingMode,
  platformSettings,
  prepaymentOverridePercent,
  promoCode,
} = {}) {
  if (!car || typeof car.calculateTotalRentalPricePerDay !== "function") {
    throw new RentalPricingError("CAR_REQUIRED", "Car is required for pricing.");
  }

  const tz = canonicalizeTimezone(timezone) || LEGACY_FALLBACK_TZ;
  const selections = validateRentalPriceSelections({
    insurance,
    childSeats,
    secondDriver,
  });

  if (promoCode != null && String(promoCode).trim()) {
    // No authorised public discount channel in this phase.
  }

  const start = toBusinessDateTime(pickupAtUtc, tz);
  const end = toBusinessDateTime(returnAtUtc, tz);
  if (!start || !end || !start.isValid() || !end.isValid()) {
    throw new RentalPricingError("INVALID_DATES", "Invalid rental dates.");
  }

  const { total, days, breakdown } = await car.calculateTotalRentalPricePerDay(
    start,
    end,
    selections.insurance,
    selections.childSeats,
    selections.secondDriver,
    tz,
    { useSeasons: companyUsesSeasons(company) }
  );

  assertNonNegativeFinite("rentalTotal", total);

  let deliveryData = {};
  try {
    deliveryData = await calculateDeliveryPrice({
      placeIn,
      placeOut,
      companyId: car.ownerId ? String(car.ownerId) : company?._id ? String(company._id) : undefined,
      timeIn: pickupAtUtc,
      timeOut: returnAtUtc,
      carOffices: car.offices,
      placeInDetail,
      placeOutDetail,
      placeInLat,
      placeInLon,
      placeOutLat,
      placeOutLon,
      placeInLocality,
      placeOutLocality,
    });
  } catch (err) {
    console.error("[rentalPricing] delivery calc error:", err?.message || err);
    deliveryData = {};
  }

  const dailyRates = Array.isArray(breakdown?.dailyRates) ? breakdown.dailyRates : [];
  const listedBase = dailyRates.reduce(
    (sum, row) => sum + (Number(row?.price) || 0),
    0
  );
  const listedFinal = dailyRates.reduce(
    (sum, row) => sum + (Number(row?.finalPrice) || 0),
    0
  );
  const discountMajor = Math.max(0, listedBase - listedFinal);

  const baseRentalMinor = majorToMinor(
    breakdown?.baseRentalTotal != null ? breakdown.baseRentalTotal + discountMajor : total
  );
  const discountMinor = majorToMinor(discountMajor);
  const netBaseMinor = majorToMinor(breakdown?.baseRentalTotal ?? listedFinal);
  const insuranceMinor = majorToMinor(breakdown?.kaskoTotal);
  const childSeatsMinor = majorToMinor(breakdown?.childSeatsTotal);
  const secondDriverMinor = majorToMinor(breakdown?.secondDriverTotal);
  const extrasMinor = addMinor(childSeatsMinor, secondDriverMinor);
  const pickupFeeMinor = majorToMinor(deliveryData?.deliveryIn);
  const returnFeeMinor = majorToMinor(deliveryData?.deliveryOut);
  const otherFeesMinor = 0;

  const rentalNetMinor = addMinor(netBaseMinor, insuranceMinor, extrasMinor);
  const deliveryMinor = addMinor(pickupFeeMinor, returnFeeMinor);
  const grossMinor = addMinor(rentalNetMinor, deliveryMinor, otherFeesMinor);

  const compatibilityRentalMajor =
    Math.round((Number(total) || 0) * 100) / 100;
  const compatibilityDeliveryMajor =
    Math.round((Number(deliveryData?.deliveryTotal) || 0) * 100) / 100;
  const compatibilityTotal =
    Math.round((compatibilityRentalMajor + compatibilityDeliveryMajor) * 100) / 100;
  const projectedMajor = fromMinorUnits(grossMinor, RENTAL_CURRENCY);
  const compatibilityMatchesMinor =
    projectedMajor != null &&
    Math.abs(projectedMajor - compatibilityTotal) < 0.005;

  const mode = bookingMode || BOOKING_MODES.OPS_CALENDAR;
  const prepaymentPercent = resolvePrepaymentPercent({
    overridePercent: prepaymentOverridePercent,
    car,
    company,
    platformSettings,
    bookingMode: mode,
  });
  const prepaymentMinor = Math.round((grossMinor * prepaymentPercent) / 100);
  const balanceMinor = grossMinor - prepaymentMinor;

  const lines = buildLines({
    rentalDays: days,
    baseRentalMinor: netBaseMinor,
    discountMinor,
    insuranceMinor,
    extrasMinor,
    pickupFeeMinor,
    returnFeeMinor,
    insurance: selections.insurance,
    childSeats: selections.childSeats,
    secondDriver: selections.secondDriver,
  });

  const calculatedAt = new Date();

  return {
    currency: RENTAL_CURRENCY,
    rentalDays: days,
    baseRentalMinor: netBaseMinor,
    discountMinor,
    insuranceMinor,
    extrasMinor,
    pickupFeeMinor,
    returnFeeMinor,
    otherFeesMinor,
    grossMinor,
    prepaymentPercent,
    prepaymentMinor,
    balanceMinor,
    pricingVersion: RENTAL_PRICING_VERSION,
    calculatedAt,
    lines,
    inputSnapshot: {
      timezone: tz,
      insurance: selections.insurance,
      childSeats: selections.childSeats,
      secondDriver: selections.secondDriver,
      placeIn: placeIn || "",
      placeOut: placeOut || "",
      pickupAtUtc:
        pickupAtUtc instanceof Date
          ? pickupAtUtc.toISOString()
          : pickupAtUtc || null,
      returnAtUtc:
        returnAtUtc instanceof Date
          ? returnAtUtc.toISOString()
          : returnAtUtc || null,
      promoCodeIgnored: Boolean(promoCode && String(promoCode).trim()),
    },
    compatibility: {
      totalPrice: compatibilityTotal,
      rentalTotal: compatibilityRentalMajor,
      deliveryTotal: compatibilityDeliveryMajor,
      matchesMinor: compatibilityMatchesMinor,
      breakdown: {
        ...(breakdown || {}),
        ...deliveryData,
      },
    },
  };
}

export function toAuthoritativePriceDoc(quote) {
  if (!quote) return null;
  return {
    currency: quote.currency,
    rentalDays: quote.rentalDays,
    baseRentalMinor: quote.baseRentalMinor,
    discountMinor: quote.discountMinor,
    insuranceMinor: quote.insuranceMinor,
    extrasMinor: quote.extrasMinor,
    pickupFeeMinor: quote.pickupFeeMinor,
    returnFeeMinor: quote.returnFeeMinor,
    otherFeesMinor: quote.otherFeesMinor,
    grossMinor: quote.grossMinor,
    prepaymentPercent: quote.prepaymentPercent,
    prepaymentMinor: quote.prepaymentMinor,
    balanceMinor: quote.balanceMinor,
    pricingVersion: quote.pricingVersion,
    calculatedAt: quote.calculatedAt,
    lines: quote.lines,
    inputSnapshot: quote.inputSnapshot,
  };
}

const CLIENT_TOTAL_MISMATCH_MAJOR = 0.5;

/**
 * Ignore client totals for public creates. Log when they meaningfully differ.
 * Does not log the full customer payload.
 */
export function detectClientTotalMismatch({
  clientTotalPrice,
  serverTotalMajor,
} = {}) {
  const client = Number(clientTotalPrice);
  const server = Number(serverTotalMajor);
  if (!Number.isFinite(client) || !Number.isFinite(server)) return null;
  if (Math.abs(client - server) < CLIENT_TOTAL_MISMATCH_MAJOR) return null;
  return {
    clientMajor: Math.round(client * 100) / 100,
    serverMajor: Math.round(server * 100) / 100,
  };
}
