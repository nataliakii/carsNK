import {
  PANEL_COPY,
  PANEL_STATUS,
  buildCarBookingPanelView,
  formatCompactDateRange,
  formatEuroAmount,
  hasValidBookingRange,
  rentalDayCount,
} from "../carBookingPanel";

const RANGE = { start: "2026-10-20", end: "2026-10-24" };
const READY_QUOTE = { totalPrice: 105, rangeKey: "2026-10-20|2026-10-24" };

function view(input) {
  return buildCarBookingPanelView({ ...RANGE, ...input });
}

describe("booking CTA", () => {
  test("before dates are selected the CTA is a disabled Select dates", () => {
    const v = buildCarBookingPanelView({ start: null, end: null });
    expect(v.status).toBe(PANEL_STATUS.EMPTY);
    expect(v.cta.disabled).toBe(true);
    expect(v.cta.labelFallback).toBe("Select dates");
    expect(v.canBook).toBe(false);
    expect(v.cta.showPrice).toBe(false);
  });

  test("while the quote loads the CTA says Calculating price", () => {
    const v = view({ quote: { rangeKey: "2026-10-20|2026-10-24" }, quoteStatus: "loading" });
    expect(v.status).toBe(PANEL_STATUS.LOADING);
    expect(v.cta.labelFallback).toBe("Calculating price…");
    expect(v.cta.disabled).toBe(true);
    expect(v.canBook).toBe(false);
  });

  test("a valid quote shows BOOK and Approx. €105", () => {
    const v = view({ quote: READY_QUOTE, quoteStatus: "ready", priceKind: "estimated" });
    expect(v.status).toBe(PANEL_STATUS.READY);
    expect(v.cta.labelFallback).toBe("BOOK");
    expect(v.cta.disabled).toBe(false);
    expect(v.cta.priceText).toBe("€105");
    expect(v.cta.showApprox).toBe(true);
    expect(v.cta.priceKey).toBe("catalog.booking.approxPrice");
    expect(v.canBook).toBe(true);
  });

  test("the CTA never contains an exclamation mark or a question mark", () => {
    const states = [
      buildCarBookingPanelView({ start: null, end: null }),
      view({ quote: { rangeKey: "2026-10-20|2026-10-24" }, quoteStatus: "loading" }),
      view({ quote: READY_QUOTE, quoteStatus: "ready" }),
      view({ quote: { available: false }, quoteStatus: "ready" }),
      view({ quote: { status: "error" }, quoteStatus: "error" }),
    ];
    states.forEach((v) => {
      expect(v.cta.labelFallback).not.toMatch(/[!?]/);
      expect(v.cta.priceText).not.toMatch(/[!?]/);
    });
    Object.values(PANEL_COPY).forEach((copy) => {
      expect(copy.fallback).not.toMatch(/[!?]/);
    });
  });

  test("the CTA never says BOOK!", () => {
    const v = view({ quote: READY_QUOTE, quoteStatus: "ready" });
    expect(v.cta.labelFallback).toBe("BOOK");
    expect(v.cta.labelFallback).not.toBe("BOOK!");
  });

  test("Choose your dates is gone once dates are selected", () => {
    const v = view({ quote: READY_QUOTE, quoteStatus: "ready" });
    expect(JSON.stringify(v)).not.toMatch(/Choose your dates/i);
  });

  test("an unavailable range cannot be booked", () => {
    const v = view({ quote: { available: false }, quoteStatus: "ready" });
    expect(v.status).toBe(PANEL_STATUS.UNAVAILABLE);
    expect(v.canBook).toBe(false);
    expect(v.cta.disabled).toBe(true);
    expect(v.statusMessage.fallback).toBe("Not available for these dates");
  });

  test("a failed quote offers a retry rather than a broken price", () => {
    const v = view({ quote: { status: "error" }, quoteStatus: "error" });
    expect(v.status).toBe(PANEL_STATUS.ERROR);
    expect(v.canBook).toBe(false);
    expect(v.cta.labelFallback).toBe("Try again");
    expect(v.statusMessage.fallback).toBe("Could not check availability");
  });

  test("a quote belonging to another range is never rendered", () => {
    const v = view({
      quote: { totalPrice: 999, rangeKey: "2026-01-01|2026-01-05" },
      quoteStatus: "ready",
    });
    expect(v.status).toBe(PANEL_STATUS.LOADING);
    expect(v.cta.priceText).toBe("");
    expect(v.canBook).toBe(false);
  });
});

describe("compact booking summary", () => {
  test("shows the range, the day count and the price", () => {
    const v = view({ quote: READY_QUOTE, quoteStatus: "ready" });
    expect(v.summary.show).toBe(true);
    expect(v.summary.rangeText).toBe("20–24 October");
    expect(v.summary.days).toBe(4);
    expect(v.summary.priceText).toBe("€105");
  });

  test("a range spanning two months names both months", () => {
    expect(formatCompactDateRange("2026-10-28", "2026-11-02")).toBe(
      "28 October – 2 November"
    );
  });

  test("a range spanning two years names both years", () => {
    expect(formatCompactDateRange("2026-12-28", "2027-01-02")).toBe(
      "28 December 2026 – 2 January 2027"
    );
  });

  test("day counts are billable nights, never negative", () => {
    expect(rentalDayCount("2026-10-20", "2026-10-24")).toBe(4);
    expect(rentalDayCount("2026-10-20", "2026-10-21")).toBe(1);
    expect(rentalDayCount("2026-10-24", "2026-10-20")).toBe(0);
    expect(rentalDayCount(null, null)).toBe(0);
  });

  test("prices keep cents only when they exist", () => {
    expect(formatEuroAmount(105)).toBe("€105");
    expect(formatEuroAmount(105.5)).toBe("€105.50");
    expect(formatEuroAmount("nope")).toBe("");
  });

  test("a range needs a real start before a real end", () => {
    expect(hasValidBookingRange("2026-10-20", "2026-10-24")).toBe(true);
    expect(hasValidBookingRange("2026-10-20", "2026-10-20")).toBe(false);
    expect(hasValidBookingRange("2026-10-24", "2026-10-20")).toBe(false);
    expect(hasValidBookingRange(null, "2026-10-24")).toBe(false);
  });
});
