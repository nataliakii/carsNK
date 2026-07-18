import { getAllowedDomainHosts } from "@config/domain";
export const WEBSITE_VISIT_SESSION_COOKIE = "nc_visit_sid";
export const WEBSITE_VISIT_AUTH_HEADER = "x-website-visit-token";
export const WEBSITE_VISIT_DEDUPE_TTL_MS = 10 * 60 * 1000;
const LOCAL_WEBSITE_VISIT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PRODUCTION_WEBSITE_VISIT_HOSTS = new Set(getAllowedDomainHosts());
const INTERNAL_WEBSITE_VISIT_QUERY_PARAMS = new Set([
  "_rsc",
  "__flight__",
  "__nextDataReq",
  "__nextLocale",
  "__nextDefaultLocale",
]);

const BOT_USER_AGENT_RE =
  /(bot|crawler|spider|facebookexternalhit|slackbot|telegrambot|discordbot|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|semrushbot|ahrefsbot)/i;
const SCRIPTED_USER_AGENT_RE =
  /(headless|phantomjs|selenium|playwright|puppeteer|cypress|curl|wget|python|aiohttp|axios|node-fetch|undici|okhttp|go-http-client|postmanruntime|insomnia|libwww-perl|scrapy|httpclient|java\/)/i;
const BROWSER_USER_AGENT_RE =
  /(mozilla\/5\.0|applewebkit\/|chrome\/|safari\/|firefox\/|edg\/|opr\/)/i;

function getHeader(source, name) {
  if (!source) return "";

  if (typeof source.get === "function") {
    const value = source.get(name);
    return typeof value === "string" ? value.trim() : "";
  }

  const raw = source[name];
  return typeof raw === "string" ? raw.trim() : "";
}

export function isLocalWebsiteVisitNotificationsEnabled() {
  const raw =
    typeof process !== "undefined"
      ? String(process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS || "").trim().toLowerCase()
      : "";

  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function normalizeComparableIp(value) {
  if (typeof value !== "string") return "";

  let ip = value.trim();
  if (!ip) return "";

  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.replace(/:\d+$/, "");
  }

  ip = ip.split("%")[0].trim().toLowerCase();
  if (!ip) return "";

  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7).trim();
  }

  return ip;
}

function isPrivateIpv4(ip) {
  if (!ip) return true;
  if (ip === "0.0.0.0") return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("0.")) return true;
  if (ip.startsWith("172.")) {
    const secondOctet = Number(ip.split(".")[1]);
    return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
  }
  return false;
}

export function isPrivateIp(value) {
  const ip = normalizeComparableIp(value);
  if (!ip) return true;

  if (!ip.includes(":")) {
    return isPrivateIpv4(ip);
  }

  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.startsWith("fe80:")) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true;

  return false;
}

export function isLocalWebsiteVisitHost(hostname) {
  const host = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  return LOCAL_WEBSITE_VISIT_HOSTS.has(host);
}

function firstForwardedIp(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const candidates = value
    .split(",")
    .map((part) => normalizeComparableIp(part))
    .filter(Boolean);

  if (candidates.length === 0) return "";
  return candidates.find((candidate) => !isPrivateIp(candidate)) || candidates[0];
}

export function extractClientIp(request) {
  const headers = request?.headers || request;

  const forwarded = firstForwardedIp(getHeader(headers, "x-forwarded-for"));
  if (forwarded) return forwarded;

  const realIp = normalizeComparableIp(getHeader(headers, "x-real-ip"));
  if (realIp) return realIp;

  const requestIp = normalizeComparableIp(request?.ip);
  if (requestIp) return requestIp;

  return "";
}

export function normalizeVisitLanguage(value) {
  if (typeof value !== "string") return "unknown";
  const raw = value.trim().toLowerCase();
  if (!raw) return "unknown";

  const firstToken = raw.split(",")[0]?.split(";")[0]?.trim() || raw;
  const normalized = firstToken.replace(/_/g, "-");
  const primary = normalized.split("-")[0]?.trim();
  return primary || "unknown";
}

function hasInternalWebsiteVisitSearchParams(searchParams) {
  if (!searchParams || typeof searchParams.has !== "function") {
    return false;
  }

  for (const name of INTERNAL_WEBSITE_VISIT_QUERY_PARAMS) {
    if (searchParams.has(name)) {
      return true;
    }
  }

  return false;
}

function getRequestUrl(request) {
  const nextUrl = request?.nextUrl;
  if (nextUrl && typeof nextUrl === "object" && nextUrl.searchParams) {
    return nextUrl;
  }

  const rawUrl = typeof request?.url === "string" ? request.url.trim() : "";
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader) {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) {
    return new Map();
  }

  const cookies = new Map();

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!name) continue;

    cookies.set(name, value);
  }

  return cookies;
}

