/**
 * Internal return path for the admin login redirect.
 * Rejects absolute, protocol-relative, and off-site targets.
 */

const MAX_LENGTH = 512;

export function safeInternalReturnPath(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || raw.length > MAX_LENGTH) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return null;
  if (decoded.includes("\\") || decoded.includes("://")) return null;
  if (/[\u0000-\u001F\u007F]/.test(decoded)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return null;

  const withoutHash = decoded.split("#")[0];
  const queryAt = withoutHash.indexOf("?");
  const pathname = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  if (!pathname.startsWith("/") || pathname.includes("//")) return null;
  if (!/^\/[A-Za-z0-9._~/-]*$/.test(pathname)) return null;
  return withoutHash;
}

export function loginUrlForReturn(returnPath) {
  const safe = safeInternalReturnPath(returnPath);
  if (!safe) return "/login";
  return `/login?returnTo=${encodeURIComponent(safe)}`;
}

export function destinationAfterLogin(returnTo) {
  return safeInternalReturnPath(returnTo) || "/admin";
}
