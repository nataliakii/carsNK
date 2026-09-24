/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import BookingLocationSelector from "../BookingLocationSelector";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key, opts) => opts?.defaultValue || key }),
}));

jest.mock("@/domain/orders/carOffices", () => ({
  googleMapsSearchUrl: () => "https://maps.google.com/?q=test",
}));

jest.mock("@/domain/orders/bookingLocationSelection", () => ({
  canonicalOfficeId: (office) => {
    if (office && typeof office === "object") {
      return String(office._id || office.id || "");
    }
    return String(office || "").trim();
  },
}));

jest.mock("@/app/components/ui/inputs", () => ({
  BookingAddressPlacesField: function MockAddress(props) {
    return (
      <div data-testid="address-field">
        <input
          aria-label="address"
          value={props.value || ""}
          onChange={(e) => props.onChange?.(e.target.value)}
        />
        {props.error ? <span>{props.helperText}</span> : null}
      </div>
    );
  },
  BookingLocationAutocomplete: function MockCity(props) {
    return (
      <div data-testid="city-field">
        <button type="button" onClick={() => props.onChange?.(null, { value: "Barcelona" })}>
          choose-city
        </button>
        <span>{props.value}</span>
        {props.error ? <span>{props.helperText}</span> : null}
      </div>
    );
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OFFICE_A = { _id: "64b64b64b64b64b64b64b64b", name: "Office A", address: "A 1", locationType: "office" };
const OFFICE_B = { _id: "64b64b64b64b64b64b64b64c", name: "Office B", address: "B 2", locationType: "airport" };

function mount(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("BookingLocationSelector", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("office method shows office cards only and selects one office", () => {
    const onSelectOffice = jest.fn();
    const view = mount(
      <BookingLocationSelector
        mode="pickup"
        method="office"
        offices={[OFFICE_A, OFFICE_B]}
        selectedOfficeId={OFFICE_A._id}
        onSelectOffice={onSelectOffice}
      />
    );
    expect(view.container.textContent).toContain("Office A");
    expect(view.container.textContent).toContain("Office B");
    expect(view.container.textContent).toContain("Free");
    expect(view.container.querySelector('[data-testid="city-field"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="address-field"]')).toBeNull();
    const selected = [...view.container.querySelectorAll('[role="radio"]')].filter(
      (node) => node.getAttribute("aria-checked") === "true"
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("Office A");
    act(() => {
      view.container.querySelectorAll('[role="radio"]')[1].click();
    });
    expect(onSelectOffice).toHaveBeenCalledWith(OFFICE_B);
    view.unmount();
  });

  test("delivery method shows city and address fields only", () => {
    const view = mount(
      <BookingLocationSelector
        mode="pickup"
        method="delivery"
        offices={[OFFICE_A]}
        cityValue="Barcelona"
        addressValue=""
        cityOptions={[{ value: "Barcelona", label: "Barcelona" }]}
      />
    );
    expect(view.container.querySelector('[data-testid="city-field"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="address-field"]')).not.toBeNull();
    expect(view.container.textContent).not.toContain("Office A");
    view.unmount();
  });

  test("same return hides method controls and shows summary", () => {
    const view = mount(
      <BookingLocationSelector
        mode="return"
        showSameReturnCheckbox
        sameReturnLocation
        sameReturnSummary="Pick-up office: Office A"
        method="office"
        offices={[OFFICE_A]}
      />
    );
    expect(view.container.textContent).toContain("Return to the same location");
    expect(view.container.textContent).toContain("Pick-up office: Office A");
    expect(view.container.textContent).not.toContain("Return at an office — Free");
    view.unmount();
  });

  test("desktop markup uses equal grid-ready columns via shared selector root", () => {
    const view = mount(
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <BookingLocationSelector mode="pickup" method="office" offices={[OFFICE_A]} selectedOfficeId={OFFICE_A._id} />
        <BookingLocationSelector mode="return" method="office" offices={[OFFICE_A]} selectedOfficeId={OFFICE_A._id} showSameReturnCheckbox sameReturnLocation />
      </div>
    );
    expect(view.container.querySelectorAll('[data-testid="booking-location-pickup"]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-testid="booking-location-return"]')).toHaveLength(1);
    view.unmount();
  });
});
