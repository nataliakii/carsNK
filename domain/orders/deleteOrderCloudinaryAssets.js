import cloudinary, {
  ensureCloudinaryConfigured,
} from "@utils/cloudinary";
import { cloudinaryPublicIdFromSecureUrl } from "./cloudinaryPublicIdFromSecureUrl";

const DELETE_RESOURCES_BATCH = 100;

/**
 * Собирает уникальные public_id из поля drivingLicenceUrls заказа.
 * @param {{ drivingLicenceUrls?: unknown } | null | undefined} order
 * @returns {string[]}
 */
export function publicIdsFromOrderDrivingLicenceUrls(order) {
  const raw = order?.drivingLicenceUrls;
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const u of raw) {
    if (typeof u !== "string") continue;
    const id = cloudinaryPublicIdFromSecureUrl(u);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Удаляет изображения в Cloudinary по списку public_id (пакетами).
 * @param {string[]} publicIds
 * @returns {Promise<{ deleted: number; skipped?: boolean }>}
 */
export async function deleteCloudinaryImagesByPublicIds(publicIds) {
  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    return { deleted: 0, skipped: true };
  }
  const unique = [...new Set(publicIds.filter(Boolean))];
  if (unique.length === 0) {
    return { deleted: 0 };
  }
  let deleted = 0;
  for (let i = 0; i < unique.length; i += DELETE_RESOURCES_BATCH) {
    const batch = unique.slice(i, i + DELETE_RESOURCES_BATCH);
    await cloudinary.api.delete_resources(batch, {
      resource_type: "image",
      invalidate: true,
    });
    deleted += batch.length;
  }
  return { deleted };
}

/**
 * Удаляет фото прав (и любые другие изображения заказа из drivingLicenceUrls) в Cloudinary.
 * Ошибки API не пробрасываются — логируются вызывающим кодом.
 *
 * @param {{ drivingLicenceUrls?: unknown } | null | undefined} order
 */
export async function deleteOrderCloudinaryAssets(order) {
  const ids = publicIdsFromOrderDrivingLicenceUrls(order);
  if (ids.length === 0) {
    return { deleted: 0 };
  }
  return deleteCloudinaryImagesByPublicIds(ids);
}
