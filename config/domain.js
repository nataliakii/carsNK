const DEFAULT_CANONICAL_URL = "https://natali-cars.com";

export const DOMAIN_CONFIG = {
  canonical: DEFAULT_CANONICAL_URL,
  allowedDomains: [
    "natali-cars.com",
    "www.natali-cars.com",
    "car.bbqr.site",
    "www.car.bbqr.site",
  ],
};

export function getBaseUrl() {
  return String(DOMAIN_CONFIG.canonical || DEFAULT_CANONICAL_URL).replace(/\/+$/, "");
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
  return DOMAIN_CONFIG.allowedDomains.map((host) => String(host).toLowerCase());
}
