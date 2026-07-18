/**
 * CarsNK Cloudinary layout — single source of truth for Media Library folders.
 *
 * Root folder: carsnk
 *   carsnk/cars          — fleet photos
 *   carsnk/orders/...    — order driving-licence uploads
 *
 * Credentials come from env (CLOUDINARY_* / NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME).
 */

const DEFAULT_ROOT_FOLDER = "carsnk";

export function getCloudinaryRootFolder() {
  const fromEnv = String(process.env.CLOUDINARY_ROOT_FOLDER || "").trim();
  return fromEnv || DEFAULT_ROOT_FOLDER;
}

/** Fleet car photos: carsnk/cars */
export function getCloudinaryCarsFolder() {
  return `${getCloudinaryRootFolder()}/cars`;
}

/**
 * Order driving-licence base: carsnk/orders
 * Full path is built in domain/orders/orderDrivingLicenceFolder.js
 */
export function getCloudinaryOrdersFolder() {
  return `${getCloudinaryRootFolder()}/orders`;
}

/** Default placeholder public_id — upload once to Media Library as carsnk/NO_PHOTO. */
export const CLOUDINARY_PLACEHOLDER_PUBLIC_ID = "carsnk/NO_PHOTO";

/** Server-side: allows CLOUDINARY_PLACEHOLDER_PUBLIC_ID env override. */
export function getCloudinaryPlaceholderPublicId() {
  const fromEnv = String(process.env.CLOUDINARY_PLACEHOLDER_PUBLIC_ID || "").trim();
  return fromEnv || CLOUDINARY_PLACEHOLDER_PUBLIC_ID;
}
