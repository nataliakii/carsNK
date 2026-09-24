import {
  buildCarBookingPanelView,
  formatBookingDateRange,
  formatEuroTotal,
  formatPlatePrice,
  formatRentalDayCount,
  reduceBookingPanel,
} from "../carBookingPanel";

const DATES = { start: "2026-09-29", end: "2026-09-30" };
const READY = {
  status: "available",
  totalPrice: 105,
  days: 1,
  priceKind: "estimated",
};

describe("car booking panel view", () => {
  test("selected dates keep the calendar open and expose a book plate", () => {
    const view = buildCarBookingPanelView({ ...DATES, editing: false, quote: READY });
    expect(view.state).toBe("selected");
    expect(view.calendarOpen).toBe(true);
    expect(view.showChooseDates).toBe(false);
    expect(view.showPrice).toBe(true);
    expect(view.showApprox).toBe(true);
    expect(view.platePriceText).toBe("105€");
    expect(view.bookHoverLabel).toBe("Book");
    expect(view.continueLabel).toBe("Book");
    expect(view.statusText).toBe("");
    expect(view.canonicalStart).toBe("2026-09-29");
    expect(view.canonicalEnd).toBe("2026-09-30");
  });

  test("rental totals omit the approx label", () => {
    const view = buildCarBookingPanelView({
      ...DATES,
      quote: { ...READY, priceKind: "rental" },
    });
    expect(view.showApprox).toBe(false);
    expect(view.platePriceText).toBe("105€");
    expect(view.priceText).toBe("€105.00");
  });

  test("empty dates open the calendar and hide the price plate", () => {
    const view = buildCarBookingPanelView({ start: null, end: null });
    expect(view.showChooseDates).toBe(true);
    expect(view.calendarOpen).toBe(true);
    expect(view.showPrice).toBe(false);
    expect(view.platePriceText).toBe("");
  });

  test("change dates keeps the calendar and cancel restores the previous range", () => {
    const editing = reduceBookingPanel(
      { ...DATES, editing: false },
      { type: "changeDates" }
    );
    expect(buildCarBookingPanelView({ ...editing, quote: READY }).calendarOpen).toBe(true);
    const restored = reduceBookingPanel(editing, { type: "cancel" });
    expect(restored).toMatchObject({ ...DATES, editing: false });
  });

  test("a new range commits one canonical pair and keeps the calendar", () => {
    const next = reduceBookingPanel(
      { ...DATES, editing: true, previous: DATES },
      { type: "commit", start: "2026-10-01", end: "2026-10-03" }
    );
    const view = buildCarBookingPanelView({
      ...next,
      quote: { ...READY, days: 2, totalPrice: 210 },
    });
    expect(view.calendarOpen).toBe(true);
    expect(view.canonicalStart).toBe("2026-10-01");
    expect(view.canonicalEnd).toBe("2026-10-03");
    expect(view.durationLabel).toBe("2 days");
    expect(view.platePriceText).toBe("210€");
  });

  test("duration is singular for one day and plate currency uses a euro suffix", () => {
    expect(formatRentalDayCount(1)).toBe("1 day");
    expect(formatRentalDayCount(2)).toBe("2 days");
    expect(formatRentalDayCount(1)).not.toBe("1 days");
    expect(formatEuroTotal(105)).toBe("€105.00");
    expect(formatPlatePrice(105)).toBe("105€");
    expect(formatPlatePrice(105.5)).toBe("105.50€");
    expect(formatBookingDateRange("2026-09-29", "2026-09-30")).toBe(
      "29 Sep – 30 Sep 2026"
    );
  });

  test("clearing dates returns to the empty state with calendar open", () => {
    const cleared = reduceBookingPanel({ ...DATES, editing: true }, { type: "clear" });
    const view = buildCarBookingPanelView(cleared);
    expect(view.state).toBe("empty");
    expect(view.showChooseDates).toBe(true);
    expect(view.calendarOpen).toBe(true);
    expect(view.showPrice).toBe(false);
  });

  test("external search dates replace the panel and keep the calendar open", () => {
    const next = reduceBookingPanel(
      { start: "2026-09-01", end: "2026-09-02", editing: true },
      { type: "externalDates", start: "2026-09-29", end: "2026-09-30" }
    );
    expect(next.editing).toBe(false);
    expect(buildCarBookingPanelView({ ...next, quote: READY }).calendarOpen).toBe(true);
  });

  test("unavailable quote keeps the calendar open and blocks booking", () => {
    const next = reduceBookingPanel(DATES, { type: "unavailable" });
    const view = buildCarBookingPanelView({
      ...next,
      quote: { status: "unavailable", message: "Not available for these dates" },
    });
    expect(view.calendarOpen).toBe(true);
    expect(view.statusText).toBe("Not available for these dates");
    expect(view.continueDisabled).toBe(true);
    expect(view.showPrice).toBe(false);
  });

  test("booking stays disabled while availability is still being checked", () => {
    const view = buildCarBookingPanelView({
      ...DATES,
      quote: { status: "checking" },
    });
    expect(view.statusText).toBe("Checking availability…");
    expect(view.continueDisabled).toBe(true);
    expect(view.showPrice).toBe(false);
  });

  test("a changed server total still shows the plate without a status line", () => {
    const view = buildCarBookingPanelView({
      ...DATES,
      quote: { status: "priceChanged", totalPrice: 120, days: 1, priceKind: "rental" },
    });
    expect(view.statusText).toBe("");
    expect(view.showApprox).toBe(false);
    expect(view.platePriceText).toBe("120€");
  });
});
