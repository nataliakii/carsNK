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

  test("company admin cannot write marketplaceBookingFeeBps", () => {
    const result = rentalPaymentUpdatesFromPatch(
      { marketplaceBookingFeeBps: 1500 },
      companyAdmin
    );
    expect(result).toEqual({
      ok: false,
      status: 403,
      error: RENTAL_PAYMENTS_SUPERADMIN_ONLY,
    });
  });

  test("superadmin can set a Booking Fee override in basis points", () => {
    const result = rentalPaymentUpdatesFromPatch(
      { marketplaceBookingFeeBps: 1500 },
      superadmin
    );
    expect(result).toEqual({
      ok: true,
      updates: { marketplaceBookingFeeBps: 1500 },
    });
  });

  test("superadmin can reset Booking Fee to platform default", () => {
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: null }, superadmin)
    ).toEqual({ ok: true, updates: { marketplaceBookingFeeBps: null } });
  });

  test("rejects invalid marketplace Booking Fee values", () => {
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: -1 }, superadmin).ok
    ).toBe(false);
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: 0 }, superadmin)
        .status
    ).toBe(400);
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: 10001 }, superadmin)
        .error
    ).toMatch(/100%/);
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: 50 }, superadmin)
        .error
    ).toMatch(/1%/);
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: 4000 }, superadmin)
        .error
    ).toMatch(/30%/);
    expect(
      rentalPaymentUpdatesFromPatch({ marketplaceBookingFeeBps: Number.NaN }, superadmin)
        .ok
    ).toBe(false);
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
