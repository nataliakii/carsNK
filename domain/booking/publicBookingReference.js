/**
 * Customer-safe booking reference.
 *
 * RVR- plus 5 unambiguous uppercase characters. O, 0, I and 1 are excluded.
 * Generated with a cryptographic RNG. Not derived from Mongo _id, the
 * numeric order number, a timestamp, or a counter.
 */

import crypto from "crypto";

export const PUBLIC_REFERENCE_PREFIX = "RVR-";
export const PUBLIC_REFERENCE_LENGTH = 5;
/** Crockford-style alphabet without O/0 and I/1. */
export const PUBLIC_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const REFERENCE_RE = /^RVR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

export function isValidPublicBookingReference(value) {
  return REFERENCE_RE.test(String(value || "").trim());
}

export function generatePublicBookingReference() {
  let body = "";
  const alphabet = PUBLIC_REFERENCE_ALPHABET;
  for (let i = 0; i < PUBLIC_REFERENCE_LENGTH; i += 1) {
    body += alphabet[crypto.randomInt(alphabet.length)];
  }
  return `${PUBLIC_REFERENCE_PREFIX}${body}`;
}

/**
 * Assign an immutable public reference on a platform order document.
 * Existing valid references are left unchanged. Historical orders without
 * one stay unset until they enter a flow that calls this.
 *
 * @param {object} doc mongoose order document
 * @returns {Promise<string>}
 */
export async function assignPublicBookingReference(doc) {
  if (!doc) return "";
  const { isPlatformBooking } = await import("@/domain/admin/rovaroContractorAdmin");
  if (!isPlatformBooking(doc)) return "";
  if (isValidPublicBookingReference(doc.publicReference)) {
    return doc.publicReference;
  }
  if (!doc._id) {
    const ref = generatePublicBookingReference();
    doc.publicReference = ref;
    return ref;
  }

  const OrderModel = doc.constructor?.findOneAndUpdate
    ? doc.constructor
    : (await import("@models/order")).Order;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ref = generatePublicBookingReference();
    try {
      const updated = await OrderModel.findOneAndUpdate(
        {
          _id: doc._id,
          $or: [
            { publicReference: { $exists: false } },
            { publicReference: null },
            { publicReference: "" },
          ],
        },
        { $set: { publicReference: ref } },
        { new: true }
      );
      if (isValidPublicBookingReference(updated?.publicReference)) {
        doc.publicReference = updated.publicReference;
        return updated.publicReference;
      }
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
    const current = await OrderModel.findById(doc._id)
      .select("publicReference")
      .lean();
    if (isValidPublicBookingReference(current?.publicReference)) {
      doc.publicReference = current.publicReference;
      return current.publicReference;
    }
  }
  throw new Error("public_reference_unavailable");
}
