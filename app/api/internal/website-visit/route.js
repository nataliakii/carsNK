import { NextResponse } from "next/server";
import {
  createWebsiteVisitAuthToken,
  extractClientIp,
  getRequestCookieValue,
  getWebsiteVisitIpForHost,
  isAllowedWebsiteVisitIp,
  isLikelyHumanWebsiteVisitClientRequest,
  normalizeComparableIp,
  normalizeVisitLanguage,
  WEBSITE_VISIT_AUTH_HEADER,
  WEBSITE_VISIT_SESSION_COOKIE,
} from "@/domain/visitors/websiteVisitNotification";
import { sendWebsiteVisitTelegramNotification } from "@/lib/notifications/sendWebsiteVisitTelegram";

export const runtime = "nodejs";

async function isAuthorized(request) {
  const expectedToken = await createWebsiteVisitAuthToken();
  if (!expectedToken) {
    return false;
  }

  const actualToken = request.headers.get(WEBSITE_VISIT_AUTH_HEADER)?.trim() || "";
  return actualToken.length > 0 && actualToken === expectedToken;
}

async function getAuthorizationMode(request) {
  if (await isAuthorized(request)) {
    return "internal";
  }

  if (isLikelyHumanWebsiteVisitClientRequest(request)) {
    return "browser";
  }

  return null;
}

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request) {
  const authorizationMode = await getAuthorizationMode(request);
  if (!authorizationMode) {
    return json({ success: false, message: "Unauthorized" }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON body" }, 400);
  }

  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  const language = normalizeVisitLanguage(payload?.language);
  const sessionId =
    authorizationMode === "browser"
      ? getRequestCookieValue(request, WEBSITE_VISIT_SESSION_COOKIE)
      : typeof payload?.sessionId === "string"
        ? payload.sessionId.trim()
        : "";

  const ip =
    authorizationMode === "browser"
      ? getWebsiteVisitIpForHost(extractClientIp(request), new URL(request.url).hostname)
      : normalizeComparableIp(payload?.ip);

  if (!url) {
    return json({ success: false, message: "URL is required" }, 400);
  }

  if (!isAllowedWebsiteVisitIp(ip)) {
    return json({ success: false, message: "Invalid client IP" }, 400);
  }

  const result = await sendWebsiteVisitTelegramNotification({
    url,
    ip,
    language,
    sessionId,
  });

  return json({
    success: true,
    ...result,
  });
}
