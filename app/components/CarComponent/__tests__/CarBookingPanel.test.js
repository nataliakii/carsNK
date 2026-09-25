/**
 * @jest-environment jsdom
 *
 * Two panels are mounted side by side throughout, because the bug being
 * guarded here is cross-card bleed: one car's dates, month, quote or request
 * appearing on another car.
 */
import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CarBookingPanel from "../CarBookingPanel";
import { resetCarCalendarsForTests } from "@/app/hooks/useCarCalendar";
import { resetCatalogUiForTests } from "@/app/hooks/useActiveCalendarCar";

const calculateTotalPrice = jest.fn();

jest.mock("@utils/action", () => ({
  calculateTotalPrice: (...args) => calculateTotalPrice(...args),
}));

jest.mock("@app/Context", () => ({
  useMainContext: () => ({
    bookingPlaceIn: "Barcelona",
    bookingPlaceOut: "Barcelona",
    company: { country: "ES" },
    platform: { country: "ES" },
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (opts?.defaultValue == null) return key;
      return String(opts.defaultValue)
        .replace("{{price}}", opts.price ?? "")
        .replace("{{days}}", opts.days ?? "");
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("@config/siteCountry", () => ({ getSiteCountryCode: () => "ES" }));
jest.mock("@/domain/orders/catalogPlaceOptions", () => ({
  isSpainBookingSite: () => true,
}));
jest.mock("@/domain/orders/defaultInsurance", () => ({
  resolveDefaultInsurance: () => "TPL",
}));
jest.mock("@/domain/time/resolveBusinessTimezone", () => ({
  resolveBusinessTimezone: () => "Europe/Madrid",
}));
jest.mock("@/domain/calendar", () => ({
  extractArraysOfStartEndConfPending: (orders) => ({
    unavailable: [],
    confirmed: (orders || []).flatMap((o) => o.blockedDays || []),
    startEnd: (orders || []).flatMap((o) => o.startEnd || []),
    transformedStartEndOverlap: [],
  }),
  calculateAvailableTimes: (startEnd, start, end) => ({
    availableStart: startEnd.find((d) => d.date === start && d.type === "end")?.time
      || null,
    availableEnd: startEnd.find((d) => d.date === end && d.type === "start")?.time
      || null,
  }),
}));

const CAR_A = { _id: "car-a", make: "Peugeot", model: "208" };
const CAR_B = { _id: "car-b", make: "Fiat", model: "500" };

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** The panel scoped to one car, found by its stable car id. */
function panelFor(container, carId) {
  return container.querySelector(`[data-car-id="${carId}"]`);
}

function q(container, carId, testId) {
  return panelFor(container, carId)?.querySelector(`[data-testid="${testId}"]`);
}

function clickDay(container, carId, dateKey) {
  const cell = q(container, carId, `calendar-day-${dateKey}`);
  act(() => cell.click());
}

function openCalendar() {
  // CAR_FIRST shows the Ant Design calendar immediately, matching the card.
}

function TwoCars({ onContinueA = () => {}, onContinueB = () => {}, ordersA = [] }) {
  return (
    <>
      <CarBookingPanel car={CAR_A} orders={ordersA} onContinue={onContinueA} />
      <CarBookingPanel car={CAR_B} orders={[]} onContinue={onContinueB} />
    </>
  );
}

beforeEach(() => {
  // Only Date is faked: the calendar opens on "today", so the month under
  // test must be deterministic. Timers stay real so promises still settle.
  jest.useFakeTimers({
    doNotFake: [
      "nextTick",
      "queueMicrotask",
      "setImmediate",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "performance",
    ],
    now: new Date("2026-10-05T09:00:00Z"),
  });
  resetCarCalendarsForTests();
  resetCatalogUiForTests();
  calculateTotalPrice.mockReset();
  calculateTotalPrice.mockResolvedValue({
    ok: true,
    available: true,
    totalPrice: 105,
    days: 4,
  });
  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
});

afterEach(() => {
  jest.useRealTimers();
});

describe("CAR_FIRST state isolation", () => {
  test("selecting dates in car A does not change car B", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");

    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    expect(q(view.container, "car-a", "calendar-day-2026-10-20").dataset.state).toBe(
      "rangeStart"
    );
    expect(q(view.container, "car-a", "calendar-day-2026-10-24").dataset.state).toBe(
      "rangeEnd"
    );

    // Car B has no dates at all, so its CTA is still the disabled prompt.
    expect(q(view.container, "car-b", "book-label").textContent).toBe("Select dates");
    expect(q(view.container, "car-b", "booking-summary")).toBeNull();
    view.unmount();
  });

  test("car A's quote is never rendered on car B", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    expect(q(view.container, "car-a", "booking-price").textContent).toBe(
      "Approx. €105"
    );
    expect(q(view.container, "car-b", "booking-price")).toBeNull();
    expect(panelFor(view.container, "car-b").textContent).not.toContain("105");
    view.unmount();
  });

  test("changing car A's month does not change car B's month", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    const before = q(view.container, "car-a", "calendar-month").textContent;

    act(() => q(view.container, "car-a", "calendar-next-month").click());
    await flush();

    const afterA = q(view.container, "car-a", "calendar-month").textContent;
    expect(afterA).not.toBe(before);

    // Car B's calendar, when opened, still starts on the current month.
    openCalendar(view.container, "car-b");
    await flush();
    expect(q(view.container, "car-b", "calendar-month").textContent).toBe(before);
    view.unmount();
  });

  test("opening and closing a calendar does not reset the selection", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    openCalendar(view.container, "car-a"); // close
    openCalendar(view.container, "car-a"); // reopen
    await flush();

    expect(q(view.container, "car-a", "calendar-day-2026-10-20").dataset.state).toBe(
      "rangeStart"
    );
    expect(q(view.container, "car-a", "summary-range").textContent).toBe(
      "20–24 October"
    );
    view.unmount();
  });
});

describe("request volume", () => {
  test("no quote is requested for a car whose calendar was never opened", async () => {
    const view = mount(<TwoCars />);
    await flush();
    expect(calculateTotalPrice).not.toHaveBeenCalled();
    view.unmount();
  });

  test("one completed range triggers exactly one quote request", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    await flush();
    // A lone start date is not a range, so nothing is priced yet.
    expect(calculateTotalPrice).not.toHaveBeenCalled();

    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    expect(calculateTotalPrice).toHaveBeenCalledTimes(1);
    expect(calculateTotalPrice.mock.calls[0][0]).toBe("car-a");
    view.unmount();
  });

  test("selecting a range on one car does not price any other car", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    const pricedCars = calculateTotalPrice.mock.calls.map((call) => call[0]);
    expect(pricedCars).toEqual(["car-a"]);
    view.unmount();
  });

  test("rerendering does not create duplicate requests", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();
    expect(calculateTotalPrice).toHaveBeenCalledTimes(1);

    // New inline props/objects on every pass — the old code refetched here.
    for (let i = 0; i < 5; i += 1) {
      view.rerender(<TwoCars onContinueA={() => {}} onContinueB={() => {}} />);
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }

    expect(calculateTotalPrice).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  test("collapsing the card mid-quote still settles the price", async () => {
    let resolveQuote;
    calculateTotalPrice.mockReturnValue(
      new Promise((resolve) => {
        resolveQuote = resolve;
      })
    );
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    openCalendar(view.container, "car-a"); // collapse while in flight
    await act(async () => {
      resolveQuote({ ok: true, available: true, totalPrice: 105, days: 4 });
    });
    await flush();

    expect(q(view.container, "car-a", "book-label").textContent).toBe("BOOK");
    expect(calculateTotalPrice).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  test("deduplication remains safe in React Strict Mode", async () => {
    const view = mount(
      <StrictMode>
        <TwoCars />
      </StrictMode>
    );
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    expect(calculateTotalPrice).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});

describe("date selection rules", () => {
  const ordersA = [{ blockedDays: ["2026-10-22"] }];

  test("unavailable dates cannot be selected", async () => {
    const view = mount(<TwoCars ordersA={ordersA} />);
    openCalendar(view.container, "car-a");

    const blocked = q(view.container, "car-a", "calendar-day-2026-10-22");
    expect(blocked.dataset.state).toBe("unavailable");
    expect(blocked.getAttribute("aria-disabled")).toBe("true");

    act(() => blocked.click());
    await flush();
    expect(q(view.container, "car-a", "book-label").textContent).toBe("Select dates");
    view.unmount();
  });

  test("a range cannot cross a booked day", async () => {
    const view = mount(<TwoCars ordersA={ordersA} />);
    openCalendar(view.container, "car-a");

    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24"); // crosses the 22nd
    await flush();

    expect(calculateTotalPrice).not.toHaveBeenCalled();
    expect(q(view.container, "car-a", "calendar-day-2026-10-24").dataset.state).toBe(
      "available"
    );
    view.unmount();
  });
});

describe("mini calendar rendering", () => {
  test("every day number is rendered exactly once", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");

    const cell = q(view.container, "car-a", "calendar-day-2026-10-14");
    expect(cell.textContent).toBe("14");

    // Select a range and re-check the edges: the old code drew a second,
    // absolutely-positioned number on range start/end cells.
    clickDay(view.container, "car-a", "2026-10-14");
    clickDay(view.container, "car-a", "2026-10-15");
    await flush();

    expect(q(view.container, "car-a", "calendar-day-2026-10-14").textContent).toBe("14");
    expect(q(view.container, "car-a", "calendar-day-2026-10-15").textContent).toBe("15");
    view.unmount();
  });

  test("each date cell appears exactly once in the DOM", () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    const cells = panelFor(view.container, "car-a").querySelectorAll(
      '[data-testid^="calendar-day-"]'
    );
    const keys = [...cells].map((c) => c.dataset.testid);
    expect(new Set(keys).size).toBe(keys.length);
    view.unmount();
  });

  test("the calendar carries a legend so black dates are not a guess", () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    const legend = q(view.container, "car-a", "calendar-legend");
    expect(legend.textContent).toContain("Available");
    expect(legend.textContent).toContain("Unavailable");
    expect(legend.textContent).toContain("Selected");
    view.unmount();
  });
});

describe("CTA and price summary", () => {
  test("no dates shows a disabled Select dates button", () => {
    const view = mount(<TwoCars />);
    const cta = q(view.container, "car-a", "booking-cta");
    expect(cta.disabled).toBe(true);
    expect(q(view.container, "car-a", "book-label").textContent).toBe("Select dates");
    view.unmount();
  });

  test("a loading quote shows Calculating price and cannot be clicked", async () => {
    let resolveQuote;
    calculateTotalPrice.mockReturnValue(
      new Promise((resolve) => {
        resolveQuote = resolve;
      })
    );
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    expect(q(view.container, "car-a", "book-label").textContent).toBe(
      "Calculating price…"
    );
    expect(q(view.container, "car-a", "booking-cta").disabled).toBe(true);

    await act(async () => {
      resolveQuote({ ok: true, available: true, totalPrice: 105, days: 4 });
    });
    await flush();
    expect(q(view.container, "car-a", "book-label").textContent).toBe("BOOK");
    view.unmount();
  });

  test("a valid quote shows BOOK and Approx. price, with no ! or ?", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    const cta = q(view.container, "car-a", "booking-cta");
    expect(q(view.container, "car-a", "book-label").textContent).toBe("BOOK");
    expect(q(view.container, "car-a", "booking-price").textContent).toBe(
      "Approx. €105"
    );
    expect(cta.textContent).not.toMatch(/[!?]/);
    expect(cta.textContent).not.toContain("BOOK!");
    view.unmount();
  });

  test("the compact summary shows the range, the days and the price", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    expect(q(view.container, "car-a", "summary-range").textContent).toBe(
      "20–24 October"
    );
    expect(q(view.container, "car-a", "summary-days").textContent).toBe(
      "4 rental days"
    );
    expect(q(view.container, "car-a", "summary-price").textContent).toBe(
      "Approx. €105"
    );
    view.unmount();
  });

  test("Choose your dates never survives a completed selection", async () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();
    expect(panelFor(view.container, "car-a").textContent).not.toMatch(
      /Choose your dates/i
    );
    view.unmount();
  });

  test("an unavailable quote blocks booking and explains why", async () => {
    calculateTotalPrice.mockResolvedValue({
      ok: true,
      available: false,
      totalPrice: 0,
      days: 4,
    });
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    expect(q(view.container, "car-a", "booking-cta").disabled).toBe(true);
    expect(q(view.container, "car-a", "booking-status").textContent).toBe(
      "Not available for these dates"
    );
    view.unmount();
  });
});

