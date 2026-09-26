/**
 * @jest-environment node
 */
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  BOOKING_PAYMENT_STATE,
  PAYMENT_LINK_EXPIRED_LABEL_KEY,
  paymentStatusChipForOrder,
  resolveBookingPaymentState,
} from "../bookingPaymentStatus";

function order(overrides = {}) {
  return {
    source: "PLATFORM",
    my_order: true,
    bookingMode: "MARKETPLACE_REQUEST",
    bookingStatus: BOOKING_STATUS.PAYMENT_EXPIRED,
    partnerConfirmedAt: new Date("2026-09-21T18:00:00.000Z"),
    payment: {
      status: "expired",
      provider: "stripe",
      providerPaymentId: "cs_old",
      checkoutUrl: "",
      expiresAt: new Date("2026-09-21T19:00:00.000Z"),
    },
    ...overrides,
  };
}

describe("resolveBookingPaymentState", () => {
  const now = new Date("2026-09-22T10:00:00.000Z");

  test("returns PAYMENT_LINK_EXPIRED only for an unpaid confirmed platform booking with an expired Stripe link", () => {
    const state = resolveBookingPaymentState(order(), { now });
    expect(state.state).toBe(BOOKING_PAYMENT_STATE.PAYMENT_LINK_EXPIRED);
    expect(state.labelKey).toBe(PAYMENT_LINK_EXPIRED_LABEL_KEY);
    expect(paymentStatusChipForOrder(order(), { now })).toMatchObject({
      id: "payment-link-expired",
      labelKey: "paymentLinkExpired",
    });
  });

  test("does not mark internal, unconfirmed, paid, or active-link bookings as expired", () => {
    expect(
      resolveBookingPaymentState(order({ source: "INTERNAL", my_order: false }), {
        now,
      }).state
    ).toBe(BOOKING_PAYMENT_STATE.NONE);

    expect(
      resolveBookingPaymentState(
        order({
          bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
          partnerConfirmedAt: null,
          companyEmailDecision: "",
        }),
        { now }
      ).state
    ).toBe(BOOKING_PAYMENT_STATE.NONE);

    expect(
      resolveBookingPaymentState(
        order({
          bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
          payment: {
            status: "paid",
            provider: "stripe",
            providerPaymentId: "cs_paid",
          },
        }),
        { now }
      ).state
    ).toBe(BOOKING_PAYMENT_STATE.PAID);

    expect(
      resolveBookingPaymentState(
        order({
          bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
          payment: {
            status: "pending",
            provider: "stripe",
            providerPaymentId: "cs_active",
            checkoutUrl: "https://checkout.stripe.com/c/pay/cs_active",
            expiresAt: new Date("2026-09-22T11:00:00.000Z"),
          },
        }),
        { now }
      ).state
    ).toBe(BOOKING_PAYMENT_STATE.PAYMENT_LINK_ACTIVE);
  });
});
