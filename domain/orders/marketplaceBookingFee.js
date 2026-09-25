/**
 * Spain marketplace Rovaro Booking Fee, stored as integer basis points.
 *
 * 10% = 1000 bps (platform default)
 * 12.5% = 1250 bps
 * 15% = 1500 bps
 *
 * ONE canonical precedence, implemented by {@link resolveBookingFeeBps} and
 * used by every caller that needs to know "what rate applies here?":
 *
 *   1. snapshot  — bps captured on the order when it was priced. A paid order
 *                  keeps this forever; it is never re-read from the company.
 *   2. derived   — bps implied by the order's own stored gross/fee pair, for
 *                  legacy orders saved before the bps field existed.
 *   3. override  — the company's negotiated rate.
 *   4. platform  — the platform default configured by superadmin.
 *   5. default   — DEFAULT_MARKETPLACE_BOOKING_FEE_BPS.
 *
 * The rate is genuinely per company: any value in [MIN, MAX] resolves and
 * splits exactly as configured. Nothing here clamps towards 10%.
 *
 * A stored rate that is present but not a valid integer in range is NOT
 * silently replaced by the default — it resolves with source `invalid` and an
 * `error`, and {@link assertMarketplaceBookingFee} throws on it so money paths
 * fail loudly instead of quietly charging the wrong percentage.
 */

export const DEFAULT_MARKETPLACE_BOOKING_FEE_BPS = 1000;
export const MIN_MARKETPLACE_BOOKING_FEE_BPS = 100; // 1%
export const MAX_MARKETPLACE_BOOKING_FEE_BPS = 3000; // 30%
export const MARKETPLACE_FEE_BPS_DENOMINATOR = 10000;

export const MARKETPLACE_BOOKING_FEE_SOURCE = Object.freeze({
  OVERRIDE: "override",
  PLATFORM: "platform",
  DEFAULT: "default",
  SNAPSHOT: "snapshot",
  DERIVED: "derived",
  INVALID: "invalid",
});

/** Thrown when a money path is asked to use an unusable stored rate. */
export class MarketplaceBookingFeeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "MarketplaceBookingFeeError";
    Object.assign(this, details);
  }
}

/**
 * Percentage label for display. Returns "" rather than inventing a rate:
 * callers must resolve the rate first, so a blank label is a visible bug
 * instead of a plausible-looking wrong number.
 */
export function formatMarketplaceFeePercent(bps) {
  const n = Number(bps);
  if (!Number.isFinite(n)) return "";
  const percent = n / 100;
  if (Number.isInteger(percent)) return String(percent);
  return String(Number(percent.toFixed(2)));
}

export function bpsToPercentNumber(bps) {
  const n = Number(bps);
  if (!Number.isFinite(n)) return null;
  return Number((n / 100).toFixed(2));
}

export function percentToMarketplaceBookingFeeBps(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function asInteger(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Number.isNaN(n)) return null;
  const rounded = Math.round(n);
  if (rounded !== n && Math.abs(n - rounded) > 1e-9) return null;
  return rounded;
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, bps: number } | { ok: false, error: string }}
 */
export function parseMarketplaceBookingFeeBps(value) {
  const bps = asInteger(value);
  if (bps == null) {
    return {
      ok: false,
      error: "Enter a valid booking fee.",
    };
  }
  if (bps < 0 || bps > 10000) {
    return {
      ok: false,
      error: "Rovaro Booking Fee cannot be negative or above 100%.",
    };
  }
  if (bps < MIN_MARKETPLACE_BOOKING_FEE_BPS) {
    return {
      ok: false,
      error: "Rovaro Booking Fee must be at least 1%.",
    };
  }
  if (bps > MAX_MARKETPLACE_BOOKING_FEE_BPS) {
    return {
      ok: false,
      error: "Rovaro Booking Fee cannot exceed 30%.",
    };
  }
  return { ok: true, bps };
}

/**
 * Parse a percentage typed by SUPERADMIN (1–30, up to two decimal places).
 * @param {unknown} percent
 */
export function parseMarketplaceBookingFeePercent(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return { ok: false, error: "Enter a valid Booking Fee percentage." };
  }
  if (n < 0 || n > 100) {
    return { ok: false, error: "Rovaro Booking Fee cannot be negative or above 100%." };
  }
  const bps = percentToMarketplaceBookingFeeBps(n);
  return parseMarketplaceBookingFeeBps(bps);
}

