import {
  RENTAL_STATE,
  ALL_RENTAL_STATES,
  RENTAL_STATE_TO_BOOKING_STATUS,
  canTransitionRentalState,
  applyRentalStateTransition,
  applyCompliancePaymentExpiration,
  resolveRentalState,
  blocksCalendar,
} from "@/domain/booking/rentalBookingState";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

describe("lifecycle vocabulary", () => {
  it("covers the marketplace lifecycle plus alternative states", () => {
    expect([...ALL_RENTAL_STATES].sort()).toEqual(
      [
        "ALTERNATIVE_ACCEPTED",
        "ALTERNATIVE_DECLINED",
        "ALTERNATIVE_OFFERED",
        "CANCELLED",
        "COMPLETED",
        "CONFIRMED",
        "DECLINED",
        "PARTNER_CONFIRMED",
        "PAYMENT_EXPIRED",
        "PAYMENT_PENDING",
        "REQUESTED",
      ].sort()
    );
  });

  it("maps every state onto an existing storage status", () => {
    const known = new Set(Object.values(BOOKING_STATUS));
    for (const state of ALL_RENTAL_STATES) {
      expect(known.has(RENTAL_STATE_TO_BOOKING_STATUS[state])).toBe(true);
    }
  });
});

describe("transitions", () => {
  it("follows the happy path", () => {
    expect(
      canTransitionRentalState(RENTAL_STATE.REQUESTED, RENTAL_STATE.PARTNER_CONFIRMED)
    ).toBe(true);
    expect(
      canTransitionRentalState(
        RENTAL_STATE.PARTNER_CONFIRMED,
        RENTAL_STATE.PAYMENT_PENDING
      )
    ).toBe(true);
    expect(
      canTransitionRentalState(RENTAL_STATE.PAYMENT_PENDING, RENTAL_STATE.CONFIRMED)
    ).toBe(true);
    expect(
      canTransitionRentalState(RENTAL_STATE.REQUESTED, RENTAL_STATE.DECLINED)
    ).toBe(true);
    expect(
      canTransitionRentalState(
        RENTAL_STATE.PAYMENT_PENDING,
        RENTAL_STATE.PAYMENT_EXPIRED
      )
    ).toBe(true);
  });

  it("stores PAYMENT_PENDING as PAYMENT_PROCESSING", () => {
    expect(RENTAL_STATE_TO_BOOKING_STATUS[RENTAL_STATE.PAYMENT_PENDING]).toBe(
      BOOKING_STATUS.PAYMENT_PROCESSING
    );
    const order = { bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION };
    applyRentalStateTransition(order, RENTAL_STATE.PARTNER_CONFIRMED);
    applyRentalStateTransition(order, RENTAL_STATE.PAYMENT_PENDING);
    expect(order.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_PROCESSING);
    expect(order.confirmed).toBeUndefined();
  });

  it("refuses to skip payment", () => {
    expect(
      canTransitionRentalState(RENTAL_STATE.REQUESTED, RENTAL_STATE.CONFIRMED)
    ).toBe(false);
  });

  it("allows an alternative to be offered while the unpaid marketplace request is live", () => {
    for (const from of [
      RENTAL_STATE.REQUESTED,
      RENTAL_STATE.PARTNER_CONFIRMED,
      RENTAL_STATE.PAYMENT_PENDING,
      RENTAL_STATE.PAYMENT_EXPIRED,
      RENTAL_STATE.ALTERNATIVE_DECLINED,
    ]) {
      expect(canTransitionRentalState(from, RENTAL_STATE.ALTERNATIVE_OFFERED)).toBe(
        true
      );
    }
  });

  it("does not allow automatic alternative from a paid confirmed booking", () => {
    expect(
      canTransitionRentalState(RENTAL_STATE.CONFIRMED, RENTAL_STATE.ALTERNATIVE_OFFERED)
    ).toBe(false);
    const order = { bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED };
    expect(applyRentalStateTransition(order, RENTAL_STATE.ALTERNATIVE_OFFERED).ok).toBe(
      false
    );
    expect(order.bookingStatus).toBe(BOOKING_STATUS.BOOKING_CONFIRMED);
  });

  it("treats cancelled and completed as terminal", () => {
    for (const to of ALL_RENTAL_STATES) {
      expect(canTransitionRentalState(RENTAL_STATE.CANCELLED, to)).toBe(false);
      expect(canTransitionRentalState(RENTAL_STATE.COMPLETED, to)).toBe(false);
    }
  });

  it("17. compliance expiration cannot force-expire paid/confirmed orders", () => {
    const paid = {
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "paid" },
    };
    expect(applyCompliancePaymentExpiration(paid).ok).toBe(false);
    expect(paid.bookingStatus).toBe(BOOKING_STATUS.BOOKING_CONFIRMED);
    const cancelled = { bookingStatus: BOOKING_STATUS.CUSTOMER_CANCELLED };
    expect(applyCompliancePaymentExpiration(cancelled).ok).toBe(false);
    expect(cancelled.bookingStatus).toBe(BOOKING_STATUS.CUSTOMER_CANCELLED);
    const pending = { bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING };
    expect(applyCompliancePaymentExpiration(pending).ok).toBe(true);
    expect(pending.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_EXPIRED);
    const alternative = {
      bookingStatus: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
    };
    expect(applyCompliancePaymentExpiration(alternative).ok).toBe(true);
    expect(alternative.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_EXPIRED);
  });
});

describe("resolving the state of an order", () => {
  it("reads the stored booking status when present", () => {
    expect(
      resolveRentalState({ bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED })
    ).toBe(RENTAL_STATE.CONFIRMED);
  });

  it("treats a paid legacy order as confirmed", () => {
    expect(resolveRentalState({ payment: { status: "paid" } })).toBe(
      RENTAL_STATE.CONFIRMED
    );
  });

  it("treats a legacy confirmed flag as partner-confirmed", () => {
    expect(resolveRentalState({ confirmed: true })).toBe(
      RENTAL_STATE.PARTNER_CONFIRMED
    );
  });

  it("defaults to requested", () => {
    expect(resolveRentalState({})).toBe(RENTAL_STATE.REQUESTED);
  });
});

describe("calendar blocking is unchanged", () => {
  it("blocks only from partner confirmation onwards", () => {
    expect(blocksCalendar(RENTAL_STATE.REQUESTED)).toBe(false);
    expect(blocksCalendar(RENTAL_STATE.ALTERNATIVE_OFFERED)).toBe(false);
    expect(blocksCalendar(RENTAL_STATE.PARTNER_CONFIRMED)).toBe(true);
    expect(blocksCalendar(RENTAL_STATE.CONFIRMED)).toBe(true);
    expect(blocksCalendar(RENTAL_STATE.CANCELLED)).toBe(false);
  });
});
