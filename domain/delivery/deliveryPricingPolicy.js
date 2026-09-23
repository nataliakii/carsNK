import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";

/**
 * Company deliveryPricing normalize + radius-split price calculator.
 * Pure — no DB.
 */

export const INSIDE_MODES = ["fixed", "free", "perKm"];
export const OUTSIDE_MODES = ["perKm", "fixed", "blocked"];
export const DELIVERY_STRATEGY_MODES = ["zones", "radius", "cities"];

export function defaultDeliveryPricing(fallbackPerKm = 1) {
  const perKm =
    Number.isFinite(Number(fallbackPerKm)) && Number(fallbackPerKm) >= 0
      ? Number(fallbackPerKm)
      : 1;
  return {
    strategy: "radius",
    radiusKm: null,
    operatingCities: [],
    maxDistanceKm: null,
    inside: { mode: "free", amount: 0 },
    outside: { mode: "perKm", amount: perKm },
    afterHoursSurcharge: 0,
  };
}

function normalizeMode(raw, allowed, fallback) {
  const mode = String(raw || "")
    .trim();
  if (allowed.includes(mode)) return mode;
  return fallback;
}

function normalizeAmount(raw, fallback = 0) {
  if (raw === null || raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * @param {unknown} raw
 * @param {{ deliveryPricePerKm?: number }} [company]
 * @returns {{ ok: true, value: object } | { ok: false, message: string }}
 */
export function normalizeDeliveryPricingInput(raw, company = {}) {
  if (raw == null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "object") {
    return { ok: false, message: "deliveryPricing must be an object" };
  }

  const fallback = defaultDeliveryPricing(company.deliveryPricePerKm);
  let radiusKm = fallback.radiusKm;
  if (raw.radiusKm !== undefined) {
    if (raw.radiusKm === null || raw.radiusKm === "") {
      radiusKm = null;
    } else {
      const n = Number(raw.radiusKm);
      if (!Number.isFinite(n) || n < 0 || n > 5000) {
        return { ok: false, message: "radiusKm must be 0–5000 or empty" };
      }
      radiusKm = n;
    }
  } else if (company?.deliveryPricing?.radiusKm != null) {
    radiusKm = Number(company.deliveryPricing.radiusKm);
  }

  let maxDistanceKm = null;
  const maxRaw =
    raw.maxDistanceKm !== undefined
      ? raw.maxDistanceKm
      : company?.deliveryPricing?.maxDistanceKm;
  if (maxRaw !== undefined && maxRaw !== null && maxRaw !== "") {
    const n = Number(maxRaw);
    if (!Number.isFinite(n) || n < 0 || n > 5000) {
      return { ok: false, message: "maxDistanceKm must be 0–5000 or empty" };
    }
    maxDistanceKm = n;
  }

  const strategyRaw = String(
    raw.strategy ?? company?.deliveryPricing?.strategy ?? ""
  )
    .trim()
    .toLowerCase();
  let strategy = DELIVERY_STRATEGY_MODES.includes(strategyRaw)
    ? strategyRaw
    : null;

  const operatingCities = normalizeOperatingCities(
    raw.operatingCities !== undefined
      ? raw.operatingCities
      : company?.deliveryPricing?.operatingCities
  );

  if (!strategy) {
    if (operatingCities.length) strategy = "cities";
    else if (radiusKm != null) strategy = "radius";
    else strategy = "zones";
  }

  const insideMode = normalizeMode(
    raw.inside?.mode ?? company?.deliveryPricing?.inside?.mode,
    INSIDE_MODES,
    strategy === "cities" ? "free" : fallback.inside.mode
  );
  const insideAmount = normalizeAmount(
    raw.inside?.amount ?? company?.deliveryPricing?.inside?.amount,
    fallback.inside.amount
  );
  if (insideAmount === null) {
    return { ok: false, message: "inside.amount must be >= 0" };
  }

  const outsideMode = normalizeMode(
    raw.outside?.mode ?? company?.deliveryPricing?.outside?.mode,
    OUTSIDE_MODES,
    fallback.outside.mode
  );
  const outsideAmount = normalizeAmount(
    raw.outside?.amount ?? company?.deliveryPricing?.outside?.amount,
    fallback.outside.amount
  );
  if (outsideAmount === null) {
    return { ok: false, message: "outside.amount must be >= 0" };
  }

  const surchargeRaw =
    raw.afterHoursSurcharge !== undefined
      ? raw.afterHoursSurcharge
      : company?.deliveryPricing?.afterHoursSurcharge;
  const afterHoursSurcharge = normalizeAmount(surchargeRaw, 0);
  if (afterHoursSurcharge === null) {
    return { ok: false, message: "afterHoursSurcharge must be >= 0" };
  }

  return {
    ok: true,
    value: {
      strategy,
      radiusKm,
      operatingCities,
      maxDistanceKm,
      inside: { mode: insideMode, amount: insideAmount },
      outside: { mode: outsideMode, amount: outsideAmount },
      afterHoursSurcharge,
      version: nextDeliveryPricingVersion(raw, company?.deliveryPricing),
    },
  };
}

/**
 * Monotonic version: bump when tariff content changes; retain when identical.
 */
export function nextDeliveryPricingVersion(incoming, previous) {
  const prevVersion = Number(previous?.version);
  const base = Number.isFinite(prevVersion) && prevVersion >= 1 ? prevVersion : 1;
  if (!previous || typeof previous !== "object") return base;
  if (!incoming || typeof incoming !== "object") return base;
  const keys = [
    "strategy",
    "radiusKm",
    "maxDistanceKm",
    "afterHoursSurcharge",
  ];
  let changed = false;
  for (const key of keys) {
    if (incoming[key] !== undefined && String(incoming[key] ?? "") !== String(previous[key] ?? "")) {
      changed = true;
      break;
    }
  }
  if (!changed) {
    const citiesIn = normalizeOperatingCities(incoming.operatingCities).join("|");
    const citiesPrev = normalizeOperatingCities(previous.operatingCities).join("|");
    if (citiesIn !== citiesPrev) changed = true;
  }
  if (!changed) {
    const inMode = String(incoming.inside?.mode ?? previous.inside?.mode ?? "");
    const inAmt = String(incoming.inside?.amount ?? previous.inside?.amount ?? "");
    const outMode = String(incoming.outside?.mode ?? previous.outside?.mode ?? "");
    const outAmt = String(incoming.outside?.amount ?? previous.outside?.amount ?? "");
    const prevIn = `${previous.inside?.mode ?? ""}|${previous.inside?.amount ?? ""}`;
    const prevOut = `${previous.outside?.mode ?? ""}|${previous.outside?.amount ?? ""}`;
    if (`${inMode}|${inAmt}` !== prevIn || `${outMode}|${outAmt}` !== prevOut) {
      changed = true;
    }
  }
  if (Number.isFinite(Number(incoming.version)) && Number(incoming.version) > base) {
    return Math.floor(Number(incoming.version));
  }
  return changed ? base + 1 : base;
}

/** Radius as a number, or null when unset (null/undefined/"" are not 0). */
function radiusKmOrNull(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const r = Number(raw);
  return Number.isFinite(r) && r >= 0 ? r : null;
}

/** True when company has an active radius-split or cities-list policy. */
export function hasActiveDeliveryPricing(policy) {
  if (!policy || typeof policy !== "object") return false;
  const strategy = String(policy.strategy || "").toLowerCase();
  if (strategy === "cities") {
    return normalizeOperatingCities(policy.operatingCities).length > 0;
  }
  if (strategy === "zones") return false;
  return radiusKmOrNull(policy.radiusKm) !== null;
}

/** True specifically for radius-km split (not cities list). */
export function hasActiveRadiusDeliveryPricing(policy) {
  if (!policy || typeof policy !== "object") return false;
  const strategy = String(policy.strategy || "").toLowerCase();
  if (strategy === "cities" || strategy === "zones") return false;
  return radiusKmOrNull(policy.radiusKm) !== null;
}

/**
 * Km billed when outside the service area (from boundary).
 * @param {number} distanceFromBaseKm
 * @param {number} radiusKm
 */
export function chargeableKmBeyondRadius(distanceFromBaseKm, radiusKm) {
  const d = Number(distanceFromBaseKm);
  const r = Number(radiusKm);
  if (!Number.isFinite(d) || d < 0) return 0;
  if (!Number.isFinite(r) || r < 0) return d;
  return Math.max(0, Math.round((d - r) * 100) / 100);
}

function applyTier(mode, amount, distanceKm, chargeableKm) {
  if (mode === "free") return { price: 0, blocked: false };
  if (mode === "blocked") return { price: 0, blocked: true };
  if (mode === "fixed") {
    const a = Number(amount);
    return {
      price: Number.isFinite(a) && a >= 0 ? a : 0,
      blocked: false,
    };
  }
  // perKm
  const perKm = Number(amount);
  const km = Number(chargeableKm != null ? chargeableKm : distanceKm);
  if (!Number.isFinite(perKm) || perKm < 0 || !Number.isFinite(km) || km <= 0) {
    return { price: 0, blocked: false };
  }
  return { price: Math.round(km * perKm * 100) / 100, blocked: false };
}

/**
 * Radius-split delivery price for one side (pickup or return).
 *
 * @param {object} params
 * @param {number} params.distanceKm — distance from company base
 * @param {object} params.policy — deliveryPricing
 * @param {object|null} [params.matchedOutsideZone] — named zone override
 * @param {boolean} [params.isAfterHours]
 * @param {function} [params.computeZonePrice] — zone formula injector
 */
export function computeRuleDeliveryPrice({
  distanceKm,
  policy,
  matchedOutsideZone = null,
  isAfterHours = false,
  computeZonePrice,
}) {
  const empty = {
    price: 0,
    blocked: false,
    region: null,
    chargeableKm: 0,
    basePrice: 0,
    afterHoursSurcharge: 0,
    usedZone: false,
  };

  if (matchedOutsideZone && typeof computeZonePrice === "function") {
    const basePrice = Number(computeZonePrice(matchedOutsideZone)) || 0;
    const surcharge =
      isAfterHours && Number(policy?.afterHoursSurcharge) > 0
        ? Number(policy.afterHoursSurcharge)
        : 0;
    return {
      price: Math.round((basePrice + surcharge) * 100) / 100,
      blocked: false,
      region: "zone",
      chargeableKm: Number(matchedOutsideZone.distanceKm) || 0,
      basePrice,
      afterHoursSurcharge: surcharge,
      usedZone: true,
    };
  }

  if (!hasActiveDeliveryPricing(policy)) {
    return empty;
  }

  const radiusKm = Number(policy.radiusKm);
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return empty;

  const inside = d <= radiusKm;
  const region = inside ? "inside" : "outside";
  const tier = inside ? policy.inside : policy.outside;
  const chargeableKm = inside
    ? d
    : chargeableKmBeyondRadius(d, radiusKm);

  const applied = applyTier(
    tier?.mode,
    tier?.amount,
    d,
    inside ? d : chargeableKm
  );

  if (applied.blocked) {
    return {
      ...empty,
      blocked: true,
      region,
      chargeableKm,
    };
  }

  const surcharge =
    isAfterHours && Number(policy.afterHoursSurcharge) > 0
      ? Number(policy.afterHoursSurcharge)
      : 0;

  return {
    price: Math.round((applied.price + surcharge) * 100) / 100,
    blocked: false,
    region,
    chargeableKm,
    basePrice: applied.price,
    afterHoursSurcharge: surcharge,
    usedZone: false,
  };
}

/**
 * Whether a wall-clock HH:mm (or Date/dayjs) falls outside working hours.
 * @param {string|{ hour?: number, minute?: number }|Date} time
 * @param {{ start?: string, end?: string }} workingHours
 */
export function isAfterWorkingHours(time, workingHours) {
  const start = String(workingHours?.start || "08:00").trim();
  const end = String(workingHours?.end || "22:00").trim();
  const toMinutes = (hhmm) => {
    const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const startM = toMinutes(start);
  const endM = toMinutes(end);
  if (startM == null || endM == null) return false;

  let timeM = null;
  if (typeof time === "string") {
    timeM = toMinutes(time);
  } else if (time && typeof time === "object" && typeof time.hour === "function") {
    // dayjs
    timeM = time.hour() * 60 + time.minute();
  } else if (time instanceof Date && !Number.isNaN(time.getTime())) {
    timeM = time.getHours() * 60 + time.getMinutes();
  }
  if (timeM == null) return false;

  if (startM === endM) return false; // 24h
  if (startM < endM) {
    return timeM < startM || timeM >= endM;
  }
  // overnight window e.g. 22:00–06:00 means "working" spans midnight
  return timeM < startM && timeM >= endM;
}
