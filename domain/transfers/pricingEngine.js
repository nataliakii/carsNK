import TransferPricingRule, {
  PRICING_RULE_KINDS,
  PRICING_METHODS,
} from "@models/TransferPricingRule";
import TransferZone from "@models/TransferZone";
import TransferVehicleCategory, {
  DEFAULT_VEHICLE_CATEGORIES,
} from "@models/TransferVehicleCategory";
import {
  addMinor,
  mulMinor,
  roundToIncrement,
} from "@/domain/money/minorUnits";
import { locationDisplayName } from "@/domain/transfers/locationSnapshot";
import { selectVehicleCategory } from "@/domain/transfers/vehicleCapacity";
import { getCachedDrivingRoute } from "@/domain/transfers/routeCache";

function isRuleEffective(rule, at) {
  if (!rule || rule.isActive === false || rule.deactivatedAt) return false;
  const t = at ? new Date(at).getTime() : Date.now();
  if (rule.effectiveFrom && new Date(rule.effectiveFrom).getTime() > t) {
    return false;
  }
  if (rule.effectiveUntil && new Date(rule.effectiveUntil).getTime() < t) {
    return false;
  }
  return true;
}

function matchesDirection(rule, isReturn) {
  const d = rule.direction || "both";
  if (d === "both") return true;
  if (d === "return") return Boolean(isReturn);
  return !isReturn; // one_way
}

function matchesVehicle(rule, categoryCode) {
  const code = String(categoryCode || "STANDARD").toUpperCase();
  const ruleCat = String(rule.vehicleCategory || "STANDARD").toUpperCase();
  return ruleCat === code || ruleCat === "*" || ruleCat === "ANY";
}

