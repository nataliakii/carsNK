/**
 * Canonical market resolver.
 *
 * MARKET COUNTRY answers "whose market is this deployment / request serving?".
 * It selects the location catalog, the service areas and the legal entity.
 *
 * UI LOCALE is a different axis: it only decides which language the page is
 * rendered in. A customer browsing the Spanish deployment in English, Catalan
 * or Norwegian is still in the ES market, so locale is deliberately not an
 * input to any function here.
 *
 * Resolution order:
 *   1. the request host, when it is a known market host (config/domain.js)
 *   2. the deployment country (NEXT_PUBLIC_SITE_COUNTRY, config/siteCountry.js)
 *
 * A client-supplied `country` field is never an input — callers that receive
 * one must compare it against the resolved market instead of trusting it.
 */

import { COUNTRY_CODES, getSiteCountryCode } from "@config/siteCountry";
import { getMarketCountryForHost } from "@config/domain";

export const MARKET_COUNTRY_CODES = [...COUNTRY_CODES];

export function isMarketCountryCode(value) {
  return MARKET_COUNTRY_CODES.includes(
    String(value || "")
      .trim()
      .toUpperCase()
  );
}

/** ISO-2 market code, or "" when the value names no market this platform serves. */
export function normalizeMarketCountry(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  return isMarketCountryCode(code) ? code : "";
}

/** Market of this deployment, ignoring any request context. */
export function getDeploymentMarketCountry() {
  return getSiteCountryCode();
}

function hostOf(input) {
  if (!input) return "";
  if (typeof input === "string") return input;
  const headers = input.headers;
  if (headers && typeof headers.get === "function") {
    const forwarded = headers.get("x-forwarded-host") || headers.get("host");
    if (forwarded) return String(forwarded).split(",")[0];
  }
  if (typeof input.host === "string" && input.host) return input.host;
  if (typeof input.hostname === "string" && input.hostname) return input.hostname;
  if (typeof input.url === "string" && input.url) {
    try {
      return new URL(input.url).host;
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * @param {string | Request | { host?: string, hostname?: string, url?: string, headers?: Headers }} [input]
 * @returns {string} ISO-2 market code, always one of MARKET_COUNTRY_CODES
 */
export function resolveMarketCountry(input) {
  const fromHost = normalizeMarketCountry(getMarketCountryForHost(hostOf(input)));
  return fromHost || getDeploymentMarketCountry();
}

export function marketCountryFromRequest(request) {
  return resolveMarketCountry(request);
}

export function isSameMarket(a, b) {
  const left = normalizeMarketCountry(a);
  const right = normalizeMarketCountry(b);
  return Boolean(left) && left === right;
}
