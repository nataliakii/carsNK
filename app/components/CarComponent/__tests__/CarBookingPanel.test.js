/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CarBookingPanel from "../CarBookingPanel";

const calculateTotalPrice = jest.fn();
const setSearchDates = jest.fn();

let searchDates = { start: "2026-09-29", end: "2026-09-30" };

jest.mock("@app/Context", () => ({
  useMainContext: () => ({
    searchDates,
    setSearchDates,
    bookingPlaceIn: "",
    bookingPlaceOut: "",
  }),
}));

jest.mock("@utils/action", () => ({
  calculateTotalPrice: (...args) => calculateTotalPrice(...args),
}));

jest.mock("@config/siteCountry", () => ({
  getSiteCountryCode: () => "GR",
}));

jest.mock("@/domain/orders/catalogPlaceOptions", () => ({
  isSpainBookingSite: () => false,
}));

jest.mock("@/domain/orders/defaultInsurance", () => ({
  resolveDefaultInsurance: () => "TPL",
}));

jest.mock("../CalendarPicker", () => {
  return function MockCalendar(props) {
    return (
      <div data-testid="booking-calendar">
        <button
          type="button"
          data-testid="pick-range"
          onClick={() =>
            props.onRangeCommitted({ start: "2026-10-01", end: "2026-10-03" })
          }
        >
          pick
        </button>
        <button type="button" data-testid="calendar-clear" onClick={props.onSelectionCleared}>
          calendar clear
        </button>
      </div>
    );
  };
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderPanel(onContinue = jest.fn()) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <CarBookingPanel car={{ _id: "car-1" }} orders={[]} onContinue={onContinue} />
    );
  });
  return {
    container,
    onContinue,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("CarBookingPanel", () => {
  beforeEach(() => {
    searchDates = { start: "2026-09-29", end: "2026-09-30" };
    setSearchDates.mockClear();
    calculateTotalPrice.mockReset();
    calculateTotalPrice.mockResolvedValue({
      ok: true,
      available: true,
      totalPrice: 105,
      days: 1,
    });
  });

  test("shows one summary, one price, and a collapsed calendar when dates exist", async () => {
    const view = renderPanel();
    await flush();

    const html = view.container.innerHTML;
    expect(html).not.toContain("Choose your dates");
    expect(html).not.toContain("Choose your dates for booking");
    expect(html).not.toContain("approx.");
    expect(view.container.querySelectorAll('[data-testid="booking-dates"]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-testid="booking-price"]')).toHaveLength(1);
    expect(view.container.querySelector('[data-testid="booking-calendar"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="booking-duration"]').textContent).toBe("1 day");
    expect(view.container.querySelector('[data-testid="booking-price"]').textContent).toContain("€105.00");
    expect(view.container.querySelector('[data-testid="booking-price"]').textContent).toContain("Rental total");
    expect(html).not.toContain("105€");
    expect(html).not.toContain("1 days");
    const panel = view.container.querySelector('[data-testid="car-booking-panel"]');
    expect(panel.style.overflowX).toBe("hidden");
    expect(panel.style.maxWidth).toBe("100%");
    expect(calculateTotalPrice).toHaveBeenCalledWith(
      "car-1",
      "2026-09-29",
      "2026-09-30",
      "TPL",
      0,
      expect.any(Object)
    );

    const button = view.container.querySelector('[data-testid="continue-booking"]');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("data-start")).toBe("2026-09-29");
    expect(button.getAttribute("data-end")).toBe("2026-09-30");
    expect(button.textContent).toBe("Continue booking");
    act(() => button.click());
    expect(view.onContinue).toHaveBeenCalledWith({
      start: "2026-09-29",
      end: "2026-09-30",
    });
    view.unmount();
  });

  test("change dates opens the calendar, a new range updates search dates, and clear returns to empty", async () => {
    const view = renderPanel();
    await flush();

    act(() => {
      view.container.querySelector('[data-testid="change-dates"]').click();
    });
    expect(view.container.querySelector('[data-testid="booking-calendar"]')).not.toBeNull();

    calculateTotalPrice.mockResolvedValue({
      ok: true,
      available: true,
      totalPrice: 210,
      days: 2,
    });
    await act(async () => {
      view.container.querySelector('[data-testid="pick-range"]').click();
    });
    await flush();
    expect(setSearchDates).toHaveBeenCalledWith({
      start: "2026-10-01",
      end: "2026-10-03",
    });
    expect(view.container.querySelector('[data-testid="booking-calendar"]')).toBeNull();

    act(() => {
      view.container.querySelector('[data-testid="change-dates"]').click();
    });
    act(() => {
      view.container.querySelector('[data-testid="clear-dates"]').click();
    });
    expect(setSearchDates).toHaveBeenCalledWith({ start: null, end: null });
    expect(view.container.textContent).toContain("Choose your dates");
    expect(view.container.querySelector('[data-testid="booking-price"]')).toBeNull();
    view.unmount();
  });

  test("continue stays disabled until the server quote succeeds", async () => {
    let resolveQuote;
    calculateTotalPrice.mockReturnValue(
      new Promise((resolve) => {
        resolveQuote = resolve;
      })
    );
    const view = renderPanel();
    expect(view.container.textContent).toContain("Checking availability…");
    expect(view.container.querySelector('[data-testid="continue-booking"]').disabled).toBe(true);

    await act(async () => {
      resolveQuote({ ok: true, available: false, totalPrice: 105, days: 1 });
    });
    await flush();
    expect(view.container.textContent).toContain("Not available for these dates");
    expect(view.container.querySelector('[data-testid="continue-booking"]').disabled).toBe(true);
    expect(view.container.querySelector('[data-testid="booking-calendar"]')).not.toBeNull();
    view.unmount();
  });
});
