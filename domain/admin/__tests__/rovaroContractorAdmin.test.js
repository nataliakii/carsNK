/**
 * @jest-environment node
 */
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { getOrderColor } from "@/domain/orders/getOrderColor";
import {
  BOOKING_SOURCE,
  CALENDAR_TONE,
  assertBookingSourceUnchanged,
  buildContractorOrdersExport,
  classifyBookingSourceRecord,
  CONTRACTOR_ADMIN_INVARIANTS,
  hasCalendarProblem,
  internalRecordBlocksAvailability,
  isInternalBooking,
  isPlatformBooking,
  matchesBookingSourceFilter,
  resolveBookingSource,
  resolveContractorCalendarTone,
  sourceForNewOrder,
  summarizeContractorAdminTotals,
} from "../rovaroContractorAdmin";

describe("rovaroContractorAdmin", () => {
  test("proven my_order writes: true is PLATFORM, false is INTERNAL, missing is review", () => {
    expect(classifyBookingSourceRecord({ my_order: true })).toMatchObject({
      source: BOOKING_SOURCE.PLATFORM,
      ambiguous: false,
      legacy: true,
    });
    expect(classifyBookingSourceRecord({ my_order: false })).toMatchObject({
      source: BOOKING_SOURCE.INTERNAL,
      ambiguous: false,
      legacy: true,
    });
    expect(classifyBookingSourceRecord({})).toMatchObject({
      source: null,
      ambiguous: true,
    });
    expect(classifyBookingSourceRecord({}).reasons).toContain("missing_my_order");
    expect(resolveBookingSource({ my_order: true })).toBe(BOOKING_SOURCE.PLATFORM);
    expect(isPlatformBooking({ my_order: true })).toBe(true);
    expect(isInternalBooking({ my_order: false })).toBe(true);
    expect(isPlatformBooking({})).toBe(false);
    expect(isInternalBooking({})).toBe(false);
  });

  test("explicit source is kept and conflicts are not guessed into a fee", () => {
    expect(
      resolveBookingSource({ source: "PLATFORM", my_order: true })
    ).toBe(BOOKING_SOURCE.PLATFORM);
    expect(
      classifyBookingSourceRecord({ source: "INTERNAL", my_order: true }).ambiguous
    ).toBe(true);
    expect(
      classifyBookingSourceRecord({
        my_order: false,
        bookingMode: "MARKETPLACE_REQUEST",
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
        payment: { status: "paid" },
      }).reasons
    ).toContain("internal_flag_with_marketplace_payment");
  });

  test("new records store source and later flips are rejected", () => {
    expect(sourceForNewOrder({ isPublicRequest: true, my_order: false })).toBe(
      BOOKING_SOURCE.PLATFORM
    );
    expect(sourceForNewOrder({ isPublicRequest: false, my_order: false })).toBe(
      BOOKING_SOURCE.INTERNAL
    );
    const platform = { source: "PLATFORM", my_order: true };
    expect(assertBookingSourceUnchanged(platform, { my_order: false }).ok).toBe(
      false
    );
    expect(
      assertBookingSourceUnchanged(
        { source: "INTERNAL", my_order: false },
        { source: "PLATFORM" }
      ).code
    ).toBe("SOURCE_IMMUTABLE");
  });

  test("calendar tones: yellow request, light green wait, dark green paid, violet internal", () => {
    const request = {
      my_order: true,
      bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    };
    const waiting = {
      my_order: true,
      bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
    };
    const paid = {
      my_order: true,
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    };
    const internal = {
      my_order: false,
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    };
    expect(resolveContractorCalendarTone(request)).toBe(CALENDAR_TONE.NEW_REQUEST);
    expect(resolveContractorCalendarTone(waiting)).toBe(CALENDAR_TONE.AWAITING_PAYMENT);
    expect(resolveContractorCalendarTone(paid)).toBe(CALENDAR_TONE.CONFIRMED_PAID);
    expect(resolveContractorCalendarTone(internal)).toBe(CALENDAR_TONE.INTERNAL);
    expect(getOrderColor(request).key).toBe(CALENDAR_TONE.NEW_REQUEST);
    expect(getOrderColor(waiting).key).toBe(CALENDAR_TONE.AWAITING_PAYMENT);
    expect(getOrderColor(paid).key).toBe(CALENDAR_TONE.CONFIRMED_PAID);
    expect(getOrderColor(internal).key).toBe(CALENDAR_TONE.INTERNAL);
    expect(getOrderColor(request).main).not.toBe(getOrderColor(waiting).main);
    expect(getOrderColor(waiting).main).not.toBe(getOrderColor(paid).main);
    expect(getOrderColor(paid).main).not.toBe(getOrderColor(internal).main);
  });

  test("problem is a red accent on the existing tone, not a new source", () => {
    const order = {
      my_order: true,
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      hasProblem: true,
    };
    expect(resolveContractorCalendarTone(order)).toBe(CALENDAR_TONE.CONFIRMED_PAID);
    expect(hasCalendarProblem(order)).toBe(true);
    const color = getOrderColor(order);
    expect(color.key).toBe(CALENDAR_TONE.CONFIRMED_PAID);
    expect(color.problem).toBe(true);
    expect(color.border).toBeTruthy();
    expect(isPlatformBooking(order)).toBe(true);
  });

  test("totals never take a fee from internal rows even if marketplace amounts exist", () => {
    const fee = (gross, platform) => ({
      grossMinor: gross * 100,
      platformAmountMinor: platform * 100,
      supplierBalanceMinor: (gross - platform) * 100,
    });
    const orders = [
      {
        my_order: true,
        totalPrice: 500,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: fee(500, 50),
      },
      {
        my_order: false,
        totalPrice: 500,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: fee(500, 50),
      },
    ];
    const s = summarizeContractorAdminTotals(orders);
    expect(s.platformBookingValue).toBe(500);
    expect(s.rovaroBookingFees).toBe(50);
    expect(s.supplierPlatformAmount).toBe(450);
    expect(s.internalBookingValue).toBe(500);
    expect(s.rovaroFeeFromInternalBookings).toBe(0);
    expect(s.combinedCalendarValue).toBe(1000);
    expect(s.platformBookingValue).toBe(
      s.rovaroBookingFees + s.supplierPlatformAmount
    );
    const exported = buildContractorOrdersExport(orders);
    expect(exported.totals).toEqual(s);
    expect(exported.rows[1].bookingFee).toBe(0);
  });

  test("separates the example totals and ignores a stale supplier snapshot", () => {
    const s = summarizeContractorAdminTotals([
      {
        my_order: true,
        source: "PLATFORM",
        totalPrice: 437,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: {
          grossMinor: 43700,
          platformAmountMinor: 4370,
          supplierBalanceMinor: 100,
        },
      },
      {
        my_order: false,
        source: "INTERNAL",
        totalPrice: 150,
        bookingMode: "MARKETPLACE_REQUEST",
        authoritativePrice: {
          grossMinor: 15000,
          platformAmountMinor: 1500,
          supplierBalanceMinor: 13500,
        },
      },
    ]);
    expect(s.combinedCalendarValue).toBe(587);
    expect(s.platformBookingValue).toBe(437);
    expect(s.rovaroBookingFees).toBe(43.7);
    expect(s.supplierPlatformAmount).toBe(393.3);
    expect(s.platformBookingValue).toBe(
      s.rovaroBookingFees + s.supplierPlatformAmount
    );
    expect(s.internalBookingValue).toBe(150);
    expect(s.rovaroFeeFromInternalBookings).toBe(0);
    expect(s.internalBookingValue).not.toBe(s.supplierPlatformAmount);
  });

  test("source filter and internal availability flag", () => {
    const platform = { my_order: true };
    const internal = { my_order: false, blocksAvailability: true };
    expect(matchesBookingSourceFilter(platform, "platform")).toBe(true);
    expect(matchesBookingSourceFilter(platform, "internal")).toBe(false);
    expect(matchesBookingSourceFilter(internal, "Rovaro")).toBe(false);
    expect(matchesBookingSourceFilter(internal, "admin")).toBe(true);
    expect(internalRecordBlocksAvailability(internal)).toBe(true);
    expect(
      internalRecordBlocksAvailability({
        my_order: false,
        blocksAvailability: false,
      })
    ).toBe(false);
    expect(
      internalRecordBlocksAvailability({
        my_order: false,
        bookingStatus: BOOKING_STATUS.CUSTOMER_CANCELLED,
      })
    ).toBe(false);
    expect(internalRecordBlocksAvailability(platform)).toBe(false);
  });

  test("invariants forbid mixed 10% and source mutation", () => {
    const text = CONTRACTOR_ADMIN_INVARIANTS.join(" ");
    expect(text).toMatch(/never becomes a platform booking/i);
    expect(text).toMatch(/10% of all visible rows/i);
  });
});
