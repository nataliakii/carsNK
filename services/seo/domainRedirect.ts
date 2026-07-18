import { getAllowedDomainHosts, getBaseUrl, getCanonicalHost } from "@config/domain";

const PUBLIC_FILE_REGEX = /\.[^/]+$/;
const DOMAIN_REDIRECT_EXCLUDED_PREFIXES = ["/api", "/_next"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function shouldRedirectToCanonicalHost(input: {
  hostname: string;
  pathname: string;
}): boolean {
  const host = String(input.hostname || "").trim().toLowerCase();
  const pathname = String(input.pathname || "/");
  if (!host || LOCAL_HOSTS.has(host)) return false;
  if (PUBLIC_FILE_REGEX.test(pathname)) return false;
  if (DOMAIN_REDIRECT_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;

  const canonicalHost = getCanonicalHost();
  if (host === canonicalHost) return false;

  const allowedDomainHosts = new Set(getAllowedDomainHosts());
  return allowedDomainHosts.has(host);
}

export function buildCanonicalRedirectUrl(requestUrl: string): string {
  const targetUrl = new URL(requestUrl);
  const canonicalUrl = new URL(getBaseUrl());
  targetUrl.protocol = canonicalUrl.protocol;
  targetUrl.host = canonicalUrl.host;
  return targetUrl.toString();
}