/** Snapshot / stored amounts may be outside the 1–30% SUPERADMIN range. */
function readStoredBps(value) {
  const bps = asInteger(value);
  if (bps == null || bps < 1 || bps > 10000) return null;
  return bps;
}

function readConfiguredBps(value) {
  const parsed = parseMarketplaceBookingFeeBps(value);
  return parsed.ok ? parsed.bps : null;
}

/** A rate field that was deliberately left unset, rather than set to junk. */
function isUnset(value) {
  return value == null || value === "";
}

/**
 * Effective fee for *new* Spain marketplace bookings.
 * Does not read orders. Pass the company document (and optional platform settings).
 *
 * @param {object|null|undefined} company
 * @param {object|null|undefined} [platformSettings]
 * @returns {{
 *   bps: number,
 *   percent: number,
 *   percentLabel: string,
 *   supplierBps: number,
 *   supplierPercent: number,
 *   supplierPercentLabel: string,
 *   source: string,
 * }}
 */
export function resolveMarketplaceBookingFeeBps(
  company,
  platformSettings = null
) {
  const companyRaw = company?.marketplaceBookingFeeBps;
  if (!isUnset(companyRaw)) {
    const parsed = parseMarketplaceBookingFeeBps(companyRaw);
    if (parsed.ok) {
      return describeFee(parsed.bps, MARKETPLACE_BOOKING_FEE_SOURCE.OVERRIDE);
    }
    return invalidFee(companyRaw, parsed.error, "company");
  }

  const platformRaw = platformSettings?.marketplaceBookingFeeBps;
  if (!isUnset(platformRaw)) {
    const parsed = parseMarketplaceBookingFeeBps(platformRaw);
    if (parsed.ok) {
      return describeFee(parsed.bps, MARKETPLACE_BOOKING_FEE_SOURCE.PLATFORM);
    }
    return invalidFee(platformRaw, parsed.error, "platform");
  }

  return describeFee(
    DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
    MARKETPLACE_BOOKING_FEE_SOURCE.DEFAULT
  );
}

/**
 * THE canonical answer to "which booking fee rate applies?".
 *
 * @param {{ order?: object, company?: object, platformSettings?: object }} [input]
 */
export function resolveBookingFeeBps({
  order = null,
  company = null,
  platformSettings = null,
} = {}) {
  if (order) {
    const snap = snapshotMarketplaceBookingFeeBps(order);
    if (snap.source !== MARKETPLACE_BOOKING_FEE_SOURCE.DEFAULT) {
      return describeFee(snap.bps, snap.source);
    }
  }
  return resolveMarketplaceBookingFeeBps(company, platformSettings);
}

/**
 * Guard for money paths. Display code may render a resolved-but-invalid rate
 * with a warning; nothing may charge or split on one.
 *
 * @param {ReturnType<typeof resolveBookingFeeBps>} resolved
 */
export function assertMarketplaceBookingFee(resolved) {
  if (resolved?.source === MARKETPLACE_BOOKING_FEE_SOURCE.INVALID) {
    throw new MarketplaceBookingFeeError(
      `Stored Rovaro Booking Fee is unusable (${resolved.invalidField}: ${JSON.stringify(resolved.invalidValue)}). ${resolved.error}`,
      { invalidField: resolved.invalidField, invalidValue: resolved.invalidValue }
    );
  }
  return resolved;
}

function describeFee(bps, source) {
  const supplierBps = MARKETPLACE_FEE_BPS_DENOMINATOR - bps;
  return {
    bps,
    percent: bpsToPercentNumber(bps),
    percentLabel: formatMarketplaceFeePercent(bps),
    supplierBps,
    supplierPercent: bpsToPercentNumber(supplierBps),
    supplierPercentLabel: formatMarketplaceFeePercent(supplierBps),
    source,
    isDefault: source === MARKETPLACE_BOOKING_FEE_SOURCE.DEFAULT,
    isNegotiated: source === MARKETPLACE_BOOKING_FEE_SOURCE.OVERRIDE,
    error: "",
  };
}

/**
 * A stored rate that exists but cannot be used. `bps` is null so arithmetic
 * on it fails instead of quietly producing a 10% charge.
 */
function invalidFee(value, error, field) {
  return {
    bps: null,
    percent: null,
    percentLabel: "",
    supplierBps: null,
    supplierPercent: null,
    supplierPercentLabel: "",
    source: MARKETPLACE_BOOKING_FEE_SOURCE.INVALID,
    isDefault: false,
    isNegotiated: false,
    invalidField: field,
    invalidValue: value,
    error,
  };
}

