jest.mock("../supplierBookingActions", () => ({
  loadAlternativeCars: jest.fn(),
  suggestAlternativeVehicle: jest.fn(),
  offerEquivalentReplacement: jest.fn(),
  askRovaroAboutBooking: jest.fn(),
}));

import {
  REPLACEMENT_KIND,
  loadReplacementFleetCars,
  proposeEquivalentReplacement,
} from "../bookingDetailsActions";
import {
  loadAlternativeCars,
  offerEquivalentReplacement,
  suggestAlternativeVehicle,
} from "../supplierBookingActions";

describe("booking details replacement actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads fleet cars through the alternative-offers list endpoint", async () => {
    loadAlternativeCars.mockResolvedValue({
      ok: true,
      cars: [{ carId: "car-1", name: "Toyota Yaris" }],
    });

    const result = await loadReplacementFleetCars("order-1");

    expect(loadAlternativeCars).toHaveBeenCalledWith("order-1");
    expect(result.cars).toHaveLength(1);
  });

  it("submits a fleet replacement with the chosen car id", async () => {
    suggestAlternativeVehicle.mockResolvedValue({ ok: true });

    const result = await proposeEquivalentReplacement("order-1", {
      replacementSource: REPLACEMENT_KIND.COMPANY_VEHICLE,
      proposedCarId: "car-2",
      supplierMessage: "Workshop delay on the booked car.",
    });

    expect(suggestAlternativeVehicle).toHaveBeenCalledWith(
      "order-1",
      "car-2",
      "Workshop delay on the booked car."
    );
    expect(offerEquivalentReplacement).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("sends the specifications a supplier chose to state", async () => {
    offerEquivalentReplacement.mockResolvedValue({ ok: true });

    await proposeEquivalentReplacement("order-1", {
      replacementSource: REPLACEMENT_KIND.GUARANTEED_EQUIVALENT,
      model: "Toyota Yaris",
      category: "economy",
      transmission: "manual",
      seats: 5,
      luggage: 2,
      supplierMessage: "Unlisted substitute.",
    });

    expect(suggestAlternativeVehicle).not.toHaveBeenCalled();
    expect(offerEquivalentReplacement).toHaveBeenCalledWith("order-1", {
      replacementSource: REPLACEMENT_KIND.GUARANTEED_EQUIVALENT,
      model: "Toyota Yaris",
      category: "economy",
      transmission: "manual",
      seats: 5,
      luggage: 2,
      supplierMessage: "Unlisted substitute.",
    });
  });

  it("omits an unstated specification rather than sending a zero for it", async () => {
    offerEquivalentReplacement.mockResolvedValue({ ok: true });

    await proposeEquivalentReplacement("order-1", {
      replacementSource: REPLACEMENT_KIND.GUARANTEED_EQUIVALENT,
      model: "",
      category: "",
      transmission: "",
      seats: "",
      luggage: "",
      supplierMessage: "The booked car is in the workshop.",
    });

    // An empty seat box must not reach the rules as "0 seats", and an empty
    // price box must not reach them as a free rental.
    expect(offerEquivalentReplacement).toHaveBeenCalledWith("order-1", {
      replacementSource: REPLACEMENT_KIND.GUARANTEED_EQUIVALENT,
      supplierMessage: "The booked car is in the workshop.",
    });
  });

  it("no longer knows a third kind of replacement", () => {
    expect(Object.keys(REPLACEMENT_KIND)).toEqual([
      "COMPANY_VEHICLE",
      "GUARANTEED_EQUIVALENT",
    ]);
  });
});