function matchesRequestHost(value, expectedHost) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (typeof expectedHost !== "string" || !expectedHost.trim()) return false;

  try {
    const parsed = new URL(value.trim());
    return parsed.host.trim().toLowerCase() === expectedHost.trim().toLowerCase();
  } catch {
    return false;
  }
}

export function getRequestCookieValue(request, cookieName) {
  if (typeof cookieName !== "string" || !cookieName.trim()) {
    return "";
  }

  const directCookieValue = request?.cookies?.get?.(cookieName)?.value;
  if (typeof directCookieValue === "string" && directCookieValue.trim()) {
    return directCookieValue.trim();
  }

  const headers = request?.headers || request;
  const cookieHeader = getHeader(headers, "cookie");
  const parsed = parseCookieHeader(cookieHeader);
  return parsed.get(cookieName)?.trim() || "";
}

export function isLikelyBotUserAgent(userAgent) {
  if (typeof userAgent !== "string" || !userAgent.trim()) return false;
  return BOT_USER_AGENT_RE.test(userAgent);
}

export function isSuspiciousVisitUserAgent(userAgent) {
  if (typeof userAgent !== "string" || !userAgent.trim()) {
    return true;
  }

  const normalized = userAgent.trim();
  if (BOT_USER_AGENT_RE.test(normalized)) return true;
  if (SCRIPTED_USER_AGENT_RE.test(normalized)) return true;
  return !BROWSER_USER_AGENT_RE.test(normalized);
}

export function shouldSkipWebsiteVisitRequest(request) {
  const method = String(request?.method || "GET").toUpperCase();
  if (method !== "GET") return true;

  const headers = request?.headers || request;
  const requestUrl = getRequestUrl(request);
  const purpose = getHeader(headers, "purpose").toLowerCase();
  if (purpose === "prefetch") return true;

  if (getHeader(headers, "next-router-prefetch")) return true;
  if (getHeader(headers, "x-middleware-prefetch")) return true;
  if (getHeader(headers, "rsc")) return true;
  if (getHeader(headers, "next-router-state-tree")) return true;
  if (getHeader(headers, "x-nextjs-data")) return true;

  const accept = getHeader(headers, "accept").toLowerCase();
  if (accept.includes("text/x-component")) return true;

  if (requestUrl && hasInternalWebsiteVisitSearchParams(requestUrl.searchParams)) {
    return true;
  }

  const secFetchMode = getHeader(headers, "sec-fetch-mode").toLowerCase();
  if (secFetchMode && secFetchMode !== "navigate") {
    return true;
  }

  const secFetchDest = getHeader(headers, "sec-fetch-dest").toLowerCase();
  if (secFetchDest && secFetchDest !== "document") {
    return true;
  }

  const userAgent = getHeader(headers, "user-agent");
  if (isLikelyBotUserAgent(userAgent)) return true;

  return false;
}

export function isLikelyHumanWebsiteVisitClientRequest(request) {
  const method = String(request?.method || "GET").toUpperCase();
  if (method !== "POST") return false;

  const requestUrl = getRequestUrl(request);
  if (!requestUrl || !isAllowedWebsiteVisitHost(requestUrl.hostname)) {
    return false;
  }

  const headers = request?.headers || request;
  const sessionId = getRequestCookieValue(request, WEBSITE_VISIT_SESSION_COOKIE);
  if (!sessionId) return false;

  const clientMarker = getHeader(headers, "x-website-visit-client").toLowerCase();
  if (clientMarker !== "browser") {
    return false;
  }

  const userAgent = getHeader(headers, "user-agent");
  if (isSuspiciousVisitUserAgent(userAgent)) {
    return false;
  }

  const origin = getHeader(headers, "origin");
  const referer = getHeader(headers, "referer");
  if (
    !matchesRequestHost(origin, requestUrl.host) &&
    !matchesRequestHost(referer, requestUrl.host)
  ) {
    return false;
  }

  const secFetchSite = getHeader(headers, "sec-fetch-site").toLowerCase();
  if (
    secFetchSite &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "same-site"
  ) {
    return false;
  }

  const secFetchMode = getHeader(headers, "sec-fetch-mode").toLowerCase();
  if (
    secFetchMode &&
    secFetchMode !== "cors" &&
    secFetchMode !== "same-origin" &&
    secFetchMode !== "no-cors"
  ) {
    return false;
  }

  return true;
}

export function isProductionWebsiteHost(hostname) {
  const host = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  return PRODUCTION_WEBSITE_VISIT_HOSTS.has(host);
}

