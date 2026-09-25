/**
 * The catalog bug was one shared start/end/month triple across every car.
 * These tests pin the isolation guarantee: a transition names exactly one car
 * and every other car keeps its previous object identity.
 */

import {
  EMPTY_CAR_CALENDAR,
  applyCarQuote,
  clearCarSelection,
  datesInRange,
  getCarCalendarState,
  isDaySelectable,
  monthKeyOf,
  pruneCarCalendars,
  rangeCrossesUnavailable,
  selectCarDate,
  setCarDisplayMonth,
} from "../carCalendarState";

const CAR_A = "car-a";
const CAR_B = "car-b";

function pickRange(map, carId, start, end, options = {}) {
  const first = selectCarDate(map, { carId, date: start, ...options });
  return selectCarDate(first.map, { carId, date: end, ...options });
}

describe("per-car calendar state", () => {
  test("an unknown car reads as empty rather than another car's slice", () => {
    const map = pickRange({}, CAR_A, "2026-10-20", "2026-10-24").map;
    expect(getCarCalendarState(map, CAR_B)).toEqual(EMPTY_CAR_CALENDAR);
    expect(getCarCalendarState(map, CAR_A).startDate).toBe("2026-10-20");
  });

  test("selecting dates in car A does not change car B", () => {
    const withB = pickRange({}, CAR_B, "2026-11-01", "2026-11-05").map;
    const beforeB = withB[CAR_B];

    const withA = pickRange(withB, CAR_A, "2026-10-20", "2026-10-24").map;

    expect(withA[CAR_A]).toMatchObject({
      startDate: "2026-10-20",
      endDate: "2026-10-24",
    });
    expect(withA[CAR_B]).toMatchObject({
      startDate: "2026-11-01",
      endDate: "2026-11-05",
    });
    // Identity, not just value: car B must not re-render.
    expect(withA[CAR_B]).toBe(beforeB);
  });

  test("changing car A's month does not change car B's month", () => {
    const base = setCarDisplayMonth(
      setCarDisplayMonth({}, CAR_B, "2026-12"),
      CAR_A,
      "2026-10"
    );
    const beforeB = base[CAR_B];

    const moved = setCarDisplayMonth(base, CAR_A, "2027-01");

    expect(moved[CAR_A].displayMonth).toBe("2027-01");
    expect(moved[CAR_B].displayMonth).toBe("2026-12");
    expect(moved[CAR_B]).toBe(beforeB);
  });

  test("a month change never disturbs the selected range", () => {
    const picked = pickRange({}, CAR_A, "2026-10-20", "2026-10-24").map;
    const moved = setCarDisplayMonth(picked, CAR_A, "2027-03");
    expect(moved[CAR_A]).toMatchObject({
      startDate: "2026-10-20",
      endDate: "2026-10-24",
      displayMonth: "2027-03",
    });
  });

  test("car A's quote is never readable on car B", () => {
    const map = pickRange({}, CAR_A, "2026-10-20", "2026-10-24").map;
    const quoted = applyCarQuote(map, CAR_A, {
      start: "2026-10-20",
      end: "2026-10-24",
      quote: { totalPrice: 105 },
      status: "ready",
    });
    expect(getCarCalendarState(quoted, CAR_A).quote.totalPrice).toBe(105);
    expect(getCarCalendarState(quoted, CAR_B).quote).toBeNull();
  });

  test("a quote for an abandoned range is dropped instead of painted on new dates", () => {
    const map = pickRange({}, CAR_A, "2026-10-20", "2026-10-24").map;
    const stale = applyCarQuote(map, CAR_A, {
      start: "2026-09-01",
      end: "2026-09-04",
      quote: { totalPrice: 999 },
      status: "ready",
    });
    expect(stale).toBe(map);
    expect(getCarCalendarState(stale, CAR_A).quote).toBeNull();
  });
});

