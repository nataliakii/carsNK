import {
  BOOKING_MODE,
  buildBookingDraft,
  buildQuoteRequestKey,
  hasCompleteRange,
  resolvePublicBookingMode,
} from "../publicBookingMode";

describe("public booking modes", () => {
  test("a complete header search is SEARCH_FIRST", () => {
    expect(
      resolvePublicBookingMode({ startDate: "2026-10-20", endDate: "2026-10-24" })
    ).toBe(BOOKING_MODE.SEARCH_FIRST);
  });

  test("browsing without a global range is CAR_FIRST", () => {
    expect(resolvePublicBookingMode(null)).toBe(BOOKING_MODE.CAR_FIRST);
    expect(resolvePublicBookingMode({ startDate: "2026-10-20" })).toBe(
      BOOKING_MODE.CAR_FIRST
    );
    expect(
      resolvePublicBookingMode({ startDate: "2026-10-24", endDate: "2026-10-20" })
    ).toBe(BOOKING_MODE.CAR_FIRST);
  });

  test("both paths stay supported rather than one replacing the other", () => {
    expect(Object.keys(BOOKING_MODE).sort()).toEqual(["CAR_FIRST", "SEARCH_FIRST"]);
  });
});

describe("booking draft", () => {
  test("carries the car, its own dates and its own quote", () => {
    expect(
      buildBookingDraft({
        sourceMode: BOOKING_MODE.CAR_FIRST,
        carId: "car-a",
        startDate: "2026-10-20",
        endDate: "2026-10-24",
        quoteId: "q-1",
      })
    ).toEqual({
      sourceMode: BOOKING_MODE.CAR_FIRST,
      carId: "car-a",
      startDate: "2026-10-20",
      endDate: "2026-10-24",
      quoteId: "q-1",
    });
  });

  test("an incomplete or car-less draft is refused", () => {
    const base = {
      sourceMode: BOOKING_MODE.CAR_FIRST,
      startDate: "2026-10-20",
      endDate: "2026-10-24",
    };
    expect(buildBookingDraft({ ...base, carId: "" })).toBeNull();
    expect(buildBookingDraft({ ...base, carId: "car-a", endDate: null })).toBeNull();
    expect(buildBookingDraft({ ...base, carId: "car-a", sourceMode: "GUESS" })).toBeNull();
  });
});

describe("quote request identity", () => {
  test("the key covers car, range and both locations", () => {
    const base = {
      carId: "car-a",
      startDate: "2026-10-20",
      endDate: "2026-10-24",
      placeIn: "Barcelona",
      placeOut: "Girona",
    };
    expect(buildQuoteRequestKey(base)).toBe("car-a|2026-10-20|2026-10-24|Barcelona|Girona");
    expect(buildQuoteRequestKey({ ...base, carId: "car-b" })).not.toBe(
      buildQuoteRequestKey(base)
    );
    expect(buildQuoteRequestKey({ ...base, placeOut: "Barcelona" })).not.toBe(
      buildQuoteRequestKey(base)
    );
  });

  test("an incomplete range has no key, so it can never be requested", () => {
    expect(buildQuoteRequestKey({ carId: "car-a", startDate: "2026-10-20" })).toBe("");
    expect(hasCompleteRange("2026-10-20", null)).toBe(false);
  });
});
