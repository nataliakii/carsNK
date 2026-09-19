/**
 * @jest-environment node
 */

jest.mock("@/domain/delivery/calculateDeliveryPrice", () => ({
  calculateDeliveryPrice: jest.fn().mockResolvedValue({
    deliveryIn: 20,
    deliveryOut: 10,
    deliveryTotal: 30,
  }),
}));

import { calculateDeliveryPrice } from "@/domain/delivery/calculateDeliveryPrice";
import { resolveCreateTotalPrice } from "../publicOrderCreatePolicy";
import {
  calculateAuthoritativeRentalPrice,
  detectClientTotalMismatch,
  resolveCurrency,
  resolvePrepaymentPercent,
  validateRentalPriceSelections,
  RentalPricingError,
} from "../rentalPricingService";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";

function fakeCar({
  total = 200,
  days = 3,
  breakdown = {},
} = {}) {
  return {
    ownerId: "co1",
    calculateTotalRentalPricePerDay: jest.fn().mockResolvedValue({
      total,
      days,
      breakdown: {
        dailyRates: [
          { day: 1, date: "06/10/2026", season: "HighSeason", targetDays: 4, price: 80, discount: 0, discountActive: false, finalPrice: 80 },
          { day: 2, date: "06/11/2026", season: "HighSeason", targetDays: 4, price: 80, discount: 0, discountActive: false, finalPrice: 80 },
          { day: 3, date: "06/12/2026", season: "HighSeason", targetDays: 4, price: 40, discount: 0, discountActive: false, finalPrice: 40 },
        ],
        baseRentalTotal: 200,
        kaskoTotal: 0,
        childSeatsTotal: 0,
        secondDriverTotal: 0,
        insurance: "TPL",
        ...breakdown,
      },
    }),
  };
}

const pickup = new Date("2026-06-10T07:00:00.000Z");
const ret = new Date("2026-06-13T07:00:00.000Z");

describe("rentalPricingService", () => {
  beforeEach(() => {
    calculateDeliveryPrice.mockClear();
  });

  test("currency is explicit EUR", () => {
    expect(resolveCurrency()).toBe("EUR");
  });

  test("seasonal / multi-day rental uses car formula and delivery", async () => {
    const quote = await calculateAuthoritativeRentalPrice({
      car: fakeCar(),
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      timezone: "Europe/Athens",
      insurance: "TPL",
      childSeats: 0,
      secondDriver: false,
      placeIn: "Thessaloniki Airport",
      placeOut: "Nea Kallikratia",
      bookingMode: BOOKING_MODES.OPS_CALENDAR,
    });
    expect(quote.rentalDays).toBe(3);
    expect(quote.currency).toBe("EUR");
    expect(quote.pickupFeeMinor).toBe(2000);
    expect(quote.returnFeeMinor).toBe(1000);
    expect(quote.grossMinor).toBe(23000);
    expect(quote.compatibility.totalPrice).toBe(230);
    expect(quote.compatibility.matchesMinor).toBe(true);
  });

  test("discount is captured from dailyRates", async () => {
    const quote = await calculateAuthoritativeRentalPrice({
      car: fakeCar({
        total: 180,
        breakdown: {
          dailyRates: [
            { price: 100, finalPrice: 90, discount: 10, discountActive: true },
            { price: 100, finalPrice: 90, discount: 10, discountActive: true },
          ],
          baseRentalTotal: 180,
        },
      }),
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      timezone: "Europe/Athens",
    });
    expect(quote.discountMinor).toBe(2000);
  });

  test("CDW, child seats, second driver extras", async () => {
    const quote = await calculateAuthoritativeRentalPrice({
      car: fakeCar({
        total: 275,
        breakdown: {
          baseRentalTotal: 200,
          kaskoTotal: 30,
          childSeatsTotal: 30,
          secondDriverTotal: 15,
          insurance: "CDW",
        },
      }),
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      timezone: "Europe/Athens",
      insurance: "CDW",
      childSeats: 1,
      secondDriver: true,
    });
    expect(quote.insuranceMinor).toBe(3000);
    expect(quote.extrasMinor).toBe(4500);
  });

  test("invalid extras rejected", () => {
    expect(() => validateRentalPriceSelections({ childSeats: -1 })).toThrow(
      RentalPricingError
    );
    expect(() =>
      validateRentalPriceSelections({ insurance: "HACK" })
    ).toThrow(RentalPricingError);
  });

  test("server ignores forged client total", () => {
    const stored = resolveCreateTotalPrice({
      isAdminSession: false,
      clientTotalPrice: 1,
      rentalTotal: 200,
      deliveryTotal: 30,
    });
    expect(stored).toBe(230);
    const mismatch = detectClientTotalMismatch({
      clientTotalPrice: 1,
      serverTotalMajor: stored,
    });
    expect(mismatch).toEqual({ clientMajor: 1, serverMajor: 230 });
  });

  test("prepayment 10% for Spain marketplace only; Greece stays 0", () => {
    expect(
      resolvePrepaymentPercent({ bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST })
    ).toBe(10);
    expect(
      resolvePrepaymentPercent({ bookingMode: BOOKING_MODES.OPS_CALENDAR })
    ).toBe(0);
    expect(
      resolvePrepaymentPercent({
        bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
        company: { prepaymentPercent: 15 },
      })
    ).toBe(15);
  });

  test("minor-unit gross is rental + delivery", async () => {
    const quote = await calculateAuthoritativeRentalPrice({
      car: fakeCar({ total: 100, days: 1, breakdown: { baseRentalTotal: 100 } }),
      pickupAtUtc: pickup,
      returnAtUtc: ret,
      timezone: "Europe/Madrid",
    });
    expect(quote.grossMinor).toBe(quote.baseRentalMinor + quote.pickupFeeMinor + quote.returnFeeMinor);
  });
});
