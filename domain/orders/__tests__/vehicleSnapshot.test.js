/**
 * @jest-environment node
 */

import fs from "node:fs";
import path from "node:path";

import { BOOKING_SOURCE } from "@/domain/admin/rovaroContractorAdmin";
import {
  buildVehicleSnapshot,
  hasVehicleSnapshot,
  readVehicleSnapshot,
  splitVehicleName,
} from "@/domain/orders/vehicleSnapshot";
import { buildBookingDetailsView } from "@/domain/booking/bookingDetailsView";

const COMPANY = "64a000000000000000000001";

const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };
const otherCompanyAdmin = {
  isAdmin: true,
  role: 1,
  ownerId: "64a000000000000000000002",
};

function car(overrides = {}) {
  return {
    _id: "64a0000000000000000000c1",
    ownerId: COMPANY,
    model: "Audi A3",
    class: "compact",
    transmission: "automatic",
    fueltype: "petrol",
    seats: 5,
    numberOfDoors: 5,
    airConditioning: true,
    registration: 2021,
    carNumber: "TMP-0069",
    regNumber: "1234 ABC",
    photoUrl: "https://example.com/a3.jpg",
    deposit: 300,
    franchise: 300,
    // Fleet administration, not booking terms. Must not be copied.
    pricingTiers: { low: { days: { 1: 45 } } },
    offices: ["Malaga airport"],
    enginePower: 110,
    ...overrides,
  };
}

const booking = (overrides = {}) => ({
  insurance: "CDW",
  ChildSeats: 2,
  secondDriver: true,
  ...overrides,
});

describe("what the snapshot copies", () => {
  const snapshot = buildVehicleSnapshot(car(), booking());

  test("carries the booking-relevant specification", () => {
    expect(snapshot).toMatchObject({
      carId: "64a0000000000000000000c1",
      companyId: COMPANY,
      displayName: "Audi A3",
      make: "Audi",
      model: "A3",
      class: "compact",
      transmission: "automatic",
      fuelType: "petrol",
      seats: 5,
      doors: 5,
      airConditioning: true,
      modelYear: 2021,
      fleetCode: "TMP-0069",
      registrationNumber: "1234 ABC",
      deposit: 300,
      insuranceExcess: 300,
    });
  });

  test("carries what the customer selected against the vehicle", () => {
    expect(snapshot.selectedInsurance).toBe("CDW");
    expect(snapshot.selectedExtras).toEqual([
      { code: "CHILD_SEATS", quantity: 2 },
      { code: "SECOND_DRIVER", quantity: 1 },
    ]);
  });

  test("leaves fleet administration out of the booking record", () => {
    expect(snapshot.pricingTiers).toBeUndefined();
    expect(snapshot.offices).toBeUndefined();
    expect(snapshot.enginePower).toBeUndefined();
    expect(snapshot.orders).toBeUndefined();
  });

  test("omits unrecorded specifications rather than storing empty ones", () => {
    const sparse = buildVehicleSnapshot(
      car({ photoUrl: "", regNumber: "", registration: null }),
      {}
    );
    expect(sparse).not.toHaveProperty("image");
    expect(sparse).not.toHaveProperty("registrationNumber");
    expect(sparse).not.toHaveProperty("modelYear");
    expect(sparse).not.toHaveProperty("selectedExtras");
  });

  test("keeps a false air conditioning answer, which is not the same as absent", () => {
    const noAc = buildVehicleSnapshot(car({ airConditioning: false }), {});
    expect(noAc.airConditioning).toBe(false);
  });

  test("keeps a single-word name whole instead of guessing a make", () => {
    expect(splitVehicleName("Multivan")).toEqual({
      make: null,
      model: "Multivan",
    });
    expect(splitVehicleName("Mercedes Benz Vito")).toEqual({
      make: "Mercedes",
      model: "Benz Vito",
    });
  });
});

describe("the snapshot does not follow the live car", () => {
  test("an order that already has one keeps it when the car changes", () => {
    const stored = buildVehicleSnapshot(car(), booking());
    const order = {
      vehicleSnapshot: stored,
      // The fleet has since renamed and replated the car.
      car: car({ model: "Audi A4", regNumber: "9999 ZZZ" }),
      carModel: "Audi A4",
    };
    const { vehicle, legacy } = readVehicleSnapshot(order);
    expect(legacy).toBe(false);
    expect(vehicle.displayName).toBe("Audi A3");
    expect(vehicle.registrationNumber).toBe("1234 ABC");
  });

  test("the model writes one only when the order does not already have it", () => {
    const model = fs.readFileSync(
      path.join(process.cwd(), "models/order.js"),
      "utf8"
    );
    expect(model).toContain("if (!this.vehicleSnapshot)");
    expect(model).toContain("buildVehicleSnapshot(car, this)");
  });
});

