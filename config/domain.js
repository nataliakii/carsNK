/**
 * Dual-domain setup for CarsNK.
 *
 * Both hosts serve the same app (no cross-domain redirect):
 *   - carsnk.gr          (primary / SEO canonical — always)
 *   - cars.bbqr.site     (peer mirror; opens as-is)
 *
 * Only www → apex redirects within the same domain.
 * Sitemap, Open Graph, emails, booking links use getBaseUrl() → carsnk.gr.
 */

const DEFAULT_CANONICAL_URL = "https://carsnk.gr";
const PEER_HOSTS = new Set(["cars.bbqr.site", "www.cars.bbqr.site"]);

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
    return getBaseUrl();
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

/**
 * SEO / emails / sitemap / OG — always primary brand host.
 * Never returns cars.bbqr.site even if NEXT_PUBLIC_SITE_URL was mis-set.
 */
export function getBaseUrl() {
  let origin = envCanonicalUrl();
  try {
    const host = normalizeHost(new URL(origin).host);
    if (PEER_HOSTS.has(host)) {
      origin = DEFAULT_CANONICAL_URL;
    }
  } catch {
    origin = DEFAULT_CANONICAL_URL;
  }
  return String(origin || DEFAULT_CANONICAL_URL).replace(/\/+$/, "");
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

/** Peer mirror host (not SEO canonical). */
export function isPeerMirrorHost(hostname) {
  return PEER_HOSTS.has(normalizeHost(hostname));
}

export { DEFAULT_CANONICAL_URL, SERVING_APEX_HOSTS };
