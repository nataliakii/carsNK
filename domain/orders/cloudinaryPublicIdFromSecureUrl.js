/**
 * Извлекает Cloudinary public_id (без расширения файла) из HTTPS URL доставки.
 * Поддерживает res.cloudinary.com / cloudinary.com, сегменты трансформаций и v123…
 *
 * @param {string} url
 * @returns {string|null}
 */
export function cloudinaryPublicIdFromSecureUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (!trimmed.includes("cloudinary.com")) return null;
  let pathname;
  try {
    pathname = decodeURI(new URL(trimmed).pathname);
  } catch {
    return null;
  }
  const marker = "/upload/";
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const after = pathname.slice(idx + marker.length);
  const segments = after.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const versionIndex = segments.findIndex((s) => /^v\d+$/i.test(s));
  let pathSegments;
  if (versionIndex !== -1 && versionIndex < segments.length - 1) {
    pathSegments = segments.slice(versionIndex + 1);
  } else {
    let i = 0;
    while (i < segments.length && segments[i].includes(",")) {
      i += 1;
    }
    pathSegments = segments.slice(i);
  }
  if (pathSegments.length === 0) return null;
  const joined = pathSegments.join("/");
  const withoutExt = joined.replace(/\.[a-z0-9]+$/i, "");
  return withoutExt || null;
}
