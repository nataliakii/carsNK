/**
 * orderGuard.js
 *
 * Guard layer for POST /api/order/add. Runs BEFORE the order controller.
 * Handles: ban check, rate limiting, suspicious behavior detection.
 * Order controller remains unchanged; no business logic here.
 *
 * WHY: All checks run in order (ban → rate limit → abuse). next() only if all pass.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { checkBan, createAutoBan } from "@/services/banService";
import { consume as rateLimitConsume } from "@/services/rateLimitService";
import {
  payloadHash,
  checkSuspiciousBefore,
  recordAttempt,
  ensureOrderAttemptsIndexes,
} from "@/services/orderAbuseService";

const JSON_CONTENT_TYPE = "application/json";

/**
 * Extract client context from request (IP, fingerprint, user-agent).
 * WHY: Proxies set x-forwarded-for; we use first hop. x-client-id is optional fingerprint.
 *
 * @param {Request} request - Next.js/Web API Request
 * @returns {{ ip: string, fingerprint: string | null, userAgent: string | null }}
 */
function extractClientContext(request) {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    (typeof forwarded === "string" && forwarded.split(",")[0]?.trim()) ||
    headers.get("x-real-ip") ||
    "unknown";
  const fingerprint =
    headers.get("x-client-id")?.trim() || null;
  const userAgent = headers.get("user-agent")?.trim() || null;
  return {
    ip: typeof ip === "string" ? ip : "unknown",
    fingerprint: fingerprint || null,
    userAgent,
  };
}

/**
 * Return a JSON Response with status and body.
 *
 * @param {number} status
 * @param {Object} body
 * @returns {Response}
 */
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": JSON_CONTENT_TYPE },
  });
}

/**
 * Wrap the POST handler so the guard runs first. Controller logic is unchanged.
 * Order: 1) ban check 2) rate limit 3) suspicious (identical payloads) → then call handler.
 * After handler: record attempt for failure/conflict/success and optionally auto-ban on too many failures.
 *
 * @param {function(Request): Promise<Response>} handler - Original POST handler (order controller)
 * @returns {function(Request): Promise<Response>}
 */
export function orderGuard(handler) {
  return async function guardedPost(request) {
    if (request.method !== "POST") {
      return handler(request);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, {
        code: "BAD_REQUEST",
        message: "Invalid JSON body",
      });
    }

    if (!body || typeof body !== "object") {
      return jsonResponse(400, {
        code: "BAD_REQUEST",
        message: "Body must be an object",
      });
    }

    // DB connection must be established by the route before calling this guard.
    await ensureOrderAttemptsIndexes();

    const { ip, fingerprint, userAgent } = extractClientContext(request);
    const rateLimitKey =
      fingerprint && fingerprint.length > 0
        ? `fp:${fingerprint}`
        : ip !== "unknown"
          ? `ip:${ip}`
          : `ua:${userAgent || "na"}`;
    const payloadHashValue = payloadHash(body);

    // Admin bypass: only if header is set AND user has valid admin session.
    // WHY: header alone is spoofable; session proves authenticity.
    const isAdminHeader = request.headers.get("x-admin-request") === "1";
    if (isAdminHeader) {
      const session = await getServerSession(authOptions);
      if (session?.user?.isAdmin) {
        const newHeaders = new Headers(request.headers);
        newHeaders.set("content-type", JSON_CONTENT_TYPE);
        const newRequest = new Request(request.url, {
          method: request.method,
          headers: newHeaders,
          body: JSON.stringify(body),
        });
        return handler(newRequest);
      }
      // Header set but no valid admin session — treat as regular client request, continue with guard checks.
    }

    // 1) Ban check
    const banResult = await checkBan(ip, fingerprint).catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("orderGuard: checkBan error", err);
      }
      return { banned: false };
    });

    if (banResult.banned && banResult.ban) {
      return jsonResponse(403, {
        code: "ORDER_BANNED",
        message: "Order creation is temporarily blocked",
        reason: banResult.ban.reason,
        until: banResult.ban.expiresAt,
      });
    }

    // 2) Rate limit
    try {
      await rateLimitConsume(rateLimitKey);
    } catch (err) {
      if (err && err.message === "RATE_LIMIT") {
        return jsonResponse(429, {
          code: "RATE_LIMIT",
          message: "Too many order attempts",
        });
      }
      if (process.env.NODE_ENV === "development") {
        console.error("orderGuard: rateLimit error", err);
      }
      return jsonResponse(503, {
        code: "SERVICE_UNAVAILABLE",
        message: "Rate limit check failed",
      });
    }

    // 3) Suspicious: identical payloads in short time
    const abusePre = await checkSuspiciousBefore(
      ip,
      fingerprint,
      payloadHashValue
    ).catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("orderGuard: checkSuspiciousBefore error", err);
      }
      return { suspicious: false };
    });

    if (abusePre.suspicious) {
      console.warn("ORDER_BLOCKED", { ip, fingerprint, payloadHashValue });
      return jsonResponse(403, {
        code: "ORDER_BLOCKED",
        message: "Order blocked due to suspicious activity",
      });
    }

    // Rebuild request so handler can call request.json() and get the same body.
    // Headers must be a new Headers instance so the one-off body stream is safe; set content-type and length.
    const newHeaders = new Headers(request.headers);
    newHeaders.set("content-type", JSON_CONTENT_TYPE);
    const newRequest = new Request(request.url, {
      method: request.method,
      headers: newHeaders,
      body: JSON.stringify(body),
    });

    let response;
    try {
      response = await handler(newRequest);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("orderGuard: handler error", err);
      }
      await recordAttempt(
        ip,
        fingerprint,
        payloadHashValue,
        "error"
      ).catch(() => {});
      throw err;
    }

    const status = response?.status ?? 500;
    const outcome =
      status === 201 || status === 202
        ? "success"
        : status === 409
          ? "conflict"
          : "error";

    await recordAttempt(ip, fingerprint, payloadHashValue, outcome).catch(
      () => {}
    );

    return response;
  };
}
