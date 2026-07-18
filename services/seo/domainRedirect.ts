import {
  getApexHostFor,
  getBaseUrl,
  getCanonicalHost,
} from "@config/domain";

const PUBLIC_FILE_REGEX = /\.[^/]+$/;
const DOMAIN_REDIRECT_EXCLUDED_PREFIXES = ["/api", "/_next"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Redirect only www → apex for the same brand.
 * carsnk.gr and cars.bbqr.site both serve the app — no cross-domain redirect.
 */
export function shouldRedirectToCanonicalHost(input: {
  hostname: string;
  pathname: string;
}): boolean {
  const host = String(input.hostname || "")
    .trim()
    .toLowerCase();
  const pathname = String(input.pathname || "/");
  if (!host || LOCAL_HOSTS.has(host)) return false;
  if (PUBLIC_FILE_REGEX.test(pathname)) return false;
  if (
    DOMAIN_REDIRECT_EXCLUDED_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    )
  ) {
    return false;
  }

  // Peer apex hosts (carsnk.gr, cars.bbqr.site) stay as-is
  if (host === getCanonicalHost()) return false;
  if (!getApexHostFor(host)) return false;

  return true;
}

/**
 * Build redirect URL for www → matching apex (not always primary SEO host).
 */
export function buildCanonicalRedirectUrl(requestUrl: string): string {
  const targetUrl = new URL(requestUrl);
  const apex = getApexHostFor(targetUrl.hostname);
  if (apex) {
    targetUrl.protocol = "https:";
    targetUrl.host = apex;
    return targetUrl.toString();
  }

  // Fallback: primary canonical (should not be hit for normal serving hosts)
  const canonicalUrl = new URL(getBaseUrl());
  targetUrl.protocol = canonicalUrl.protocol;
  targetUrl.host = canonicalUrl.host;
  return targetUrl.toString();
}