describe("orders created before snapshots existed", () => {
  test("fall back to the live car and say so", () => {
    const { vehicle, legacy } = readVehicleSnapshot({ car: car() });
    expect(legacy).toBe(true);
    expect(vehicle.displayName).toBe("Audi A3");
  });

  test("fall back to the name the order carries when no car is populated", () => {
    const { vehicle, legacy } = readVehicleSnapshot({
      carModel: "Audi A3",
      carNumber: "TMP-0069",
    });
    expect(legacy).toBe(true);
    expect(vehicle.make).toBe("Audi");
    expect(vehicle.fleetCode).toBe("TMP-0069");
  });

  test("do not crash when there is nothing to show at all", () => {
    expect(readVehicleSnapshot({})).toEqual({ vehicle: null, legacy: true });
    expect(readVehicleSnapshot(null)).toEqual({ vehicle: null, legacy: true });
  });

  test("are reported as having no snapshot", () => {
    expect(hasVehicleSnapshot({ car: car() })).toBe(false);
    expect(
      hasVehicleSnapshot({ vehicleSnapshot: buildVehicleSnapshot(car(), {}) })
    ).toBe(true);
  });
});

describe("the modal reads the snapshot, and guards the fleet identity", () => {
  const order = {
    _id: "64a0000000000000000000aa",
    source: BOOKING_SOURCE.PLATFORM,
    my_order: true,
    ownerId: COMPANY,
    vehicleSnapshot: buildVehicleSnapshot(car(), booking()),
    numberOfDays: 4,
    placeIn: "Malaga",
  };

  test("the owning company sees the fleet code and the plate", () => {
    const view = buildBookingDetailsView(order, companyAdmin);
    expect(view.showFleetIdentity).toBe(true);
    expect(view.vehicle.fleetCode).toBe("TMP-0069");
    expect(view.vehicleIsLegacy).toBe(false);
  });

  test("another company sees neither", () => {
    const view = buildBookingDetailsView(order, otherCompanyAdmin);
    expect(view.showFleetIdentity).toBe(false);
  });

  test("the header leads with the vehicle and the short public reference", () => {
    const view = buildBookingDetailsView(order, companyAdmin);
    expect(view.header.vehicleName).toBe("Audi A3");
    expect(view.header.make).toBe("Audi");
    // The database id is not a reference anyone can quote at us.
    expect(view.header.reference).toBeNull();
    const referenced = buildBookingDetailsView(
      { ...order, publicReference: "RVR-FUKHS" },
      companyAdmin
    );
    expect(referenced.header.reference).toBe("RVR-FUKHS");
  });

  test("the header carries the rental window, its length and the city", () => {
    const view = buildBookingDetailsView(order, companyAdmin);
    expect(view.header.rentalDays).toBe(4);
    expect(view.header.city).toBe("Malaga");
  });

  test("the status appears once, as a badge, and names the source", () => {
    const view = buildBookingDetailsView(order, companyAdmin);
    const ids = view.header.badges.map((badge) => badge.id);
    expect(ids).toContain("status");
    expect(ids).toContain("source");
    expect(ids.filter((id) => id === "status")).toHaveLength(1);
    expect(
      view.header.badges.find((badge) => badge.id === "source").labelKey
    ).toBe("bookingDetails.header.sourcePlatform");
  });

  test("a legacy order is rendered but flagged, never passed off as agreed terms", () => {
    const legacyOrder = { ...order, vehicleSnapshot: undefined, car: car() };
    const view = buildBookingDetailsView(legacyOrder, companyAdmin);
    expect(view.vehicleIsLegacy).toBe(true);
    expect(view.vehicle.displayName).toBe("Audi A3");
  });
});

describe("the sticky footer does not sit on top of the content", () => {
  test("the content column reserves the footer's height", () => {
    const modal = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/admin/features/orders/modals/BookingDetailsModal.js"
      ),
      "utf8"
    );
    expect(modal).toContain("paddingBottom: BOOKING_DETAILS_FOOTER_CLEARANCE");
  });
});
