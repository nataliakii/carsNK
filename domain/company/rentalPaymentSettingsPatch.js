/**
 * Platform-only rental payment settings (Stripe prepayment mode / %).
 * Company admins may read these on the company document; only a superadmin
 * may write them through PATCH.
 */

import { isSuperAdminUser } from "@/domain/owners/ownerScope";

export const RENTAL_PAYMENTS_SUPERADMIN_ONLY =
  "Only platform superadmin can change rental payment settings";

export function hasRentalPaymentPatchFields(body) {
  return (
    body?.prepaymentPercent !== undefined ||
    (body?.rentalPayments != null && typeof body.rentalPayments === "object")
  );
}

/**
 * Parse rental-payment fields from a company PATCH body.
 * Missing fields → empty updates. Company admin sending them → 403.
 *
 * @param {object} body
 * @param {object|null|undefined} user
 * @returns {{ ok: true, updates: object } | { ok: false, status: number, error: string }}
 */
export function rentalPaymentUpdatesFromPatch(body, user) {
  if (!hasRentalPaymentPatchFields(body)) {
    return { ok: true, updates: {} };
  }
  if (!isSuperAdminUser(user)) {
    return {
      ok: false,
      status: 403,
      error: RENTAL_PAYMENTS_SUPERADMIN_ONLY,
    };
  }

  const updates = {};

  if (body?.prepaymentPercent !== undefined) {
    if (body.prepaymentPercent === null || body.prepaymentPercent === "") {
      updates.prepaymentPercent = null;
    } else {
      const n = Number(body.prepaymentPercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return {
          ok: false,
          status: 400,
          error: "prepaymentPercent must be 0–100 or empty",
        };
      }
      updates.prepaymentPercent = n;
    }
  }

  if (body?.rentalPayments != null && typeof body.rentalPayments === "object") {
    const timingRaw = String(body.rentalPayments.timing || "after_confirm")
      .trim()
      .toLowerCase();
    updates.rentalPayments = {
      stripeEnabled: Boolean(body.rentalPayments.stripeEnabled),
      timing:
        timingRaw === "before_confirm" ? "before_confirm" : "after_confirm",
    };
  }

  return { ok: true, updates };
}
