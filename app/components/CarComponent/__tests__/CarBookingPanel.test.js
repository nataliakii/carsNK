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
    bookingPlaceIn: "Barcelona",
    bookingPlaceOut: "Barcelona",
  }),
}));

jest.mock("@utils/action", () => ({
  calculateTotalPrice: (...args) => calculateTotalPrice(...args),
}));

jest.mock("@config/siteCountry", () => ({
  getSiteCountryCode: () => "ES",
}));

jest.mock("@/domain/orders/catalogPlaceOptions", () => ({
  isSpainBookingSite: () => true,
}));

jest.mock("@/domain/orders/defaultInsurance", () => ({
  resolveDefaultInsurance: () => "TPL",
}));

jest.mock("@/app/components/ui/buttons/GradientBookButton", () => {
  return function MockBookButton({ children, onClick, disabled, ...rest }) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} {...rest}>
        {children}
      </button>
    );
  };
});

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

  test("keeps the calendar open and shows an Approx price plate that books on click", async () => {
    const view = renderPanel();
    await flush();

    const html = view.container.innerHTML;
    expect(html).not.toContain("Choose your dates");
    expect(html).not.toContain("Continue booking");
    expect(html).not.toContain("Change dates");
    expect(html).not.toContain("Estimated total");
    expect(html).not.toContain("29 Sep – 30 Sep 2026");
    expect(view.container.querySelector('[data-testid="booking-calendar"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="book-label"]').textContent).toBe("BOOK!");
    expect(view.container.querySelector('[data-testid="booking-price"]').textContent).toContain("105€");
    expect(view.container.querySelector('[data-testid="price-approx"]').textContent).toBe("approx.");

    const button = view.container.querySelector('[data-testid="continue-booking"]');
    expect(button.disabled).toBe(false);
    act(() => button.click());
    expect(view.onContinue).toHaveBeenCalledWith({
      start: "2026-09-29",
      end: "2026-09-30",
    });
    view.unmount();
  });

  test("picking a new range updates search dates and keeps the calendar", async () => {
    const view = renderPanel();
    await flush();

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
    expect(view.container.querySelector('[data-testid="booking-calendar"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="book-label"]').textContent).toBe("BOOK!");
    expect(view.container.querySelector('[data-testid="booking-price"]').textContent).toContain("210€");

    act(() => {
      view.container.querySelector('[data-testid="calendar-clear"]').click();
    });
    expect(setSearchDates).toHaveBeenCalledWith({ start: null, end: null });
    expect(view.container.textContent).toContain("Choose your dates");
    expect(view.container.querySelector('[data-testid="book-label"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="booking-price"]')).toBeNull();
    view.unmount();
  });

  test("BOOK! appears as soon as a range is selected and drops a stale price until the new quote returns", async () => {
    const view = renderPanel();
    await flush();
    expect(view.container.querySelector('[data-testid="booking-price"]').textContent).toContain("105€");

    let resolveQuote;
    calculateTotalPrice.mockReturnValue(
      new Promise((resolve) => {
        resolveQuote = resolve;
      })
    );
    await act(async () => {
      view.container.querySelector('[data-testid="pick-range"]').click();
    });
    expect(view.container.querySelector('[data-testid="book-label"]').textContent).toBe("BOOK!");
    expect(view.container.querySelector('[data-testid="booking-price"]')).toBeNull();

    await act(async () => {
      resolveQuote({ ok: true, available: true, totalPrice: 210, days: 2 });
    });
    await flush();
    expect(view.container.querySelector('[data-testid="booking-price"]').textContent).toContain("210€");
    expect(view.container.querySelector('[data-testid="price-approx"]').textContent).toBe("approx.");
    view.unmount();
  });

  test("BOOK! stays available while the quote loads and hides when the range is unavailable", async () => {
    let resolveQuote;
    calculateTotalPrice.mockReturnValue(
      new Promise((resolve) => {
        resolveQuote = resolve;
      })
    );
    const view = renderPanel();
    expect(view.container.textContent).toContain("Checking availability…");
    const button = view.container.querySelector('[data-testid="continue-booking"]');
    expect(button).not.toBeNull();
    expect(button.disabled).toBe(false);
    expect(view.container.querySelector('[data-testid="book-label"]').textContent).toBe("BOOK!");
    expect(view.container.querySelector('[data-testid="booking-price"]')).toBeNull();
    act(() => button.click());
    expect(view.onContinue).toHaveBeenCalledWith({
      start: "2026-09-29",
      end: "2026-09-30",
    });

    await act(async () => {
      resolveQuote({ ok: true, available: false, totalPrice: 105, days: 1 });
    });
    await flush();
    expect(view.container.textContent).toContain("Not available for these dates");
    expect(view.container.querySelector('[data-testid="continue-booking"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="booking-calendar"]')).not.toBeNull();
    view.unmount();
  });
});
