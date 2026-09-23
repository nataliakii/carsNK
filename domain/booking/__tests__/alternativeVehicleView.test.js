/**
 * @jest-environment node
 *
 * The offer page renders straight from this view, so the rules that matter
 * here are: nothing that is not stored may appear, no customer contact detail
 * may leak into a page reachable by a leaked link, and an offer past its
 * deadline must read as expired without anything being written.
 */

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));

jest.mock("@models/AlternativeVehicleOffer", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));
jest.mock("@models/car", () => ({ Car: { findById: jest.fn() } }));

import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import { Order } from "@models/order";
import { Car } from "@models/car";
import {
  buildAlternativeOfferUrl,
  buildAlternativeOfferView,
  resolveOfferStatus,
} from "@/domain/booking/alternativeVehicleView";

const NOW = new Date("2026-09-20T12:00:00Z");
const HOUR = 3600 * 1000;

function offerDoc(overrides = {}) {
  return {
    offerId: "ALT-ABCDEF0123456789",
    orderId: "order-1",
    currency: "EUR",
    priceMinor: 28000,
    originalPriceMinor: 30000,
    depositMinor: 40000,
    insurance: "CDW",
    reasonForReplacement: "The booked vehicle was damaged in a previous rental.",
    expiresAt: new Date(NOW.getTime() + 12 * HOUR),
    offeredAt: new Date(NOW.getTime() - HOUR),
    decidedAt: null,
    status: "OFFERED",
    afterPayment: true,
    vehicle: {
      make: "Toyota",
      model: "C-HR",
      category: "suv",
      transmission: "automatic",
      seats: 5,
      luggage: 2,
      year: 2023,
      modelGroup: "",
      photos: ["alt_photo_1", "alt_photo_2"],
      mileagePolicy: "Unlimited",
    },
    pickup: {
      atUtc: new Date("2026-09-28T09:00:00Z"),
      place: "Malaga Airport",
      detail: "Terminal 3",
    },
    ...overrides,
  };
}

function orderDoc(overrides = {}) {
  return {
    _id: "order-1",
    orderNumber: "20260914130426",
    carModel: "Toyota Yaris",
    car: "car-1",
    insurance: "TPL",
    franchiseOrder: 300,
    placeIn: "Malaga Airport",
    placeInDetail: "Terminal 3",
    timeIn: new Date("2026-09-28T09:00:00Z"),
    timezone: "Europe/Madrid",
    ...overrides,
  };
}

function carDoc(overrides = {}) {
  return {
    model: "Toyota Yaris",
    class: "compact",
    transmission: "automatic",
    seats: 5,
    registration: 2021,
    photoUrl: "Toyota_Yaris_2021_abc123",
    deposit: 300,
    ...overrides,
  };
}

/** Chainable stand-ins for the mongoose query builders the view uses. */
function offerQuery(doc) {
  return { lean: jest.fn().mockResolvedValue(doc) };
}

function selectQuery(doc) {
  return {
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  AlternativeVehicleOffer.findOne.mockReturnValue(offerQuery(offerDoc()));
  Order.findById.mockReturnValue(selectQuery(orderDoc()));
  Car.findById.mockReturnValue(selectQuery(carDoc()));
});

describe("resolveOfferStatus", () => {
  it("reads an offer past its deadline as expired", () => {
    const status = resolveOfferStatus(
      { status: "OFFERED", expiresAt: new Date(NOW.getTime() - 1) },
      NOW
    );
    expect(status).toBe("EXPIRED");
  });

  it("leaves a decided offer alone even after the deadline", () => {
    const status = resolveOfferStatus(
      { status: "ACCEPTED", expiresAt: new Date(NOW.getTime() - 1) },
      NOW
    );
    expect(status).toBe("ACCEPTED");
  });

  it("leaves a withdrawn offer alone even after the deadline", () => {
    const status = resolveOfferStatus(
      { status: "WITHDRAWN", expiresAt: new Date(NOW.getTime() - 1) },
      NOW
    );
    expect(status).toBe("WITHDRAWN");
  });
});

describe("buildAlternativeOfferUrl", () => {
  it("puts the offer id in a locale-prefixed customer path", () => {
    expect(buildAlternativeOfferUrl("ALT-123", "es")).toMatch(
      /\/es\/booking\/alternative\/ALT-123$/
    );
  });

  it("falls back to English for a missing locale", () => {
    expect(buildAlternativeOfferUrl("ALT-123")).toMatch(
      /\/en\/booking\/alternative\/ALT-123$/
    );
  });
});

