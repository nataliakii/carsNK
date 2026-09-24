import {
  buildCarBookingPanelView,
  formatBookingDateRange,
  formatEuroTotal,
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
  test("dates already selected show one summary and a collapsed calendar", () => {
    const view = buildCarBookingPanelView({ ...DATES, editing: false, quote: READY });
    expect(view.state).toBe("selected");
    expect(view.calendarOpen).toBe(false);
    expect(view.showChooseDates).toBe(false);
    expect(view.showPriceBadge).toBe(false);
    expect(view.dateRangeLabel).toBe("29 Sep – 30 Sep 2026");
    expect(view.priceText).toBe("€105.00");
    expect(view.durationLabel).toBe("1 day");
    expect(view.continueLabel).toBe("Continue booking");
    expect(view.canonicalStart).toBe("2026-09-29");
    expect(view.canonicalEnd).toBe("2026-09-30");
  });

  test("price and the date range are each exposed once", () => {
    const view = buildCarBookingPanelView({ ...DATES, quote: READY });
    const fields = [view.dateRangeLabel, view.priceText, view.continueLabel];
    expect(fields.filter((value) => value === view.dateRangeLabel)).toHaveLength(1);
    expect(fields.filter((value) => value.includes("105"))).toHaveLength(1);
    expect(view.continueLabel).not.toMatch(/€|Sep/);
  });

  test("empty dates open the calendar and hide the price", () => {
    const view = buildCarBookingPanelView({ start: null, end: null });
    expect(view.showChooseDates).toBe(true);
    expect(view.calendarOpen).toBe(true);
    expect(view.showPrice).toBe(false);
    expect(view.priceText).toBe("");
  });

  test("change dates opens the calendar and cancel restores the previous range", () => {
    const editing = reduceBookingPanel(
      { ...DATES, editing: false },
      { type: "changeDates" }
    );
    expect(buildCarBookingPanelView({ ...editing, quote: READY }).calendarOpen).toBe(true);
    const restored = reduceBookingPanel(editing, { type: "cancel" });
    expect(restored).toMatchObject({ ...DATES, editing: false });
  });

  test("a new range commits one canonical pair and closes the calendar", () => {
    const next = reduceBookingPanel(
      { ...DATES, editing: true, previous: DATES },
      { type: "commit", start: "2026-10-01", end: "2026-10-03" }
    );
    const view = buildCarBookingPanelView({
      ...next,
      quote: { ...READY, days: 2, totalPrice: 210 },
    });
    expect(view.calendarOpen).toBe(false);
    expect(view.canonicalStart).toBe("2026-10-01");
    expect(view.canonicalEnd).toBe("2026-10-03");
    expect(view.durationLabel).toBe("2 days");
    expect(view.priceText).toBe("€210.00");
  });

  test("duration is singular for one day and currency always uses the euro prefix", () => {
    expect(formatRentalDayCount(1)).toBe("1 day");
    expect(formatRentalDayCount(2)).toBe("2 days");
    expect(formatRentalDayCount(1)).not.toBe("1 days");
    expect(formatEuroTotal(105)).toBe("€105.00");
    expect(formatEuroTotal(105)).not.toContain("105€");
    expect(formatBookingDateRange("2026-09-29", "2026-09-30")).toBe(
      "29 Sep – 30 Sep 2026"
    );
  });

  test("clearing dates returns to the empty state", () => {
    const cleared = reduceBookingPanel({ ...DATES, editing: true }, { type: "clear" });
    const view = buildCarBookingPanelView(cleared);
    expect(view.state).toBe("empty");
    expect(view.showChooseDates).toBe(true);
    expect(view.calendarOpen).toBe(true);
    expect(view.showPrice).toBe(false);
  });

  test("external search dates replace the panel and collapse the calendar", () => {
    const next = reduceBookingPanel(
      { start: "2026-09-01", end: "2026-09-02", editing: true },
      { type: "externalDates", start: "2026-09-29", end: "2026-09-30" }
    );
    expect(next.editing).toBe(false);
    expect(buildCarBookingPanelView({ ...next, quote: READY }).calendarOpen).toBe(false);
  });

  test("unavailable quote keeps the calendar open and blocks continue", () => {
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

  test("continue stays disabled while availability is still being checked", () => {
    const view = buildCarBookingPanelView({
      ...DATES,
      quote: { status: "checking" },
    });
    expect(view.statusText).toBe("Checking availability…");
    expect(view.continueDisabled).toBe(true);
    expect(view.showPrice).toBe(false);
  });

  test("a changed server total is labelled once", () => {
    const view = buildCarBookingPanelView({
      ...DATES,
      quote: { status: "priceChanged", totalPrice: 120, days: 1, priceKind: "rental" },
    });
    expect(view.statusText).toBe("Price changed — updated total shown");
    expect(view.priceCaption).toBe("Rental total");
    expect(view.priceText).toBe("€120.00");
  });
});
