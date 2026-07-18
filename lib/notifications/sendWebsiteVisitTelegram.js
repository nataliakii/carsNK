import { COMPANY_ID } from "@config/company";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import {
  buildWebsiteVisitDedupeKey,
  formatWebsiteVisitTelegramMessage,
  isAllowedWebsiteVisitIp,
  isPrivateIp,
  matchesIgnoredWebsiteVisitIp,
  normalizeComparableIp,
  normalizeVisitLanguage,
  normalizeWebsiteVisitUrl,
  rememberWebsiteVisit,
} from "@/domain/visitors/websiteVisitNotification";

const COMPANY_CACHE_TTL_MS = 60 * 1000;
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const geoCache = new Map();
const visitDedupeCache = new Map();

let companyCache = {
  ts: 0,
  data: null,
};

export function __resetWebsiteVisitTelegramNotificationStateForTests() {
  geoCache.clear();
  visitDedupeCache.clear();
  companyCache = {
    ts: 0,
    data: null,
  };
}

async function getCompanyVisitSettings() {
  const now = Date.now();
  if (companyCache.data && now - companyCache.ts < COMPANY_CACHE_TTL_MS) {
    return companyCache.data;
  }

  await connectToDB();

  const company = await Company.findById(COMPANY_ID)
    .select("notSendIP1 notSendIP2 notSendIP3 notSendIP4")
    .lean();

  companyCache = {
    ts: now,
    data: company || {},
  };

  return companyCache.data;
}

async function getGeoFromIpApi(ip) {
  const normalizedIp = normalizeComparableIp(ip);
  if (!normalizedIp || isPrivateIp(normalizedIp)) {
    return { country: "", region: "", city: "" };
  }

  const cached = geoCache.get(normalizedIp);
  if (cached && Date.now() - cached.ts < GEO_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(
      normalizedIp
    )}?fields=status,country,regionName,city,message&lang=en`;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    const data = await response.json();

    if (!data || data.status !== "success") {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[website-visit] ip-api.com geolocation failed:", {
          ip: normalizedIp,
          status: data?.status,
          message: data?.message,
          httpStatus: response.status,
        });
      }
      return { country: "", region: "", city: "" };
    }

    const result = {
      country: data.country || "",
      region: data.regionName || "",
      city: data.city || "",
    };

    geoCache.set(normalizedIp, { ts: Date.now(), data: result });
    return result;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[website-visit] ip-api.com request error:",
        normalizedIp,
        error?.message || error
      );
    }
    return { country: "", region: "", city: "" };
  }
}

export async function sendWebsiteVisitTelegramNotification({
  url = "",
  ip = "",
  language = "",
  sessionId = "",
}) {
  const normalizedUrl = normalizeWebsiteVisitUrl(url);
  const normalizedIp = normalizeComparableIp(ip);
  const normalizedLanguage = normalizeVisitLanguage(language);

  if (!normalizedUrl) {
    return { sent: false, skipped: true, reason: "invalid_url" };
  }

  if (!isAllowedWebsiteVisitIp(normalizedIp)) {
    return { sent: false, skipped: true, reason: "private_or_missing_ip" };
  }

  let companySettings;
  try {
    companySettings = await getCompanyVisitSettings();
  } catch (error) {
    console.error("[website-visit] failed to load company settings:", error);
    if (companyCache.data) {
      companySettings = companyCache.data;
    } else {
      return { sent: false, skipped: true, reason: "company_unavailable" };
    }
  }

  if (matchesIgnoredWebsiteVisitIp(companySettings, normalizedIp)) {
    return { sent: false, skipped: true, reason: "ignored_ip" };
  }

  const dedupeKey = buildWebsiteVisitDedupeKey({
    sessionId,
    url: normalizedUrl,
    ip: normalizedIp,
  });
  const canSend = rememberWebsiteVisit(visitDedupeCache, dedupeKey);
  if (!canSend) {
    return { sent: false, skipped: true, reason: "duplicate_session_visit" };
  }

  try {
    const geo = await getGeoFromIpApi(normalizedIp);
    const message = formatWebsiteVisitTelegramMessage({
      url: normalizedUrl,
      ip: normalizedIp,
      language: normalizedLanguage,
      country: geo.country,
      region: geo.region,
      city: geo.city,
    });

    const sent = await sendTelegramDirect(message);
    if (!sent) {
      visitDedupeCache.delete(dedupeKey);
      return { sent: false, skipped: false, reason: "telegram_failed" };
    }

    return { sent: true, skipped: false, reason: null };
  } catch (error) {
    visitDedupeCache.delete(dedupeKey);
    console.error("[website-visit] notification failed:", error);
    return { sent: false, skipped: false, reason: "unexpected_error" };
  }
}
