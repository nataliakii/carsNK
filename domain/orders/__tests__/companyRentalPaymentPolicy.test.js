/**
 * @jest-environment node
 */
import {
  resolveCompanyRentalPaymentPolicy,
  shouldChargeRentalOnCreate,
  shouldChargeRentalOnConfirm,
  isRentalConfirmBlockedByPayment,
  RENTAL_PAYMENT_TIMING,
  RENTAL_COLLECTION_MODES,
} from "../companyRentalPaymentPolicy.js";

function company(rentalPayments) {
  return { rentalPayments };
}

describe("companyRentalPaymentPolicy", () => {
  test("default → on_site", () => {
    const p = resolveCompanyRentalPaymentPolicy(company({}));
    expect(p.mode).toBe(RENTAL_COLLECTION_MODES.ON_SITE);
    expect(p.useStripe).toBe(false);
  });

  test("stripe + before_confirm → charge on create, block confirm until paid", () => {
    const p = resolveCompanyRentalPaymentPolicy(
      company({
        stripeEnabled: true,
        timing: RENTAL_PAYMENT_TIMING.BEFORE_CONFIRM,
      })
    );
    expect(shouldChargeRentalOnCreate(p, { isAdminSession: false })).toBe(true);
    expect(shouldChargeRentalOnConfirm(p)).toBe(false);
    expect(
      isRentalConfirmBlockedByPayment(
        {
          payment: { status: "pending" },
          authoritativePrice: { prepaymentMinor: 5000 },
        },
        p
      )
    ).toBe(true);
    expect(
      isRentalConfirmBlockedByPayment(
        {
          payment: { status: "paid" },
          authoritativePrice: { prepaymentMinor: 5000 },
        },
        p
      )
    ).toBe(false);
  });

  test("stripe + after_confirm → charge on confirm only", () => {
    const p = resolveCompanyRentalPaymentPolicy(
      company({
        stripeEnabled: true,
        timing: RENTAL_PAYMENT_TIMING.AFTER_CONFIRM,
      })
    );
    expect(shouldChargeRentalOnCreate(p)).toBe(false);
    expect(shouldChargeRentalOnConfirm(p)).toBe(true);
    expect(
      isRentalConfirmBlockedByPayment(
        { payment: { status: "pending" }, authoritativePrice: { prepaymentMinor: 5000 } },
        p
      )
    ).toBe(false);
  });

  test("Spain marketplace does not charge on create; checkout waits for partner confirm", () => {
    const p = resolveCompanyRentalPaymentPolicy(company({}), {
      stripeConfigured: true,
      bookingMode: "MARKETPLACE_REQUEST",
    });
    expect(p.useStripe).toBe(true);
    expect(p.timing).toBe(RENTAL_PAYMENT_TIMING.AFTER_CONFIRM);
    expect(
      shouldChargeRentalOnCreate(p, {
        isAdminSession: true,
        isClientOrder: true,
        bookingMode: "MARKETPLACE_REQUEST",
      })
    ).toBe(false);
    expect(
      shouldChargeRentalOnCreate(p, {
        isAdminSession: false,
        isClientOrder: true,
        bookingMode: "MARKETPLACE_REQUEST",
      })
    ).toBe(false);
    expect(
      shouldChargeRentalOnConfirm(p, { bookingMode: "MARKETPLACE_REQUEST" })
    ).toBe(false);
  });

  test("Spain marketplace without Stripe env stays explicit not-charge", () => {
    const p = resolveCompanyRentalPaymentPolicy(company({}), {
      stripeConfigured: false,
      bookingMode: "MARKETPLACE_REQUEST",
    });
    expect(p.useStripe).toBe(false);
    expect(
      shouldChargeRentalOnCreate(p, {
        isClientOrder: true,
        bookingMode: "MARKETPLACE_REQUEST",
      })
    ).toBe(false);
  });
});
