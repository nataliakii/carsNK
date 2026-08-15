import { createHash, randomBytes } from "crypto";

export function hashResetToken(rawToken) {
  return createHash("sha256").update(String(rawToken)).digest("hex");
}

export function createPasswordResetToken(ttlMs = 60 * 60 * 1000) {
  const rawToken = randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + ttlMs),
  };
}

/**
 * Public site origin for reset links.
 * Prefer request Host (dual-domain), then NEXTAUTH_URL.
 */
export function getRequestOrigin(request) {
  const xfProto = request.headers.get("x-forwarded-proto");
  const xfHost = request.headers.get("x-forwarded-host");
  const host = xfHost || request.headers.get("host");
  if (host) {
    const proto =
      xfProto ||
      (String(host).includes("localhost") ? "http" : "https");
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  const envUrl = String(process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
  if (envUrl) return envUrl;
  return "http://localhost:3026";
}
