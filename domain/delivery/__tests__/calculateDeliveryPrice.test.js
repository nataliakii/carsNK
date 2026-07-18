jest.mock("@models/DeliveryZone", () => ({
  __esModule: true,
  DeliveryZone: {
    find: jest.fn(),
  },
}));

jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

const { DeliveryZone } = require("@models/DeliveryZone");
const Company = require("@models/company").default;
const { calculateDeliveryPrice } = require("../calculateDeliveryPrice");

describe("calculateDeliveryPrice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calculates pickup and return delivery as separate one-way trips", async () => {
    Company.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ deliveryPricePerKm: 2 }),
    });
    DeliveryZone.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { name: "Thessaloniki Airport", distanceKm: 10, isActive: true },
        { name: "City", distanceKm: 5, isActive: true },
      ]),
    });

    const result = await calculateDeliveryPrice({
      placeIn: "Airport",
      placeOut: "City",
    });

    expect(result).toEqual(
      expect.objectContaining({
        deliveryIn: 20,
        deliveryOut: 10,
        deliveryTotal: 30,
        deliveryPricePerKm: 2,
        placeIn: "Airport",
        placeOut: "City",
        resolvedPlaceIn: "Thessaloniki Airport",
        resolvedPlaceOut: "City",
      })
    );
  });

  test("uses default rate, resolves aliases, and returns zero for missing out zone", async () => {
    Company.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    DeliveryZone.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          name: "Thessaloniki Airport",
          distanceKm: 14.5,
          isActive: true,
        },
      ]),
    });

    const result = await calculateDeliveryPrice({
      placeIn: "airport",
      placeOut: "",
    });

    expect(result).toEqual(
      expect.objectContaining({
        deliveryIn: 14.5,
        deliveryOut: 0,
        deliveryTotal: 14.5,
        deliveryPricePerKm: 1,
        resolvedPlaceIn: "Thessaloniki Airport",
        resolvedPlaceOut: "",
      })
    );
  });

  test("returns zero totals when no matching zones are found", async () => {
    Company.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ deliveryPricePerKm: 3 }),
    });
    DeliveryZone.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const result = await calculateDeliveryPrice({
      placeIn: "Unknown pickup",
      placeOut: "Unknown return",
    });

    expect(result).toEqual(
      expect.objectContaining({
        deliveryIn: 0,
        deliveryOut: 0,
        deliveryTotal: 0,
        deliveryPricePerKm: 3,
      })
    );
  });

  test("treats fixedPrice 0 as an explicit fixed zero delivery price", async () => {
    Company.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ deliveryPricePerKm: 3 }),
    });
    DeliveryZone.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { name: "Zero Fixed", distanceKm: 20, fixedPrice: 0, isActive: true },
      ]),
    });

    const result = await calculateDeliveryPrice({
      placeIn: "Zero Fixed",
      placeOut: "",
    });

    expect(result).toEqual(
      expect.objectContaining({
        deliveryIn: 0,
        deliveryOut: 0,
        deliveryTotal: 0,
        resolvedPlaceIn: "Zero Fixed",
      })
    );
  });
});