export function isAllowedWebsiteVisitHost(hostname) {
  if (isProductionWebsiteHost(hostname)) return true;
  return (
    isLocalWebsiteVisitNotificationsEnabled() && isLocalWebsiteVisitHost(hostname)
  );
}

export function isAllowedWebsiteVisitIp(value) {
  const ip = normalizeComparableIp(value);
  if (!ip) return false;
  if (!isPrivateIp(ip)) return true;
  return (
    isLocalWebsiteVisitNotificationsEnabled() &&
    (ip === "127.0.0.1" || ip === "::1" || ip === "0:0:0:0:0:0:0:1")
  );
}

export function getWebsiteVisitIpForHost(ip, hostname) {
  const normalizedIp = normalizeComparableIp(ip);
  if (normalizedIp) return normalizedIp;

  if (
    isLocalWebsiteVisitNotificationsEnabled() &&
    isLocalWebsiteVisitHost(hostname)
  ) {
    return "127.0.0.1";
  }

  return "";
}

export function normalizeWebsiteVisitUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value.trim());
    url.hash = "";

    for (const name of INTERNAL_WEBSITE_VISIT_QUERY_PARAMS) {
      url.searchParams.delete(name);
    }

    return isAllowedWebsiteVisitHost(url.hostname) ? url.toString() : "";
  } catch {
    return "";
  }
}

export function getIgnoredWebsiteVisitIps(companyDoc) {
  return [
    companyDoc?.notSendIP1,
    companyDoc?.notSendIP2,
    companyDoc?.notSendIP3,
    companyDoc?.notSendIP4,
  ]
    .map((value) => normalizeComparableIp(value))
    .filter(Boolean);
}

export function matchesIgnoredWebsiteVisitIp(companyDoc, ip) {
  const normalizedIp = normalizeComparableIp(ip);
  if (!normalizedIp) return false;
  return getIgnoredWebsiteVisitIps(companyDoc).includes(normalizedIp);
}

export function buildWebsiteVisitDedupeKey({ sessionId = "", url = "", ip = "" }) {
  const normalizedSessionId =
    typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : "anonymous";
  const normalizedIp = normalizeComparableIp(ip) || "unknown";

  // One browser visit may hit several URLs during redirects/bootstrap.
  // Deduplicate by session + IP so Telegram gets a single visit message.
  return `${normalizedSessionId}|${normalizedIp}`;
}

export function rememberWebsiteVisit(cache, key, now = Date.now(), ttlMs = WEBSITE_VISIT_DEDUPE_TTL_MS) {
  if (!(cache instanceof Map)) {
    throw new Error("rememberWebsiteVisit requires a Map cache");
  }
  if (!key) return true;

  for (const [cachedKey, timestamp] of cache.entries()) {
    if (!Number.isFinite(timestamp) || now - timestamp >= ttlMs) {
      cache.delete(cachedKey);
    }
  }

  const previous = cache.get(key);
  if (Number.isFinite(previous) && now - previous < ttlMs) {
    return false;
  }

  cache.set(key, now);
  return true;
}

function printable(value) {
  if (typeof value !== "string") return "Неизвестно";
  const normalized = value.trim();
  return normalized || "Неизвестно";
}

export function formatWebsiteVisitTelegramMessage({
  url = "",
  ip = "",
  country = "",
  region = "",
  city = "",
  language = "",
}) {
  return [
    "Новый визит на сайт:",
    `Страница: ${printable(url)}`,
    `Язык: ${printable(normalizeVisitLanguage(language))}`,
    `IP: ${printable(ip)}`,
    `Страна: ${printable(country)}`,
    `Регион: ${printable(region)}`,
    `Город: ${printable(city)}`,
  ].join("\n");
}

async function sha256Hex(value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof TextEncoder === "undefined") {
    return "";
  }

  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (part) =>
    part.toString(16).padStart(2, "0")
  ).join("");
}

export async function createWebsiteVisitAuthToken() {
  const internalToken =
    typeof process !== "undefined" ? String(process.env.INTERNAL_API_TOKEN || "").trim() : "";
  const fallbackBotUrl =
    typeof process !== "undefined" ? String(process.env.TELEGRAM_BOT_URL || "").trim() : "";
  const fallbackChatId =
    typeof process !== "undefined" ? String(process.env.TELEGRAM_CHAT_ID || "").trim() : "";

  const seed = internalToken || (fallbackBotUrl && fallbackChatId
    ? `${fallbackBotUrl}|${fallbackChatId}|website-visit`
    : "");

  if (!seed) return "";
  return await sha256Hex(seed);
}
