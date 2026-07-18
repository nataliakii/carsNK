/**
 * Cloudinary folder for order driving licence uploads:
 * carsnk/orders/{orderClientName-orderStartDate}/driving-licence
 */

import { getCloudinaryOrdersFolder } from "@config/cloudinary";

export function slugifyForCloudinaryFolderPart(raw, maxLen = 48) {
  const s = String(raw || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/@/g, "-at-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-");
  const out = s.slice(0, maxLen).replace(/^-|-$/g, "");
  return out || "x";
}

/**
 * @param {string} [customerName] — имя клиента (в slug попадает только оно + дата)
 * @param {string} [_email] — оставлен для совместимости вызовов, в путь не входит
 * @param {string|Date|number} [rentalStartRaw] — YYYY-MM-DD или ISO дата начала аренды
 * @returns {string} Cloudinary folder path (no leading slash)
 */
export function buildOrderDrivingLicenceFolderPath(
  customerName,
  _email,
  rentalStartRaw
) {
  const namePart = slugifyForCloudinaryFolderPart(customerName, 56);
  let datePart = "unknown-date";
  if (rentalStartRaw != null && rentalStartRaw !== "") {
    const str = String(rentalStartRaw).trim();
    const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(str);
    if (ymd) {
      datePart = ymd[1];
    } else {
      const t = Date.parse(str);
      if (!Number.isNaN(t)) {
        datePart = new Date(t).toISOString().slice(0, 10);
      }
    }
  }
  let segment = `${namePart}-${datePart}`
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  segment = segment.slice(0, 180);
  if (!segment) segment = "guest-unknown-date";
  return `${getCloudinaryOrdersFolder()}/${segment}/driving-licence`;
}
