/**
 * @jest-environment node
 */
import {
  anyFleetCarFitsTransfer,
  buildFleetCapacity,
  carFitsTransferRequest,
  isEligibleTransferCar,
  listEligibleFleetCars,
  mapCarClassToTransferCategory,
} from "../transferFleet";

const ownerA = "64b7f2c3a1b2c3d4e5f60711";

function car(overrides = {}) {
  return {
    _id: "car-active",
    ownerId: ownerA,
    model: "Seat Leon",
    class: "economy",
    seats: 5,
    PriceChildSeats: 4,
    isActive: true,
    testingCar: false,
    ...overrides,
  };
}

describe("rental fleet reuse", () => {
  test("reads capacity and category from active cars; priced child seats are not inventory", () => {
    const fleet = [car(), car({ _id: "van", class: "minibus", seats: 7 })];
    const cap = buildFleetCapacity(fleet);
    expect(cap.carCount).toBe(2);
    expect(cap.maxPassengers).toBe(7);
    expect(cap.childSeatsAvailable).toBe(0);
    expect(cap.vehicleCategories).toEqual(
      expect.arrayContaining(["STANDARD", "MINIVAN"])
    );
    expect(mapCarClassToTransferCategory(car({ class: "minibus", seats: 7 }))).toBe(
      "MINIVAN"
    );
  });

  test("priced child-seat extra is confirmation-required, not a hard reject", () => {
    const priced = car({ PriceChildSeats: 8, childSeatsAvailable: undefined });
    expect(
      carFitsTransferRequest(priced, {
        passengers: 2,
        vehicleCategory: "STANDARD",
        childSeats: 1,
      })
    ).toBe(true);
    expect(
      anyFleetCarFitsTransfer([priced], {
        passengers: 2,
        vehicleCategory: "STANDARD",
        childSeats: 1,
      })
    ).toBe(true);
  });

  test("newly added eligible cars are included automatically", () => {
    const existing = [car({ seats: 4 })];
    expect(buildFleetCapacity(existing).maxPassengers).toBe(4);
    expect(
      anyFleetCarFitsTransfer(existing, { passengers: 6, vehicleCategory: "MINIVAN" })
    ).toBe(false);

    const withNew = [...existing, car({ _id: "new-van", class: "minibus", seats: 7 })];
    expect(buildFleetCapacity(withNew).maxPassengers).toBe(7);
    expect(
      anyFleetCarFitsTransfer(withNew, { passengers: 6, vehicleCategory: "MINIVAN" })
    ).toBe(true);
  });

  test("excludes inactive, hidden, deleted, test and unavailable cars", () => {
    const rejected = [
      car({ _id: "off", isActive: false }),
      car({ _id: "test", testingCar: true }),
      car({ _id: "hidden", isHidden: true }),
      car({ _id: "deleted", deletedAt: new Date() }),
      car({ _id: "unavail", unavailable: true }),
      car({ _id: "status", status: "unavailable" }),
    ];
    expect(listEligibleFleetCars(rejected)).toEqual([]);
    expect(rejected.every((c) => !isEligibleTransferCar(c))).toBe(true);
    expect(
      anyFleetCarFitsTransfer(rejected, { passengers: 2, vehicleCategory: "STANDARD" })
    ).toBe(false);
  });

  test("manual fleet mode is not inferred from cars — caller must opt in", () => {
    const cars = [car({ seats: 9, class: "minibus" })];
    expect(carFitsTransferRequest(cars[0], { passengers: 8, vehicleCategory: "MINIBUS" })).toBe(
      true
    );
    expect(buildFleetCapacity([]).carCount).toBe(0);
    expect(buildFleetCapacity([]).vehicleCategories).toEqual([]);
  });
});
