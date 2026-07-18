import { v2 as cloudinary } from "cloudinary";

/**
 * Читает env в рантайме (без жёсткой подстановки на этапе сборки).
 * @param {string[]} keys — по порядку приоритета
 */
function firstTrimmed(...keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw == null || raw === "") continue;
    const t = String(raw).trim();
    if (t !== "") return t;
  }
  return "";
}

/** CLOUDINARY_URL без @hostname парсится неверно (hostname = часть ключа) — не использовать. */
function isUsableCloudinaryUrl(url) {
  if (!url) return false;
  const u = url.trim();
  if (!u.toLowerCase().startsWith("cloudinary://")) return false;
  const afterScheme = u.slice("cloudinary://".length);
  return afterScheme.includes("@");
}

/**
 * Настраивает SDK перед upload. Вызывать в начале API-роутов при необходимости.
 * Приоритет: явная тройка CLOUDINARY_* → NEXT_PUBLIC_* (совместимость) → валидный CLOUDINARY_URL.
 */
export function ensureCloudinaryConfigured() {
  const cloudName = firstTrimmed(
    "CLOUDINARY_CLOUD_NAME",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"
  );
  const apiKey = firstTrimmed(
    "CLOUDINARY_API_KEY",
    "NEXT_PUBLIC_CLOUDINARY_API_KEY"
  );
  const apiSecret = firstTrimmed(
    "CLOUDINARY_API_SECRET",
    "NEXT_PUBLIC_CLOUDINARY_API_SECRET"
  );

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return { ok: true };
  }

  const url = firstTrimmed("CLOUDINARY_URL");
  if (url && isUsableCloudinaryUrl(url)) {
    cloudinary.config(true);
    cloudinary.config({ secure: true });
    return { ok: true };
  }

  return {
    ok: false,
    message:
      "Cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or a full CLOUDINARY_URL with @cloud_name).",
  };
}

ensureCloudinaryConfigured();

export default cloudinary;
