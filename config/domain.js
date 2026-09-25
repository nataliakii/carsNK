/**
 * Domain / canonical URL by deployment country.
 *
 * GR (CarsNK):
 *   - carsnk.gr          (primary / SEO canonical)
 *   - cars.bbqr.site     (peer mirror; opens as-is)
 *
 * ES (rovaro):
 *   - rovaro.autos       (primary / SEO canonical)
 *
 * Only www → apex redirects within the same brand.
 * Sitemap, Open Graph, emails, booking links use getBaseUrl().
 */

import { getSiteCountryCode } from "./siteCountry.js";

const DEFAULT_CANONICAL_BY_COUNTRY = {
  GR: "https://carsnk.gr",
  ES: "https://rovaro.autos",
};

const PEER_HOSTS_BY_COUNTRY = {
  GR: new Set(["cars.bbqr.site", "www.cars.bbqr.site"]),
  ES: new Set([]),
};

const SERVING_APEX_BY_COUNTRY = {
  GR: ["carsnk.gr", "cars.bbqr.site"],
  ES: ["rovaro.autos"],
};

const WWW_TO_APEX_BY_COUNTRY = {
  GR: {
    "www.carsnk.gr": "carsnk.gr",
    "www.cars.bbqr.site": "cars.bbqr.site",
  },
  ES: {
    "www.rovaro.autos": "rovaro.autos",
  },
};

/**
 * Hosts that belong to a market but are not served/canonical from here.
 * rovaro.es is the Spanish-language domain of the same ES market
 * (see config/legalEntity.js `spanishDomain`).
 */
const ALIAS_HOSTS_BY_COUNTRY = {
  GR: [],
  ES: ["rovaro.es"],
};

function countryCode() {
  try {
    return getSiteCountryCode();
  } catch {
    return "GR";
  }
}

function defaultCanonicalUrl() {
  const code = countryCode();
  return DEFAULT_CANONICAL_BY_COUNTRY[code] || DEFAULT_CANONICAL_BY_COUNTRY.GR;
}

function peerHosts() {
  const code = countryCode();
  return PEER_HOSTS_BY_COUNTRY[code] || PEER_HOSTS_BY_COUNTRY.GR;
}

function servingApexHosts() {
  const code = countryCode();
  return SERVING_APEX_BY_COUNTRY[code] || SERVING_APEX_BY_COUNTRY.GR;
}

function wwwToApexMap() {
  const code = countryCode();
  return WWW_TO_APEX_BY_COUNTRY[code] || WWW_TO_APEX_BY_COUNTRY.GR;
}

function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function envCanonicalUrl() {
  const fromEnv = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const fallback = defaultCanonicalUrl();
  if (!fromEnv) return fallback;
  try {
    const u = new URL(fromEnv.includes("://") ? fromEnv : `https://${fromEnv}`);
    return u.origin;
  } catch {
    return fallback;
  }
}

export const DOMAIN_CONFIG = {
  get canonical() {
    return getBaseUrl();
  },
  /** All hosts allowed to serve the app */
  get servingHosts() {
    return [...servingApexHosts(), ...Object.keys(wwwToApexMap())];
  },
  /** @deprecated use servingHosts — kept for older imports */
  get allowedDomains() {
    return this.servingHosts;
  },
  get wwwToApex() {
    return wwwToApexMap();
  },
};

/**
 * SEO / emails / sitemap / OG — primary brand host for this deployment.
 * Peer mirrors (e.g. cars.bbqr.site on GR) never become the canonical.
 */
export function getBaseUrl() {
  const fallback = defaultCanonicalUrl();
  let origin = envCanonicalUrl();
  try {
    const host = normalizeHost(new URL(origin).host);
    if (peerHosts().has(host)) {
      origin = fallback;
    }
    // If ES deploy still has carsnk.gr in env, force rovaro.autos
    if (countryCode() === "ES" && (host === "carsnk.gr" || host === "www.carsnk.gr")) {
      origin = DEFAULT_CANONICAL_BY_COUNTRY.ES;
    }
    // If GR deploy somehow points at rovaro.autos, force carsnk.gr
    if (countryCode() === "GR" && (host === "rovaro.autos" || host === "www.rovaro.autos")) {
      origin = DEFAULT_CANONICAL_BY_COUNTRY.GR;
    }
  } catch {
    origin = fallback;
  }
  return String(origin || fallback).replace(/\/+$/, "");
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
  return servingApexHosts().map(normalizeHost);
}

/** If host is www.*, returns apex host; otherwise null. */
export function getApexHostFor(hostname) {
  const host = normalizeHost(hostname);
  return wwwToApexMap()[host] || null;
}

export function isServingHost(hostname) {
  const host = normalizeHost(hostname);
  return getAllowedDomainHosts().includes(host);
}

/** Peer mirror host (not SEO canonical). */
export function isPeerMirrorHost(hostname) {
  return peerHosts().has(normalizeHost(hostname));
}

function marketHostsFor(code) {
  const alias = ALIAS_HOSTS_BY_COUNTRY[code] || [];
  return [
    ...(SERVING_APEX_BY_COUNTRY[code] || []),
    ...Object.keys(WWW_TO_APEX_BY_COUNTRY[code] || {}),
    ...alias,
    ...alias.map((host) => `www.${host}`),
  ].map(normalizeHost);
}

/** Deployment country a hostname belongs to, or "" when the host is unknown. */
export function getMarketCountryForHost(hostname) {
  const host = normalizeHost(hostname).replace(/:\d+$/, "");
  if (!host) return "";
  for (const code of Object.keys(SERVING_APEX_BY_COUNTRY)) {
    if (marketHostsFor(code).includes(host)) return code;
  }
  return "";
}

/** @deprecated use getBaseUrl() — GR default kept for older imports */
export const DEFAULT_CANONICAL_URL = DEFAULT_CANONICAL_BY_COUNTRY.GR;
export const SERVING_APEX_HOSTS = SERVING_APEX_BY_COUNTRY.GR;

export const ROVARO_CANONICAL_URL = DEFAULT_CANONICAL_BY_COUNTRY.ES;
