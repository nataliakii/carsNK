/**
 * Spain marketplace Rovaro Booking Fee, stored as integer basis points.
 *
 * 10% = 1000 bps (platform default)
 * 12.5% = 1250 bps
 * 15% = 1500 bps
 *
 * Resolution for *new* bookings only:
 *   company.marketplaceBookingFeeBps override
 *   → platform default
 *   → 1000
 *
 * Existing orders always use the snapshotted bps / amounts. Never reprice
 * from the company's current setting.
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
});

export function formatMarketplaceFeePercent(bps) {
  const n = Number(bps);
  if (!Number.isFinite(n)) return "10";
  const percent = n / 100;
  if (Number.isInteger(percent)) return String(percent);
  return String(Number(percent.toFixed(2)));
}

export function bpsToPercentNumber(bps) {
  const n = Number(bps);
  if (!Number.isFinite(n)) return 10;
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
  const fromCompany = readConfiguredBps(company?.marketplaceBookingFeeBps);
  if (fromCompany != null) {
    return describeFee(fromCompany, MARKETPLACE_BOOKING_FEE_SOURCE.OVERRIDE);
  }
  const fromPlatform = readConfiguredBps(platformSettings?.marketplaceBookingFeeBps);
  if (fromPlatform != null) {
    return describeFee(fromPlatform, MARKETPLACE_BOOKING_FEE_SOURCE.PLATFORM);
  }
  return describeFee(
    DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
    MARKETPLACE_BOOKING_FEE_SOURCE.DEFAULT
  );
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
 * @param {object|null|undefined} order
 * @returns {{ bps: number, source: string, derived: boolean }}
 */
export function snapshotMarketplaceBookingFeeBps(order) {
  const auth = orderFeeSource(order);
  const stored = readStoredBps(
    auth.marketplaceBookingFeeBps ?? order?.marketplaceBookingFeeBps
  );
  if (stored != null) {
    return {
      bps: stored,
      source: MARKETPLACE_BOOKING_FEE_SOURCE.SNAPSHOT,
      derived: false,
    };
  }
  const derived = deriveMarketplaceBookingFeeBpsFromAmounts({
    grossMinor: auth.grossMinor,
    platformAmountMinor:
      auth.platformAmountMinor ?? auth.prepaymentMinor ?? auth.stripeAmountMinor,
  });
  if (derived != null) {
    return {
      bps: derived,
      source: MARKETPLACE_BOOKING_FEE_SOURCE.DERIVED,
      derived: true,
    };
  }
  return {
    bps: DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
    source: MARKETPLACE_BOOKING_FEE_SOURCE.DEFAULT,
    derived: false,
  };
}

export function marketplacePlatformAmountMinor(grossMinor, feeBps) {
  const gross = Math.max(0, Math.round(Number(grossMinor) || 0));
  const bps =
    readStoredBps(feeBps) ?? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS;
  return Math.round((gross * bps) / MARKETPLACE_FEE_BPS_DENOMINATOR);
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
