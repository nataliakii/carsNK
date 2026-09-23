import {
  formatBookingLocationLine,
  formatHandoverLocationLine,
} from "../bookingLocationDisplay";

describe("bookingLocationDisplay", () => {
  test("appends hotel/street detail for any city, not only Thessaloniki", () => {
    expect(
      formatBookingLocationLine("Barcelona", "Hotel Arts, 19-21 Carrer de la Marina")
    ).toBe("Barcelona — Hotel Arts, 19-21 Carrer de la Marina");
    expect(formatBookingLocationLine("Thessaloniki", "Hotel Capsis")).toBe(
      "Thessaloniki — Hotel Capsis"
    );
    expect(formatBookingLocationLine("Airport", "")).toBe("Airport");
  });

  test("labels office vs delivery", () => {
    expect(
      formatHandoverLocationLine({
        place: "Office Centro",
        detail: "Carrer X 1",
        method: "office",
        officeLabel: "Office pick-up",
      })
    ).toBe("Office pick-up: Office Centro — Carrer X 1");
    expect(
      formatHandoverLocationLine({
        place: "Barcelona",
        detail: "Carrer Mallorca 12",
        method: "delivery",
        deliveryLabel: "Delivery / address",
      })
    ).toBe("Delivery / address: Barcelona — Carrer Mallorca 12");
  });
});