describe("CAR_FIRST selection algorithm", () => {
  test("first click sets the start and clears the previous end and quote", () => {
    const done = applyCarQuote(
      pickRange({}, CAR_A, "2026-10-20", "2026-10-24").map,
      CAR_A,
      {
        start: "2026-10-20",
        end: "2026-10-24",
        quote: { totalPrice: 105 },
        status: "ready",
      }
    );

    const restarted = selectCarDate(done, { carId: CAR_A, date: "2026-11-02" });

    expect(restarted.map[CAR_A]).toMatchObject({
      startDate: "2026-11-02",
      endDate: null,
      quote: null,
      quoteStatus: "idle",
    });
    expect(restarted.committed).toBeNull();
  });

  test("a completed range reports the commit exactly once", () => {
    const first = selectCarDate({}, { carId: CAR_A, date: "2026-10-20" });
    expect(first.committed).toBeNull();

    const second = selectCarDate(first.map, { carId: CAR_A, date: "2026-10-24" });
    expect(second.committed).toEqual({ start: "2026-10-20", end: "2026-10-24" });
    expect(second.map[CAR_A].quoteStatus).toBe("loading");
  });

  test("a second click on or before the start restarts the range", () => {
    const first = selectCarDate({}, { carId: CAR_A, date: "2026-10-20" });
    const earlier = selectCarDate(first.map, { carId: CAR_A, date: "2026-10-18" });
    expect(earlier.map[CAR_A]).toMatchObject({
      startDate: "2026-10-18",
      endDate: null,
    });
    expect(earlier.committed).toBeNull();
  });

  test("unavailable dates cannot be selected", () => {
    const blocked = selectCarDate(
      {},
      { carId: CAR_A, date: "2026-10-20", unavailableDates: ["2026-10-20"] }
    );
    expect(blocked.rejected).toBe("unavailableDay");
    expect(blocked.map[CAR_A]).toBeUndefined();
  });

  test("past dates cannot be selected", () => {
    const past = selectCarDate(
      {},
      { carId: CAR_A, date: "2026-10-19", today: "2026-10-20" }
    );
    expect(past.rejected).toBe("unavailableDay");
    expect(isDaySelectable("2026-10-19", { today: "2026-10-20" })).toBe(false);
    expect(isDaySelectable("2026-10-20", { today: "2026-10-20" })).toBe(true);
  });

  test("a range cannot cross a booked day", () => {
    const options = { unavailableDates: ["2026-10-22"] };
    const first = selectCarDate({}, { carId: CAR_A, date: "2026-10-20", ...options });
    const crossing = selectCarDate(first.map, {
      carId: CAR_A,
      date: "2026-10-24",
      ...options,
    });

    expect(crossing.rejected).toBe("crossesUnavailable");
    expect(crossing.committed).toBeNull();
    expect(crossing.map[CAR_A]).toMatchObject({
      startDate: "2026-10-20",
      endDate: null,
    });
  });

  test("a clear range on either side of a booked day still commits", () => {
    const options = { unavailableDates: ["2026-10-28"] };
    const result = pickRange({}, CAR_A, "2026-10-20", "2026-10-24", options);
    expect(result.committed).toEqual({ start: "2026-10-20", end: "2026-10-24" });
  });

  test("range maths is pure string arithmetic, so no UTC off-by-one", () => {
    expect(datesInRange("2026-10-20", "2026-10-23")).toEqual([
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
    ]);
    // A DST boundary in Europe/Athens (last Sunday of October).
    expect(datesInRange("2026-10-24", "2026-10-26")).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ]);
    expect(rangeCrossesUnavailable("2026-10-20", "2026-10-24", ["2026-10-21"])).toBe(
      true
    );
    expect(rangeCrossesUnavailable("2026-10-20", "2026-10-24", ["2026-11-01"])).toBe(
      false
    );
  });

  test("clearing one car leaves the others untouched", () => {
    const both = pickRange(
      pickRange({}, CAR_B, "2026-11-01", "2026-11-05").map,
      CAR_A,
      "2026-10-20",
      "2026-10-24"
    ).map;
    const cleared = clearCarSelection(both, CAR_A);
    expect(cleared[CAR_A].startDate).toBeNull();
    expect(cleared[CAR_B].startDate).toBe("2026-11-01");
  });

  test("pruning keeps only cars still on screen", () => {
    const both = pickRange(
      pickRange({}, CAR_B, "2026-11-01", "2026-11-05").map,
      CAR_A,
      "2026-10-20",
      "2026-10-24"
    ).map;
    const pruned = pruneCarCalendars(both, [CAR_A]);
    expect(Object.keys(pruned)).toEqual([CAR_A]);
    expect(pruneCarCalendars(pruned, [CAR_A])).toBe(pruned);
  });

  test("monthKeyOf reads the month without constructing a Date", () => {
    expect(monthKeyOf("2026-10-20")).toBe("2026-10");
    expect(monthKeyOf("nonsense")).toBeNull();
  });
});