describe("booking hand-off", () => {
  test("the modal receives car A's own id, dates and quote", async () => {
    const onContinueA = jest.fn();
    const onContinueB = jest.fn();
    const view = mount(
      <TwoCars onContinueA={onContinueA} onContinueB={onContinueB} />
    );
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    act(() => q(view.container, "car-a", "booking-cta").click());

    expect(onContinueB).not.toHaveBeenCalled();
    expect(onContinueA).toHaveBeenCalledTimes(1);
    expect(onContinueA).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceMode: "CAR_FIRST",
        carId: "car-a",
        startDate: "2026-10-20",
        endDate: "2026-10-24",
      })
    );
    view.unmount();
  });

  test("pickup and return clamps from neighbouring rentals travel with the draft", async () => {
    const onContinueA = jest.fn();
    const ordersA = [
      {
        startEnd: [
          { date: "2026-10-20", type: "end", time: "11:00", confirmed: true },
          { date: "2026-10-24", type: "start", time: "16:00", confirmed: true },
        ],
      },
    ];
    const view = mount(<TwoCars onContinueA={onContinueA} ordersA={ordersA} />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();
    act(() => q(view.container, "car-a", "booking-cta").click());

    expect(onContinueA).toHaveBeenCalledWith(
      expect.objectContaining({
        boundaryTimes: { start: "11:00", end: "16:00" },
      })
    );
    view.unmount();
  });

  test("a disabled CTA cannot open the modal", () => {
    const onContinueA = jest.fn();
    const view = mount(<TwoCars onContinueA={onContinueA} />);
    act(() => q(view.container, "car-a", "booking-cta").click());
    expect(onContinueA).not.toHaveBeenCalled();
    view.unmount();
  });
});