describe("buildAlternativeOfferView", () => {
  it("returns null for an unknown offer", async () => {
    AlternativeVehicleOffer.findOne.mockReturnValue(offerQuery(null));
    expect(await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW)).toBeNull();
  });

  it("returns null for a malformed id without querying", async () => {
    expect(await buildAlternativeOfferView("ALT-1", NOW)).toBeNull();
    expect(AlternativeVehicleOffer.findOne).not.toHaveBeenCalled();
  });

  it("returns null for an empty id without querying", async () => {
    expect(await buildAlternativeOfferView("", NOW)).toBeNull();
    expect(AlternativeVehicleOffer.findOne).not.toHaveBeenCalled();
  });

  it("describes both vehicles from stored data only", async () => {
    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);

    expect(view.booked).toMatchObject({
      name: "Toyota Yaris",
      category: "compact",
      transmission: "automatic",
      seats: 5,
      year: 2021,
      priceMinor: 30000,
      insurance: "TPL",
      photos: ["Toyota_Yaris_2021_abc123"],
    });
    expect(view.offered).toMatchObject({
      name: "Toyota C-HR",
      category: "suv",
      seats: 5,
      luggage: 2,
      year: 2023,
      priceMinor: 28000,
      insurance: "CDW",
      mileagePolicy: "Unlimited",
      photos: ["alt_photo_1", "alt_photo_2"],
    });
  });

  it("leaves what is not stored about the booked car unspecified", async () => {
    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);

    // The car record holds no luggage, model group or mileage policy, so the
    // page must say nothing rather than borrow the alternative's figures.
    expect(view.booked.luggage).toBeNull();
    expect(view.booked.modelGroup).toBeNull();
    expect(view.booked.mileagePolicy).toBeNull();
  });

  it("converts the stored deposit into the offer currency's minor units", async () => {
    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);
    expect(view.booked.depositMinor).toBe(30000);
    expect(view.offered.depositMinor).toBe(40000);
  });

  it("falls back to the order franchise when the car has no deposit", async () => {
    Car.findById.mockReturnValue(selectQuery(carDoc({ deposit: null })));
    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);
    expect(view.booked.depositMinor).toBe(30000);
  });

  it("marks a live offer as decidable", async () => {
    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);
    expect(view.status).toBe("OFFERED");
    expect(view.decidable).toBe(true);
    expect(view.afterPayment).toBe(true);
    expect(view.reasonForReplacement).toBe(
      "The booked vehicle was damaged in a previous rental."
    );
    expect(view.timezone).toBe("Europe/Madrid");
  });


  it("marks a lapsed offer expired and undecidable without writing", async () => {
    AlternativeVehicleOffer.findOne.mockReturnValue(
      offerQuery(offerDoc({ expiresAt: new Date(NOW.getTime() - HOUR) }))
    );

    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);

    expect(view.status).toBe("EXPIRED");
    expect(view.decidable).toBe(false);
  });

  it("keeps an already decided offer on its outcome", async () => {
    AlternativeVehicleOffer.findOne.mockReturnValue(
      offerQuery(
        offerDoc({
          status: "DECLINED",
          decidedAt: new Date(NOW.getTime() - HOUR),
          declineReason: "I need a manual car",
        })
      )
    );

    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);

    expect(view.status).toBe("DECLINED");
    expect(view.decidable).toBe(false);
    expect(view.decidedAt).toBe(new Date(NOW.getTime() - HOUR).toISOString());
  });


  it("never exposes customer contact details or the decline reason", async () => {
    Order.findById.mockReturnValue(
      selectQuery(
        orderDoc({
          customerName: "Ana García",
          email: "ana@example.test",
          phone: "+34600000000",
        })
      )
    );
    AlternativeVehicleOffer.findOne.mockReturnValue(
      offerQuery(offerDoc({ declineReason: "I need a manual car" }))
    );

    const serialized = JSON.stringify(
      await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW)
    );

    expect(serialized).not.toMatch(/Ana Garc/);
    expect(serialized).not.toMatch(/ana@example.test/);
    expect(serialized).not.toMatch(/\+34600000000/);
    expect(serialized).not.toMatch(/manual car/);
  });

  it("still renders when the booking's car record is gone", async () => {
    Order.findById.mockReturnValue(selectQuery(orderDoc({ car: null })));

    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);

    expect(Car.findById).not.toHaveBeenCalled();
    expect(view.booked.name).toBe("Toyota Yaris");
    expect(view.booked.category).toBeNull();
    expect(view.offered.name).toBe("Toyota C-HR");
  });

  it("is JSON-safe so the server component can hand it to the client", async () => {
    const view = await buildAlternativeOfferView("ALT-ABCDEF0123456789", NOW);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});
