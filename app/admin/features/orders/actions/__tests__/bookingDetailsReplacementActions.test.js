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

  it("submits a guaranteed-class acknowledgement without manual vehicle fields", async () => {
    offerEquivalentReplacement.mockResolvedValue({ ok: true });

    await proposeEquivalentReplacement("order-1", {
      replacementSource: REPLACEMENT_KIND.GUARANTEED_CLASS,
      guaranteeAck: true,
      supplierMessage: "",
    });

    expect(suggestAlternativeVehicle).not.toHaveBeenCalled();
    expect(offerEquivalentReplacement).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        replacementSource: REPLACEMENT_KIND.GUARANTEED_CLASS,
        guaranteeAck: true,
        supplierMessage: expect.stringMatching(/same or higher class/i),
      })
    );
  });

  it("refuses guaranteed-class without acknowledgement", async () => {
    const result = await proposeEquivalentReplacement("order-1", {
      replacementSource: REPLACEMENT_KIND.GUARANTEED_CLASS,
      guaranteeAck: false,
    });
    expect(result.ok).toBe(false);
    expect(offerEquivalentReplacement).not.toHaveBeenCalled();
  });
});