function locationMatchesFixedEndpoint(endpoint, location) {
  if (!endpoint || !location) return false;
  if (
    endpoint.iataCode &&
    location.iataCode &&
    String(endpoint.iataCode).toUpperCase() ===
      String(location.iataCode).toUpperCase()
  ) {
    return true;
  }
  if (
    endpoint.providerPlaceId &&
    location.providerPlaceId &&
    endpoint.providerPlaceId === location.providerPlaceId
  ) {
    return true;
  }
  const a = normalizeName(
    endpoint.placeName || endpoint.formattedAddress || endpoint.city
  );
  const b = normalizeName(locationDisplayName(location) || location.city);
  if (a && b && (a === b || a.includes(b) || b.includes(a))) return true;
  return false;
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseHhMm(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Night window that may cross midnight (e.g. 22:00–06:00).
 */
export function isNightPickup(datetime, nightStartTime, nightEndTime) {
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return false;
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const start = parseHhMm(nightStartTime ?? "22:00");
  const end = parseHhMm(nightEndTime ?? "06:00");
  if (start == null || end == null) return false;
  if (start === end) return false;
  if (start < end) {
    return minutes >= start && minutes < end;
  }
  // crosses midnight
  return minutes >= start || minutes < end;
}

function locationInZone(location, zone) {
  if (!location || !zone) return false;
  const name = normalizeName(locationDisplayName(location));
  const city = normalizeName(location.city);
  if (zone.city && normalizeName(zone.city) === city) return true;
  if (
    location.iataCode &&
    (zone.memberAirports || []).some(
      (a) => String(a).toUpperCase() === String(location.iataCode).toUpperCase()
    )
  ) {
    return true;
  }
  if (
    location.providerPlaceId &&
    (zone.coveredPlaceIds || []).includes(location.providerPlaceId)
  ) {
    return true;
  }
  if (
    location.hotelName &&
    (zone.memberHotels || []).some(
      (h) => normalizeName(h) === normalizeName(location.hotelName)
    )
  ) {
    return true;
  }
  if (name && normalizeName(zone.name) === name) return true;
  if (zone.center?.lat != null && zone.radiusKm != null && location.lat != null) {
    // lightweight haversine for membership only — not for pricing
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(location.lat - zone.center.lat);
    const dLon = toRad((location.lng || 0) - (zone.center.lng || 0));
    const φ1 = toRad(zone.center.lat);
    const φ2 = toRad(location.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLon / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    if (km <= Number(zone.radiusKm) + 0.05) return true;
  }
  return false;
}

async function resolveZonesForLocation(location, country) {
  const zones = await TransferZone.find({
    country: String(country || "").toUpperCase(),
    isActive: true,
  }).lean();
  return zones.filter((z) => locationInZone(location, z));
}

function applyFormulaSurcharges(rule, ctx, baseMinor) {
  const surcharges = [];
  let total = baseMinor;

  const originType = ctx.origin?.locationType;
  const destType = ctx.destination?.locationType;

  if (originType === "airport" && rule.airportPickupFeeMinor) {
    total = addMinor(total, rule.airportPickupFeeMinor);
    surcharges.push({
      code: "airport_pickup",
      amountMinor: rule.airportPickupFeeMinor,
    });
  }
  if (destType === "airport" && rule.airportDropoffFeeMinor) {
    total = addMinor(total, rule.airportDropoffFeeMinor);
    surcharges.push({
      code: "airport_dropoff",
      amountMinor: rule.airportDropoffFeeMinor,
    });
  }
  if (originType === "port" || destType === "port") {
    if (rule.portFeeMinor) {
      total = addMinor(total, rule.portFeeMinor);
      surcharges.push({ code: "port", amountMinor: rule.portFeeMinor });
    }
  }
  if (originType === "railway" || destType === "railway") {
    if (rule.railwayStationFeeMinor) {
      total = addMinor(total, rule.railwayStationFeeMinor);
      surcharges.push({
        code: "railway",
        amountMinor: rule.railwayStationFeeMinor,
      });
    }
  }

  if (
    isNightPickup(ctx.datetime, rule.nightStartTime, rule.nightEndTime) &&
    rule.nightSurchargeValue
  ) {
    let nightMinor = 0;
    if (rule.nightSurchargeType === "percent") {
      nightMinor = mulMinor(baseMinor, Number(rule.nightSurchargeValue) / 100);
    } else {
      nightMinor = Number(rule.nightSurchargeValue) || 0;
    }
    if (nightMinor > 0) {
      total = addMinor(total, nightMinor);
      surcharges.push({ code: "night", amountMinor: nightMinor });
    }
  }

  if (rule.holidaySurchargeMinor && ctx.isHoliday) {
    total = addMinor(total, rule.holidaySurchargeMinor);
    surcharges.push({
      code: "holiday",
      amountMinor: rule.holidaySurchargeMinor,
    });
  }
  if (rule.weekendSurchargeMinor && ctx.isWeekend) {
    total = addMinor(total, rule.weekendSurchargeMinor);
    surcharges.push({
      code: "weekend",
      amountMinor: rule.weekendSurchargeMinor,
    });
  }

  const stops = Number(ctx.additionalStopCount || 0);
  if (stops > 0 && rule.additionalStopFeeMinor) {
    const stopFee = mulMinor(rule.additionalStopFeeMinor, stops);
    total = addMinor(total, stopFee);
    surcharges.push({ code: "additional_stops", amountMinor: stopFee, stops });
  }

  const childSeats = Number(ctx.childSeats || 0);
  if (childSeats > 0 && rule.childSeatFeeMinor) {
    const fee = mulMinor(rule.childSeatFeeMinor, childSeats);
    total = addMinor(total, fee);
    surcharges.push({ code: "child_seats", amountMinor: fee });
  }
  const boosters = Number(ctx.boosterSeats || 0);
  if (boosters > 0 && rule.boosterSeatFeeMinor) {
    const fee = mulMinor(rule.boosterSeatFeeMinor, boosters);
    total = addMinor(total, fee);
    surcharges.push({ code: "booster_seats", amountMinor: fee });
  }
  const oversized = Number(ctx.oversizedLuggage || 0);
  if (oversized > 0 && rule.oversizedLuggageFeeMinor) {
    const fee = mulMinor(rule.oversizedLuggageFeeMinor, oversized);
    total = addMinor(total, fee);
    surcharges.push({ code: "oversized_luggage", amountMinor: fee });
  }

  if (
    rule.tollHandling === "include" &&
    ctx.tollsMinor != null &&
    Number(ctx.tollsMinor) > 0
  ) {
    total = addMinor(total, ctx.tollsMinor);
    surcharges.push({ code: "tolls", amountMinor: Number(ctx.tollsMinor) });
  }

  return { total, surcharges };
}

function computeDistanceFormulaPrice(rule, ctx, category) {
  const distanceKm = Number(ctx.distanceKm || 0);
  const durationMinutes = Number(ctx.durationMinutes || 0);
  const includedKm = Number(rule.includedDistanceKm || 0);
  const includedMin = Number(rule.includedDurationMinutes || 0);
  const chargeableKm = Math.max(0, distanceKm - includedKm);
  const chargeableMin = Math.max(0, durationMinutes - includedMin);

  let base = Number(rule.baseFareMinor || 0);
  base = addMinor(base, mulMinor(rule.pricePerKmMinor || 0, chargeableKm));
  base = addMinor(
    base,
    mulMinor(rule.pricePerMinuteMinor || 0, chargeableMin)
  );

  const multiplier =
    Number(rule.vehicleCategoryMultiplier) ||
    Number(category?.pricingMultiplier) ||
    1;
  base = mulMinor(base, multiplier);
  base = addMinor(
    base,
    Number(rule.vehicleCategoryFixedAdjustmentMinor || 0) ||
      Number(category?.pricingFixedAdjustmentMinor || 0)
  );

  const { total: withFees, surcharges } = applyFormulaSurcharges(rule, ctx, base);
  let customer = roundToIncrement(
    withFees,
    rule.roundingIncrementMinor || 1
  );
  const minimum = Number(rule.minimumFareMinor || 0);
  if (customer < minimum) {
    surcharges.push({
      code: "minimum_fare",
      amountMinor: minimum - customer,
    });
    customer = minimum;
  }

  return { customerPriceMinor: customer, surcharges, chargeableKm, chargeableMin };
}

function deriveSupplierPayout(rule, customerPriceMinor) {
  if (rule.supplierPayoutMinor != null && Number.isFinite(Number(rule.supplierPayoutMinor))) {
    return Number(rule.supplierPayoutMinor);
  }
  // Fallback: legacy commission % if payout not configured on rule
  const commission = Number(process.env.TRANSFER_COMMISSION_PERCENT || 15);
  const pct = Number.isFinite(commission) ? commission : 15;
  return Math.round(customerPriceMinor * (1 - pct / 100));
}

function buildSnapshot({
  customerPriceMinor,
  supplierPayoutMinor,
  currency,
  method,
  rule,
  explanation,
  ctx,
  surcharges,
  isProvisional,
}) {
  const paymentProcessingAmountMinor = 0;
  const platformMarginMinor =
    customerPriceMinor - supplierPayoutMinor - paymentProcessingAmountMinor;
  return {
    customerPriceMinor,
    supplierPayoutMinor,
    platformMarginMinor,
    paymentProcessingAmountMinor,
    taxMinor: 0,
    currency: currency || rule?.currency || "EUR",
    pricingRuleId: rule?._id || null,
    pricingRuleVersion: rule?.version ?? null,
    pricingMethod: method,
    pricingExplanation: explanation,
    distanceKm: ctx.distanceKm ?? null,
    durationMinutes: ctx.durationMinutes ?? null,
    appliedSurcharges: surcharges || [],
    appliedDiscounts: [],
    vehicleCategory: ctx.vehicleCategory || "STANDARD",
    passengerAssumptions: {
      adults: ctx.adults,
      children: ctx.children,
      passengers: ctx.passengers,
    },
    luggageAssumptions: {
      standardSuitcases: ctx.standardSuitcases,
      cabinBags: ctx.cabinBags,
      oversizedLuggage: ctx.oversizedLuggage,
    },
    calculatedAt: new Date(),
    originSnapshot: ctx.origin,
    destinationSnapshot: ctx.destination,
    isProvisional: Boolean(isProvisional),
  };
}

/**
 * Hybrid transfer pricing engine (server-only).
 * Priority: FIXED_ROUTE → ZONE_PAIR → CITY_FORMULA → MANUAL.
 */
export async function calculateTransferQuote(input = {}) {
  const country = String(input.country || "GR").toUpperCase();
  const datetime = input.datetime ? new Date(input.datetime) : new Date();
  const isReturn = Boolean(input.isReturn);
  const adults = Number(input.adults ?? input.passengers ?? 1) || 1;
  const children = Array.isArray(input.children) ? input.children : [];
  const passengers = adults + children.length;

  let categories = await TransferVehicleCategory.find({ isActive: true })
    .sort({ sort: 1 })
    .lean();
  if (!categories.length) {
    categories = DEFAULT_VEHICLE_CATEGORIES.map((c) => ({
      ...c,
      isActive: true,
    }));
  }

  const capacityReq = {
    adults,
    children,
    childrenCount: children.length,
    standardSuitcases: Number(input.standardSuitcases || 0),
    cabinBags: Number(input.cabinBags || 0),
    oversizedLuggage: Number(input.oversizedLuggage || 0),
    specialLuggageTypes: (input.specialLuggage || []).map((s) =>
      typeof s === "string" ? s : s.type
    ),
    needsAccessible: Boolean(input.needsAccessible),
    accessibilityRequirements: input.accessibilityRequirements,
  };

  let vehicleCategory = String(input.vehicleCategory || "").toUpperCase();
  let categoryDoc = categories.find((c) => c.code === vehicleCategory);
  if (!categoryDoc) {
    const selected = selectVehicleCategory(capacityReq, categories);
    if (!selected.ok) {
      return {
        ok: false,
        message: selected.message,
        code: selected.code || "capacity",
      };
    }
    categoryDoc = selected.category;
    vehicleCategory = categoryDoc.code;
  } else {
    const capacity = selectVehicleCategory(capacityReq, [categoryDoc]);
    if (!capacity.ok) {
      return {
        ok: false,
        message: capacity.message,
        code: "capacity",
      };
    }
  }

  const origin = input.origin;
  const destination = input.destination;
  const fromLabel =
    input.from || locationDisplayName(origin) || origin?.formattedAddress;
  const toLabel =
    input.to ||
    locationDisplayName(destination) ||
    destination?.formattedAddress;

  const route = await getCachedDrivingRoute({
    origin,
    destination,
    fromLabel,
    toLabel,
  });

  if (!route.ok) {
    return {
      ok: true,
      requiresManualQuote: true,
      quote: buildSnapshot({
        customerPriceMinor: 0,
        supplierPayoutMinor: 0,
        currency: "EUR",
        method: PRICING_METHODS.MANUAL,
        rule: null,
        explanation: `Manual quote required: ${route.message || "route unavailable"}`,
        ctx: {
          origin,
          destination,
          vehicleCategory,
          adults,
          children,
          passengers,
          distanceKm: null,
          durationMinutes: null,
          standardSuitcases: capacityReq.standardSuitcases,
          cabinBags: capacityReq.cabinBags,
          oversizedLuggage: capacityReq.oversizedLuggage,
        },
        surcharges: [],
        isProvisional: true,
      }),
      route: null,
      vehicleCategory,
    };
  }

  const day = datetime.getUTCDay();
  const ctx = {
    origin,
    destination,
    datetime,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    tollsMinor: route.tollsMinor,
    vehicleCategory,
    adults,
    children,
    passengers,
    standardSuitcases: capacityReq.standardSuitcases,
    cabinBags: capacityReq.cabinBags,
    oversizedLuggage: capacityReq.oversizedLuggage,
    childSeats: Number(input.childSeats || 0),
    boosterSeats: Number(input.boosterSeats || 0),
    additionalStopCount: Array.isArray(input.additionalStops)
      ? input.additionalStops.length
      : Number(input.additionalStopCount || 0),
    isWeekend: day === 0 || day === 6,
    isHoliday: Boolean(input.isHoliday),
  };

  const rules = await TransferPricingRule.find({
    country,
    isActive: true,
    deactivatedAt: null,
  })
    .sort({ priority: 1, createdAt: 1 })
    .lean();

  const effective = rules.filter(
    (r) =>
      isRuleEffective(r, datetime) &&
      matchesDirection(r, isReturn) &&
      matchesVehicle(r, vehicleCategory)
  );

  // 1. FIXED_ROUTE
  const fixed = effective
    .filter((r) => r.kind === PRICING_RULE_KINDS.FIXED_ROUTE)
    .find(
      (r) =>
        locationMatchesFixedEndpoint(r.origin, origin) &&
        locationMatchesFixedEndpoint(r.destination, destination)
    );

  if (fixed) {
    const customerPriceMinor = Number(fixed.customerPriceMinor || 0);
    const { total, surcharges } = applyFormulaSurcharges(
      fixed,
      ctx,
      customerPriceMinor
    );
    // For fixed routes, surcharges are optional add-ons on top of listed price
    const finalCustomer =
      fixed.airportPickupFeeMinor || fixed.nightSurchargeValue
        ? total
        : customerPriceMinor;
    const supplierPayoutMinor = deriveSupplierPayout(fixed, finalCustomer);
    return {
      ok: true,
      quote: buildSnapshot({
        customerPriceMinor: finalCustomer,
        supplierPayoutMinor,
        currency: fixed.currency,
        method: PRICING_METHODS.FIXED_ROUTE,
        rule: fixed,
        explanation: `Fixed route price (${fixed.name || fixed._id})`,
        ctx,
        surcharges,
        isProvisional: false,
      }),
      route,
      vehicleCategory,
    };
  }

  // 2. ZONE_PAIR
  const originZones = await resolveZonesForLocation(origin, country);
  const destZones = await resolveZonesForLocation(destination, country);
  const zonePair = effective
    .filter((r) => r.kind === PRICING_RULE_KINDS.ZONE_PAIR)
    .find((r) => {
      const oOk = originZones.some(
        (z) => String(z._id) === String(r.originZoneId)
      );
      const dOk = destZones.some(
        (z) => String(z._id) === String(r.destinationZoneId)
      );
      return oOk && dOk;
    });

  if (zonePair) {
    const customerPriceMinor = Number(zonePair.customerPriceMinor || 0);
    const { total, surcharges } = applyFormulaSurcharges(
      zonePair,
      ctx,
      customerPriceMinor
    );
    const finalCustomer =
      zonePair.airportPickupFeeMinor || zonePair.nightSurchargeValue
        ? total
        : customerPriceMinor;
    const supplierPayoutMinor = deriveSupplierPayout(zonePair, finalCustomer);
    return {
      ok: true,
      quote: buildSnapshot({
        customerPriceMinor: finalCustomer,
        supplierPayoutMinor,
        currency: zonePair.currency,
        method: PRICING_METHODS.ZONE_PAIR,
        rule: zonePair,
        explanation: `Zone-to-zone price (${zonePair.name || zonePair._id})`,
        ctx,
        surcharges,
        isProvisional: false,
      }),
      route,
      vehicleCategory,
    };
  }

  // 3. CITY_FORMULA
  const cityKey = normalizeName(
    origin?.city || destination?.city || input.city || ""
  );
  const cityRules = effective
    .filter((r) => r.kind === PRICING_RULE_KINDS.CITY_FORMULA)
    .filter((r) => {
      if (!r.city) return true;
      return normalizeName(r.city) === cityKey || !cityKey;
    });

  for (const rule of cityRules) {
    const maxAuto = rule.maximumAutomaticDistanceKm;
    const manualThreshold = rule.manualQuoteThresholdKm;
    if (
      maxAuto != null &&
      Number.isFinite(Number(maxAuto)) &&
      route.distanceKm > Number(maxAuto)
    ) {
      continue;
    }
    if (
      manualThreshold != null &&
      Number.isFinite(Number(manualThreshold)) &&
      route.distanceKm > Number(manualThreshold)
    ) {
      return {
        ok: true,
        requiresManualQuote: true,
        quote: buildSnapshot({
          customerPriceMinor: 0,
          supplierPayoutMinor: 0,
          currency: rule.currency,
          method: PRICING_METHODS.MANUAL,
          rule,
          explanation: `Manual quote: distance ${route.distanceKm} km exceeds threshold ${manualThreshold} km`,
          ctx,
          surcharges: [],
          isProvisional: true,
        }),
        route,
        vehicleCategory,
      };
    }

    if (rule.serviceRadiusKm != null && Number.isFinite(Number(rule.serviceRadiusKm))) {
      // optional: both ends should be within service area conceptually; skip hard reject
    }

    const priced = computeDistanceFormulaPrice(rule, ctx, categoryDoc);
    const supplierPayoutMinor = deriveSupplierPayout(
      rule,
      priced.customerPriceMinor
    );
    return {
      ok: true,
      quote: buildSnapshot({
        customerPriceMinor: priced.customerPriceMinor,
        supplierPayoutMinor,
        currency: rule.currency,
        method: PRICING_METHODS.DISTANCE_FORMULA,
        rule,
        explanation: `City distance formula (${rule.name || rule.city || rule._id}): ${route.distanceKm} km`,
        ctx,
        surcharges: priced.surcharges,
        isProvisional: false,
      }),
      route,
      vehicleCategory,
    };
  }

  // 4. MANUAL
  return {
    ok: true,
    requiresManualQuote: true,
    quote: buildSnapshot({
      customerPriceMinor: 0,
      supplierPayoutMinor: 0,
      currency: "EUR",
      method: PRICING_METHODS.MANUAL,
      rule: null,
      explanation:
        "Manual quote required: no fixed route, zone pair, or city formula matched",
      ctx,
      surcharges: [],
      isProvisional: true,
    }),
    route,
    vehicleCategory,
  };
}

/**
 * Pure helper for unit tests — distance formula without DB.
 */
export function computeCityFormulaPricePure(rule, ctx, category) {
  return computeDistanceFormulaPrice(rule, ctx, category);
}

export { PRICING_METHODS, locationInZone };
