import { buildDeliveryHelperText } from "../bookingDeliveryPresentation";

describe("bookingDeliveryPresentation", () => {
  test("formats delivery helper text with euro suffix", () => {
    expect(
      buildDeliveryHelperText({
        locationValue: "Airport",
        deliveryCost: 12.5,
        locale: "ru",
        deliveryLabel: "Доставка",
      })
    ).toBe("Доставка – 12,5 €");
  });

  test("hides helper text when delivery is missing", () => {
    expect(
      buildDeliveryHelperText({
        locationValue: "Airport",
        deliveryCost: null,
        locale: "ru",
        deliveryLabel: "Доставка",
      })
    ).toBe("");
  });

  test("optionally hides zero delivery values", () => {
    expect(
      buildDeliveryHelperText({
        locationValue: "Nea Kallikratia",
        deliveryCost: 0,
        locale: "en",
        deliveryLabel: "Delivery",
        hideWhenZero: true,
      })
    ).toBe("");
  });

  test("keeps zero delivery visible when requested", () => {
    expect(
      buildDeliveryHelperText({
        locationValue: "Nea Kallikratia",
        deliveryCost: 0,
        locale: "en",
        deliveryLabel: "Delivery",
        hideWhenZero: false,
      })
    ).toBe("Delivery – 0 €");
  });
});
