/**
 * Dual-domain setup for CarsNK.
 *
 * Both hosts serve the same app (no cross-domain redirect):
 *   - carsnk.gr          (primary / SEO canonical)
 *   - cars.bbqr.site     (peer)
 *
 * Only www → apex redirects within the same domain.
 * Override primary with NEXT_PUBLIC_SITE_URL if needed.
 */

const DEFAULT_CANONICAL_URL = "https://carsnk.gr";

function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function envCanonicalUrl() {
  const fromEnv = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!fromEnv) return DEFAULT_CANONICAL_URL;
  try {
    const u = new URL(fromEnv.includes("://") ? fromEnv : `https://${fromEnv}`);
    return u.origin;
  } catch {
    return DEFAULT_CANONICAL_URL;
  }
}

/** Apex hosts that serve the app (no redirect away). */
const SERVING_APEX_HOSTS = ["carsnk.gr", "cars.bbqr.site"];

/** www → apex (same brand only). */
const WWW_TO_APEX = {
  "www.carsnk.gr": "carsnk.gr",
  "www.cars.bbqr.site": "cars.bbqr.site",
};

export const DOMAIN_CONFIG = {
  get canonical() {
    return envCanonicalUrl();
  },
  /** All hosts allowed to serve the app */
  get servingHosts() {
    return [...SERVING_APEX_HOSTS, ...Object.keys(WWW_TO_APEX)];
  },
  /** @deprecated use servingHosts — kept for older imports */
  get allowedDomains() {
    return this.servingHosts;
  },
  wwwToApex: WWW_TO_APEX,
};

export function getBaseUrl() {
  return String(DOMAIN_CONFIG.canonical || DEFAULT_CANONICAL_URL).replace(
    /\/+$/,
    ""
  );
}

export function absoluteUrl(path = "/") {
  const baseUrl = getBaseUrl();
  const safePath = String(path || "/");
  const normalizedPath = safePath.startsWith("/") ? safePath : `/${safePath}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getCanonicalHost() {
  return new URL(getBaseUrl()).host.toLowerCase();
}

export function getAllowedDomainHosts() {
  return DOMAIN_CONFIG.servingHosts.map((host) => normalizeHost(host));
}

export function getServingApexHosts() {
  return SERVING_APEX_HOSTS.map(normalizeHost);
}

/** If host is www.*, returns apex host; otherwise null. */
export function getApexHostFor(hostname) {
  const host = normalizeHost(hostname);
  return WWW_TO_APEX[host] || null;
}

export function isServingHost(hostname) {
  const host = normalizeHost(hostname);
  return getAllowedDomainHosts().includes(host);
}
