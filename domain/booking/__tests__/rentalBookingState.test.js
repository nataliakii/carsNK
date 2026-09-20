import {
  RENTAL_STATE,
  ALL_RENTAL_STATES,
  RENTAL_STATE_TO_BOOKING_STATUS,
  canTransitionRentalState,
  resolveRentalState,
  blocksCalendar,
} from "@/domain/booking/rentalBookingState";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";

describe("lifecycle vocabulary", () => {
  it("covers exactly the nine agreed states", () => {
    expect([...ALL_RENTAL_STATES].sort()).toEqual(
      [
        "ALTERNATIVE_ACCEPTED",
        "ALTERNATIVE_DECLINED",
        "ALTERNATIVE_OFFERED",
        "CANCELLED",
        "COMPLETED",
        "CONFIRMED",
        "PARTNER_CONFIRMED",
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
  });

  it("refuses to skip payment", () => {
    expect(
      canTransitionRentalState(RENTAL_STATE.REQUESTED, RENTAL_STATE.CONFIRMED)
    ).toBe(false);
  });

  it("allows an alternative to be offered at any live stage", () => {
    for (const from of [
      RENTAL_STATE.REQUESTED,
      RENTAL_STATE.PARTNER_CONFIRMED,
      RENTAL_STATE.PAYMENT_PENDING,
      RENTAL_STATE.CONFIRMED,
    ]) {
      expect(canTransitionRentalState(from, RENTAL_STATE.ALTERNATIVE_OFFERED)).toBe(
        true
      );
    }
  });

  it("treats cancelled and completed as terminal", () => {
    for (const to of ALL_RENTAL_STATES) {
      expect(canTransitionRentalState(RENTAL_STATE.CANCELLED, to)).toBe(false);
      expect(canTransitionRentalState(RENTAL_STATE.COMPLETED, to)).toBe(false);
    }
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
