/**
 * Decimal-safe money helpers — store and compute in integer minor units (cents).
 */

export function toMinorUnits(major, currency = "EUR") {
  const n = Number(major);
  if (!Number.isFinite(n)) return null;
  const factor = minorFactor(currency);
  return Math.round(n * factor);
}

export function fromMinorUnits(minor, currency = "EUR") {
  const n = Number(minor);
  if (!Number.isFinite(n)) return null;
  const factor = minorFactor(currency);
  return n / factor;
}

export function minorFactor(currency = "EUR") {
  const code = String(currency || "EUR").toUpperCase();
  // Most ISO 4217 currencies use 2 decimal places; extend if needed.
  if (code === "JPY" || code === "KRW") return 1;
  return 100;
}

export function roundMinor(minor) {
  const n = Number(minor);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function addMinor(...values) {
  return roundMinor(values.reduce((sum, v) => sum + (Number(v) || 0), 0));
}

export function mulMinor(minor, factor) {
  const m = Number(minor);
  const f = Number(factor);
  if (!Number.isFinite(m) || !Number.isFinite(f)) return 0;
  return Math.round(m * f);
}

export function formatMinor(minor, currency = "EUR", locale = "en") {
  const major = fromMinorUnits(minor, currency);
  if (major == null) return "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: String(currency || "EUR").toUpperCase(),
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

/**
 * Round minor units to a configured increment (e.g. 100 = nearest euro).
 * @param {number} minor
 * @param {number} [increment=1]
 */
export function roundToIncrement(minor, increment = 1) {
  const m = Number(minor);
  const inc = Number(increment);
  if (!Number.isFinite(m)) return 0;
  if (!Number.isFinite(inc) || inc <= 1) return Math.round(m);
  return Math.round(m / inc) * inc;
}