describe("page stability", () => {
  test("selecting dates never scrolls the page", async () => {
    const scrollTo = jest.fn();
    const scrollIntoView = jest.fn();
    window.scrollTo = scrollTo;
    Element.prototype.scrollIntoView = scrollIntoView;
    const replaceState = jest.spyOn(window.history, "replaceState");

    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    clickDay(view.container, "car-a", "2026-10-20");
    clickDay(view.container, "car-a", "2026-10-24");
    await flush();

    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
    view.unmount();
  });

  test("the panel and calendar declare no horizontal overflow", () => {
    const view = mount(<TwoCars />);
    openCalendar(view.container, "car-a");
    const panel = panelFor(view.container, "car-a");
    expect(panel).not.toBeNull();
    // The calendar is a grid of fractional columns; it cannot demand a
    // minimum width that pushes the document sideways.
    expect(q(view.container, "car-a", "mini-calendar")).not.toBeNull();
    view.unmount();
  });
});

describe("SEARCH_FIRST results", () => {
  const searchRequest = { startDate: "2026-10-20", endDate: "2026-10-24" };

  test("a result card prices the search range without rendering a calendar", async () => {
    const view = mount(
      <CarBookingPanel car={CAR_A} orders={[]} searchRequest={searchRequest} />
    );
    await flush();

    expect(panelFor(view.container, "car-a").dataset.mode).toBe("SEARCH_FIRST");
    expect(q(view.container, "car-a", "mini-calendar")).toBeNull();
    expect(q(view.container, "car-a", "calendar-toggle")).toBeNull();
    expect(q(view.container, "car-a", "book-label").textContent).toBe("BOOK");
    expect(q(view.container, "car-a", "booking-price").textContent).toBe(
      "Approx. €105"
    );
    view.unmount();
  });

  test("each result is priced once for the shared search request", async () => {
    const view = mount(
      <>
        <CarBookingPanel car={CAR_A} orders={[]} searchRequest={searchRequest} />
        <CarBookingPanel car={CAR_B} orders={[]} searchRequest={searchRequest} />
      </>
    );
    await flush();

    const pricedCars = calculateTotalPrice.mock.calls.map((call) => call[0]).sort();
    expect(pricedCars).toEqual(["car-a", "car-b"]);
    view.unmount();
  });

  test("a catalog batch quote is shown without a per-card request", async () => {
    const view = mount(
      <CarBookingPanel
        car={CAR_A}
        orders={[]}
        searchRequest={searchRequest}
        catalogQuote={{
          status: "ready",
          quote: {
            totalPrice: 105,
            days: 4,
            available: true,
            rangeKey: "2026-10-20|2026-10-24",
          },
        }}
      />
    );
    await flush();

    expect(calculateTotalPrice).not.toHaveBeenCalled();
    expect(q(view.container, "car-a", "book-label").textContent).toBe("BOOK");
    expect(q(view.container, "car-a", "mini-calendar")).toBeNull();
    view.unmount();
  });

  test("booking a result hands over the search dates for that car", async () => {
    const onContinue = jest.fn();
    const view = mount(
      <CarBookingPanel
        car={CAR_A}
        orders={[]}
        searchRequest={searchRequest}
        onContinue={onContinue}
      />
    );
    await flush();
    act(() => q(view.container, "car-a", "booking-cta").click());

    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceMode: "SEARCH_FIRST",
        carId: "car-a",
        startDate: "2026-10-20",
        endDate: "2026-10-24",
      })
    );
    view.unmount();
  });

  test("both booking paths remain available", async () => {
    const searchView = mount(
      <CarBookingPanel car={CAR_A} orders={[]} searchRequest={searchRequest} />
    );
    await flush();
    expect(panelFor(searchView.container, "car-a").dataset.mode).toBe("SEARCH_FIRST");
    searchView.unmount();

    const browseView = mount(<CarBookingPanel car={CAR_A} orders={[]} />);
    expect(panelFor(browseView.container, "car-a").dataset.mode).toBe("CAR_FIRST");
    expect(q(browseView.container, "car-a", "mini-calendar")).not.toBeNull();
    browseView.unmount();
  });
});
