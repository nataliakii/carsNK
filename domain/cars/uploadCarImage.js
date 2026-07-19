/**
 * Upload a car image File/Blob to Cloudinary; returns public_id.
 */

import cloudinary, {
  ensureCloudinaryConfigured,
} from "@utils/cloudinary";
import { getCloudinaryCarsFolder } from "@config/cloudinary";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * @param {File|Blob} file
 * @returns {Promise<string>} Cloudinary public_id
 */
export async function uploadCarImageFile(file) {
  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    throw new Error(cfg.message || "Cloudinary not configured");
  }
  if (!file) {
    throw new Error("No image file");
  }
  const type = String(file.type || "").toLowerCase();
  if (type && !ALLOWED.has(type)) {
    throw new Error("Invalid file type. Use JPEG, PNG or WebP");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const stream = require("stream");
    const passthrough = new stream.PassThrough();
    passthrough.end(buffer);

    cloudinary.uploader
      .upload_stream(
        {
          folder: getCloudinaryCarsFolder(),
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            reject(new Error("Failed to upload image to Cloudinary"));
          } else {
            resolve(result.public_id);
          }
        }
      )
      .end(passthrough.read());
  });
}
