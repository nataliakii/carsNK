import crypto from "crypto";

/**
 * Timing-safe comparison of a presented secret against CRON_SECRET.
 * Returns false when no secret is configured — there is no weak default.
 */
export function expectedCronSecret() {
  return String(process.env.CRON_SECRET || "").trim();
}

export function presentedCronSecret(request) {
  const authorization = String(
    request?.headers?.get?.("authorization") || ""
  ).trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization);
  if (bearer) return bearer[1].trim();
  return String(
    request?.headers?.get?.("x-cron-secret") ||
      request?.headers?.get?.("x-booking-hold-cron-secret") ||
      ""
  ).trim();
}

export function isAuthorizedCronRequest(request) {
  const expected = expectedCronSecret();
  if (!expected) return false;
  const presented = presentedCronSecret(request);
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
