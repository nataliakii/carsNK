/**
 * @jest-environment node
 */
import {
  buildCompanyTransferBaseFilter,
  countVisibleOpenTransfersForCompany,
  filterTransfersForCompanyViewer,
  listVisibleTransfersForCompany,
} from "../transferVisibility";
import {
  isTransferVisibleToCompany,
  isCompanyEligibleForTransfer,
} from "../eligibility";
import { TRANSFER_ELIGIBILITY_PURPOSE } from "../transferSettings";
import {
  carChildSeatStatus,
  CHILD_SEAT_STATUS,
} from "../transferFleet";
import {
  inferProvinceCodeFromLocation,
  locationInServiceAreas,
} from "@/domain/geo/spainPlaceCoverage";

const companyA = {
  _id: "64b7f2c3a1b2c3d4e5f60711",
  country: "ES",
  email: "a@partner.test",
  deliveryPricing: { operatingCities: ["Malaga", "Marbella"] },
  offices: [{ name: "Malaga Airport", locationType: "airport", iataCode: "AGP" }],
  transferServices: {
    enabled: true,
    supplierAgreementAcceptedAt: new Date(),
    acceptAllTransferRequests: true,
    transferCoverageFollowsCompany: true,
    useRentalFleet: true,
    maxPassengers: 3,
    vehicleCategories: ["STANDARD"],
    childSeatsAvailable: 0,
  },
};

const companyB = {
  _id: "64b7f2c3a1b2c3d4e5f60722",
  country: "ES",
  email: "b@partner.test",
  deliveryPricing: { operatingCities: ["Barcelona"] },
  offices: [
    { name: "Barcelona Airport", locationType: "airport", iataCode: "BCN" },
  ],
  transferServices: {
    enabled: true,
    supplierAgreementAcceptedAt: new Date(),
    acceptAllTransferRequests: true,
    transferCoverageFollowsCompany: true,
  },
};

const malagaTransfer = {
  country: "ES",
  from: "Malaga Airport",
  to: "Marbella",
  origin: {
    city: "Malaga",
    locationType: "airport",
    iataCode: "AGP",
    placeName: "Malaga Airport",
  },
  destination: { city: "Marbella", placeName: "Marbella" },
  passengers: 6,
  adults: 6,
  vehicleCategory: "MINIVAN",
  childSeats: 1,
  datetime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
};

const barcelonaTransfer = {
  ...malagaTransfer,
  from: "Barcelona Airport",
  to: "Sitges",
  origin: {
    city: "Barcelona",
    locationType: "airport",
    iataCode: "BCN",
    placeName: "Barcelona Airport",
  },
  destination: { city: "Barcelona", placeName: "Barcelona" },
};

const fleetCars = [
  {
    _id: "van",
    ownerId: companyA._id,
    class: "minibus",
    seats: 7,
    PriceChildSeats: 5,
    isActive: true,
  },
];