/**
 * Derive bps from immutable stored amounts. Returns null when unsafe.
 */
export function deriveMarketplaceBookingFeeBpsFromAmounts({
  grossMinor,
  platformAmountMinor,
} = {}) {
  const gross = Math.round(Number(grossMinor) || 0);
  const platform = Math.round(Number(platformAmountMinor) || 0);
  if (gross <= 0 || platform < 0) return null;
  const derived = Math.round((platform * MARKETPLACE_FEE_BPS_DENOMINATOR) / gross);
  if (!Number.isFinite(derived) || derived < 1 || derived > 10000) return null;
  return derived;
}

function orderFeeSource(order) {
  return (
    order?.authoritativePrice ||
    order ||
    {}
  );
}

/**
 * Fee basis points frozen on an existing booking. Never uses the company's
 * current configuration.
 *
 * Every place a booking can carry its own rate is consulted, because missing
 * one of them means quietly restating a historical charge at today's rate:
 * an explicitly captured bps always wins, then a bps implied by the captured
 * gross/fee pair, and only an order carrying neither falls through.
 *
 * @param {object|null|undefined} order
 * @returns {{ bps: number, source: string, derived: boolean }}
 */
export function snapshotMarketplaceBookingFeeBps(order) {
  const auth = orderFeeSource(order);
  const financial = order?.bookingFinancialSnapshot || {};
  const paid = order?.paidMarketplaceFeeSnapshot || {};

  for (const candidate of [
    auth.marketplaceBookingFeeBps,
    order?.marketplaceBookingFeeBps,
    financial.feeBps,
    paid.marketplaceBookingFeeBps,
  ]) {
    const stored = readStoredBps(candidate);
    if (stored != null) {
      return {
        bps: stored,
        source: MARKETPLACE_BOOKING_FEE_SOURCE.SNAPSHOT,
        derived: false,
      };
    }
  }

  for (const amounts of [
    {
      grossMinor: auth.grossMinor,
      platformAmountMinor:
        auth.platformAmountMinor ??
        auth.prepaymentMinor ??
        auth.stripeAmountMinor,
    },
    {
      grossMinor: financial.grossMinor,
      platformAmountMinor: financial.bookingFeeMinor,
    },
    {
      grossMinor: paid.grossMinor,
      platformAmountMinor: paid.platformAmountMinor,
    },
  ]) {
    const derived = deriveMarketplaceBookingFeeBpsFromAmounts(amounts);
    if (derived != null) {
      return {
        bps: derived,
        source: MARKETPLACE_BOOKING_FEE_SOURCE.DERIVED,
        derived: true,
      };
    }
  }

  return {
    bps: DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
    source: MARKETPLACE_BOOKING_FEE_SOURCE.DEFAULT,
    derived: false,
  };
}

export function marketplacePlatformAmountMinor(grossMinor, feeBps) {
  const gross = Math.max(0, Math.round(Number(grossMinor) || 0));
  const stored = readStoredBps(feeBps);
  if (stored == null && !isUnset(feeBps)) {
    throw new MarketplaceBookingFeeError(
      `Cannot charge a Rovaro Booking Fee from an unusable rate: ${JSON.stringify(feeBps)}`,
      { invalidField: "feeBps", invalidValue: feeBps }
    );
  }
  const bps = stored ?? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS;
  return Math.round((gross * bps) / MARKETPLACE_FEE_BPS_DENOMINATOR);
}

/**
 * The other half of the pair: supplierMinor = grossMinor - platformMinor.
 * One definition so the snapshot and the split can never drift apart.
 */
export function marketplaceSupplierBalanceMinor(grossMinor, platformMinor) {
  const gross = Math.max(0, Math.round(Number(grossMinor) || 0));
  const platform = Math.max(0, Math.round(Number(platformMinor) || 0));
  return Math.max(0, gross - platform);
}

export function marketplaceBookingFeeAuditMetadata({
  companyId,
  previousBps,
  newBps,
  actorEmail,
  actorUserId,
  reason,
} = {}) {
  return {
    companyId: companyId ? String(companyId) : "",
    previousBps: previousBps == null ? null : Number(previousBps),
    newBps: newBps == null ? null : Number(newBps),
    source: newBps == null ? "default" : "override",
    actorEmail: actorEmail ? String(actorEmail) : "",
    actorUserId: actorUserId ? String(actorUserId) : "",
    changedAt: new Date().toISOString(),
    reason: reason ? String(reason).slice(0, 500) : "",
  };
}
