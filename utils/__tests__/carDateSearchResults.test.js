/**
 * SEARCH_FIRST results must contain only cars that are free for the whole
 * requested range, and they must arrive ordered by the quoted total.
 */

import { isCarAvailableForSearchDates } from "../carDateSearch";
import {
  SORT_OPTION,
  sortCarsByQuotedTotal,
} from "@/domain/booking/carResultSorting";

const COMPANY = {
  country: "ES",
  defaultStart: "10:00",
  defaultEnd: "10:00",
  bufferTime: 0,
  minRentalDuration: 0,
};
const PLATFORM = { country: "ES" };

function order(start, end) {
  return {
    rentalStartDate: `${start}T10:00:00.000Z`,
    rentalEndDate: `${end}T10:00:00.000Z`,
    timeIn: `${start}T10:00:00.000Z`,
    timeOut: `${end}T10:00:00.000Z`,
    confirmed: true,
    bookingStatus: "BOOKING_CONFIRMED",
  };
}

function availableFor(orders, start = "2026-10-20", end = "2026-10-24") {
  return isCarAvailableForSearchDates({
    orders,
    start,
    end,
    company: COMPANY,
    platform: PLATFORM,
  });
}

describe("SEARCH_FIRST availability filtering", () => {
  test("a free car is offered for the requested range", () => {
    expect(availableFor([])).toBe(true);
  });

  test("a car booked across the whole range is not offered", () => {
    expect(availableFor([order("2026-10-19", "2026-10-26")])).toBe(false);
  });

  test("a car booked over part of the range is not offered", () => {
    expect(availableFor([order("2026-10-22", "2026-10-23")])).toBe(false);
  });

  test("a booking that ends before the range starts does not exclude the car", () => {
    expect(availableFor([order("2026-10-01", "2026-10-05")])).toBe(true);
  });

  test("a reversed or empty range is never treated as bookable", () => {
    expect(availableFor([], "2026-10-24", "2026-10-20")).toBe(false);
    expect(availableFor([], "2026-10-20", "2026-10-20")).toBe(false);
  });

  test("only the available cars reach the sorted result list", () => {
    const fleet = [
      { _id: "free-cheap", make: "Fiat", model: "500", orders: [] },
      {
        _id: "busy",
        make: "Audi",
        model: "A3",
        orders: [order("2026-10-21", "2026-10-23")],
      },
      { _id: "free-dear", make: "Peugeot", model: "208", orders: [] },
    ];

    const results = fleet.filter((car) => availableFor(car.orders));
    expect(results.map((c) => c._id)).toEqual(["free-cheap", "free-dear"]);

    const quotes = {
      "free-cheap": { totalPrice: 105 },
      "free-dear": { totalPrice: 240 },
    };
    expect(
      sortCarsByQuotedTotal(results, quotes, SORT_OPTION.PRICE_ASC).map((c) => c._id)
    ).toEqual(["free-cheap", "free-dear"]);
    expect(
      sortCarsByQuotedTotal(results, quotes, SORT_OPTION.PRICE_DESC).map((c) => c._id)
    ).toEqual(["free-dear", "free-cheap"]);
  });
});
