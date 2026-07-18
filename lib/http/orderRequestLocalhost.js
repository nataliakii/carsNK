/**
 * Detect whether the booking API request came from a localhost site (dev).
 * Uses Host / X-Forwarded-Host only (not client IP — VPN/LAN would false-positive).
 */

/**
 * @param {string|undefined|null} raw
 * @returns {string} hostname without port, lowercase
 */
export function normalizeRequestHostname(raw) {
  if (raw == null || typeof raw !== "string") return "";
  const first = raw.split(",")[0].trim();
  const host = first.split(":")[0].trim().toLowerCase();
  return host || "";
}

export function isLocalhostHostname(host) {
  if (!host) return false;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

/**
 * @param {Request} request
 * @returns {boolean}
 */
export function isOrderBookingRequestFromLocalhost(request) {
  if (!request?.headers?.get) return false;
  const xf = normalizeRequestHostname(request.headers.get("x-forwarded-host"));
  const h = normalizeRequestHostname(request.headers.get("host"));
  return isLocalhostHostname(xf) || isLocalhostHostname(h);
}
