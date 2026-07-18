/**
 * Utility functions for order field normalization.
 * Extracted to avoid duplication across API routes.
 */

/**
 * Coerce any value to boolean with a fallback.
 * Handles strings ("true"/"false"/"1"/"0"), numbers, booleans, null/undefined.
 */
export function toBooleanField(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0" || normalized === "") return false;
  }
  return Boolean(value);
}

/**
 * Set `secondDriver` on a Mongoose order document using `strict: false`
 * to handle HMR/cached-schema edge cases.
 */
export function setSecondDriverField(orderDoc, value) {
  const normalized = toBooleanField(value, false);
  if (orderDoc && typeof orderDoc.set === "function") {
    orderDoc.set("secondDriver", normalized, { strict: false });
  } else if (orderDoc) {
    orderDoc.secondDriver = normalized;
  }
  return normalized;
}
