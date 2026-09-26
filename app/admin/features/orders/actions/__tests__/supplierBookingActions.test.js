import { loadAlternativeCars } from "../supplierBookingActions";

describe("loadAlternativeCars", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the full fleet with eligibility reasons and availability-only offers enabled", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        eligibleCars: [{ carId: "eligible-car", name: "Toyota Yaris" }],
        excludedCars: [
          {
            carId: "busy-car",
            name: "Kia Rio",
            code: "availability_conflict",
            message: "Those dates are not available for this car",
          },
          {
            carId: "wrong-class-car",
            name: "Ford Transit",
            code: "category_downgrade",
            message: "The replacement class is lower",
          },
        ],
      }),
    });

    const result = await loadAlternativeCars("order-1");

    expect(result.cars.map((car) => car.carId)).toEqual([
      "eligible-car",
      "busy-car",
      "wrong-class-car",
    ]);
    expect(result.cars.map((car) => car.offerable)).toEqual([
      true,
      true,
      false,
    ]);
    expect(result.cars[1].exclusionMessage).toBe(
      "Those dates are not available for this car"
    );
    expect(result.cars[2].exclusionMessage).toBe(
      "The replacement class is lower"
    );
  });
});