function fakeTransferModel(docs) {
  const sorted = [...docs].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    if (tb !== ta) return tb - ta;
    return String(b._id).localeCompare(String(a._id));
  });
  return {
    find() {
      return {
        sort() {
          return {
            skip(n) {
              return {
                limit(m) {
                  return {
                    lean: async () => sorted.slice(n, n + m),
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("accept-all visibility vs fulfillment", () => {
  test("accept-all shows service-area requests without auto-accepting capacity", () => {
    const visible = isTransferVisibleToCompany(companyA, malagaTransfer, {
      cars: [],
    });
    expect(visible.ok).toBe(true);
    expect(visible.acceptAll).toBe(true);

    const fulfillEmpty = isCompanyEligibleForTransfer(companyA, malagaTransfer, {
      purpose: TRANSFER_ELIGIBILITY_PURPOSE.FULFILLMENT,
      cars: [],
    });
    expect(fulfillEmpty.ok).toBe(false);
    expect(fulfillEmpty.reasons).toContain("fleet_capacity");

    const fulfillFleet = isCompanyEligibleForTransfer(companyA, malagaTransfer, {
      purpose: TRANSFER_ELIGIBILITY_PURPOSE.FULFILLMENT,
      cars: fleetCars,
    });
    expect(fulfillFleet.ok).toBe(true);
  });

  test("service-area scoping hides requests outside coverage", () => {
    expect(
      isTransferVisibleToCompany(companyA, barcelonaTransfer, { cars: fleetCars })
        .ok
    ).toBe(false);
    expect(
      isTransferVisibleToCompany(companyB, malagaTransfer, { cars: [] }).ok
    ).toBe(false);
    expect(
      isTransferVisibleToCompany(companyB, barcelonaTransfer, { cars: [] }).ok
    ).toBe(true);
  });

  test("community coverage matches provinces (shared vs transfer-specific)", () => {
    const cataloniaCo = {
      ...companyB,
      serviceAreas: { communityCodes: ["09"], provinceCodes: [] },
      deliveryPricing: { operatingCities: [] },
      transferServices: {
        ...companyB.transferServices,
        transferCoverageFollowsCompany: true,
        serviceCities: [],
        airportsServed: [],
      },
    };
    expect(
      isTransferVisibleToCompany(cataloniaCo, barcelonaTransfer, { cars: [] }).ok
    ).toBe(true);
    expect(
      isTransferVisibleToCompany(cataloniaCo, malagaTransfer, { cars: [] }).ok
    ).toBe(false);

    const transferOnly = {
      ...companyA,
      transferServices: {
        ...companyA.transferServices,
        transferCoverageFollowsCompany: false,
        serviceCities: [],
        airportsServed: [],
        serviceAreas: { communityCodes: [], provinceCodes: ["29"] },
      },
    };
    expect(
      isTransferVisibleToCompany(transferOnly, malagaTransfer, { cars: [] }).ok
    ).toBe(true);
    expect(
      isTransferVisibleToCompany(transferOnly, barcelonaTransfer, { cars: [] })
        .ok
    ).toBe(false);
  });

  test("company isolation: another company's claimed job is hidden", () => {
    const items = [
      { ...malagaTransfer, _id: "open-a" },
      {
        ...barcelonaTransfer,
        _id: "claimed-b",
        assignedSupplierId: companyB._id,
      },
    ];
    const visible = filterTransfersForCompanyViewer(
      items,
      companyA,
      fleetCars,
      companyA._id
    );
    expect(visible.map((i) => i._id)).toEqual(["open-a"]);
  });

  test("filters before pagination so busy countries still return in-area rows", async () => {
    const docs = [];
    for (let i = 0; i < 40; i += 1) {
      docs.push({
        ...barcelonaTransfer,
        _id: `out-${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }
    docs.push({
      ...malagaTransfer,
      _id: "in-area",
      createdAt: new Date(Date.now() - 50_000),
    });

    const page = await listVisibleTransfersForCompany({
      TransferModel: fakeTransferModel(docs),
      baseFilter: buildCompanyTransferBaseFilter(companyA._id, "ES", "open"),
      company: companyA,
      cars: fleetCars,
      ownerId: companyA._id,
      limit: 5,
      skip: 0,
      batchSize: 10,
    });

    expect(page.total).toBe(1);
    expect(page.items.map((i) => i._id)).toEqual(["in-area"]);
  });

  test("visible open count matches list total (bell/list consistency)", async () => {
    const docs = [
      { ...malagaTransfer, _id: "m1", createdAt: new Date() },
      { ...barcelonaTransfer, _id: "b1", createdAt: new Date(Date.now() - 1) },
      {
        ...barcelonaTransfer,
        _id: "claimed-other",
        assignedSupplierId: companyB._id,
        createdAt: new Date(Date.now() - 2),
      },
    ];
    const model = fakeTransferModel(docs);
    const list = await listVisibleTransfersForCompany({
      TransferModel: model,
      baseFilter: buildCompanyTransferBaseFilter(companyA._id, "ES", "open"),
      company: companyA,
      cars: fleetCars,
      ownerId: companyA._id,
      limit: 20,
    });
    const bell = await countVisibleOpenTransfersForCompany({
      TransferModel: model,
      company: companyA,
      cars: fleetCars,
      ownerId: companyA._id,
      companyCountry: "ES",
    });
    expect(bell).toBe(list.total);
    expect(list.total).toBe(1);
  });

  test("manual fleet mode ignores rental cars and uses saved vehicle fields", () => {
    const manual = {
      ...companyA,
      transferServices: {
        enabled: true,
        supplierAgreementAcceptedAt: new Date(),
        useRentalFleet: false,
        acceptAllTransferRequests: false,
        serviceCities: ["malaga", "marbella"],
        airportsServed: ["AGP"],
        vehicleCategories: ["STANDARD"],
        maxPassengers: 3,
        childSeatsAvailable: 0,
      },
    };
    const check = isCompanyEligibleForTransfer(manual, malagaTransfer, {
      cars: fleetCars,
    });
    expect(check.ok).toBe(false);
    expect(check.reasons).toEqual(
      expect.arrayContaining(["passenger_capacity", "vehicle_category"])
    );
  });

  test("existing saved filters still apply when accept-all is unset", () => {
    const legacy = {
      ...companyA,
      transferServices: {
        enabled: true,
        supplierAgreementAcceptedAt: new Date(),
        serviceCities: ["malaga", "marbella"],
        airportsServed: ["AGP"],
        vehicleCategories: ["STANDARD"],
        maxPassengers: 3,
        childSeatsAvailable: 0,
      },
    };
    const check = isCompanyEligibleForTransfer(legacy, malagaTransfer);
    expect(check.ok).toBe(false);
    expect(check.reasons).toEqual(
      expect.arrayContaining(["passenger_capacity", "vehicle_category"])
    );
    expect(check.acceptAll).toBe(false);
  });
});

describe("child seats confirmation-required", () => {
  test("priced extra alone is confirmation_required, never guaranteed inventory", () => {
    const status = carChildSeatStatus(
      { PriceChildSeats: 10, isActive: true },
      1
    );
    expect(status.status).toBe(CHILD_SEAT_STATUS.CONFIRMATION_REQUIRED);
    expect(status.ok).toBe(true);
  });

  test("explicit inventory satisfies the request", () => {
    const status = carChildSeatStatus(
      { childSeatsAvailable: 2, PriceChildSeats: 10 },
      1
    );
    expect(status.status).toBe(CHILD_SEAT_STATUS.INVENTORY);
  });
});

describe("admin place coverage", () => {
  test("maps cities and airports to provinces for GeoJSON-aligned codes", () => {
    expect(
      inferProvinceCodeFromLocation({ city: "Barcelona", iataCode: "BCN" })
    ).toBe("08");
    expect(inferProvinceCodeFromLocation({ city: "Malaga" })).toBe("29");
    expect(
      locationInServiceAreas(
        { city: "Girona" },
        { communityCodes: ["09"], provinceCodes: [] }
      )
    ).toBe(true);
    expect(
      locationInServiceAreas(
        { city: "Malaga" },
        { communityCodes: ["09"], provinceCodes: [] }
      )
    ).toBe(false);
  });
});
