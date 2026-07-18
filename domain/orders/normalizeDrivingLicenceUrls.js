export const MAX_DRIVING_LICENCE_URLS = 2;

/**
 * Accept only HTTPS Cloudinary URLs from client JSON (order create).
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeDrivingLicenceUrls(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const u = item.trim();
    if (!u.startsWith("https://")) continue;
    if (!u.includes("res.cloudinary.com") && !u.includes("cloudinary.com"))
      continue;
    if (u.length > 2048) continue;
    if (out.length >= MAX_DRIVING_LICENCE_URLS) break;
    if (!out.includes(u)) out.push(u);
  }
  return out;
}
