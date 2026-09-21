/**
 * @jest-environment node
 */
import { ROLE } from "@models/user";
import {
  hasRentalPaymentPatchFields,
  rentalPaymentUpdatesFromPatch,
  RENTAL_PAYMENTS_SUPERADMIN_ONLY,
} from "../rentalPaymentSettingsPatch";

const superadmin = { role: ROLE.SUPERADMIN };
const companyAdmin = { role: ROLE.ADMIN };

describe("rentalPaymentUpdatesFromPatch", () => {
  test("does not treat a normal company PATCH as a rental-payment write", () => {
    expect(hasRentalPaymentPatchFields({ name: "Acme" })).toBe(false);
    expect(rentalPaymentUpdatesFromPatch({ name: "Acme" }, companyAdmin)).toEqual(
      { ok: true, updates: {} }
    );
  });

  test("company admin cannot write rental payment fields", () => {
    const result = rentalPaymentUpdatesFromPatch(
      {
        rentalPayments: { stripeEnabled: true, timing: "before_confirm" },
        prepaymentPercent: 15,
      },
      companyAdmin
    );
    expect(result).toEqual({
      ok: false,
      status: 403,
      error: RENTAL_PAYMENTS_SUPERADMIN_ONLY,
    });
  });

  test("company admin cannot sneak rentalPayments into a mixed PATCH", () => {
    const result = rentalPaymentUpdatesFromPatch(
      { name: "Acme", rentalPayments: { stripeEnabled: true } },
      companyAdmin
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  test("superadmin can set Stripe mode, timing, and percent", () => {
    const result = rentalPaymentUpdatesFromPatch(
      {
        rentalPayments: { stripeEnabled: true, timing: "before_confirm" },
        prepaymentPercent: 20,
      },
      superadmin
    );
    expect(result).toEqual({
      ok: true,
      updates: {
        prepaymentPercent: 20,
        rentalPayments: {
          stripeEnabled: true,
          timing: "before_confirm",
        },
      },
    });
  });

  test("superadmin can clear prepaymentPercent", () => {
    expect(
      rentalPaymentUpdatesFromPatch({ prepaymentPercent: "" }, superadmin)
    ).toEqual({ ok: true, updates: { prepaymentPercent: null } });
  });

  test("rejects an out-of-range percent even for superadmin", () => {
    const result = rentalPaymentUpdatesFromPatch(
      { prepaymentPercent: 150 },
      superadmin
    );
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "prepaymentPercent must be 0–100 or empty",
    });
  });
});
