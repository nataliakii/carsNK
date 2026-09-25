import mongoose from "mongoose";
import {
  COVERAGE_ERROR,
  addressOutsideCoverageMessage,
  assertDeliveryInCompanyCoverage,
  assertOfficeInCompanyCoverage,
  bookingCoverageQueryKey,
  deliveryPricingOfCompany,
  impliedLocationCountry,
  predictionInsideCoverage,
  reconcileBookingSelection,
  resolveCompanyBookingCoverage,
  sameReturnFromPickup,
} from "../companyBookingCoverage";

function company({ id, country, cities, locations, serviceAreas, offices, pricing }) {
  return {
    _id: id,
    country,
    offices: offices || [],
    locations: locations || [],
    serviceAreas: serviceAreas || { communityCodes: [], provinceCodes: [] },
    cityIds: [],
    deliveryPricing: {
      strategy: "cities",
      version: 3,
      operatingCities: cities,
      inside: { mode: "fixed", amount: country === "ES" && cities?.[0] === "Madrid" ? 40 : 12 },
      ...(pricing || {}),
    },
  };
}

const officeAId = new mongoose.Types.ObjectId();
const officeBId = new mongoose.Types.ObjectId();
const officeA = {
  _id: officeAId,
  name: "Barcelona Desk",
  address: "Carrer de Mallorca 1",
  city: "Barcelona",
  country: "ES",
  status: "active",
};
const officeB = {
  _id: officeBId,
  name: "Madrid Desk",
  city: "Madrid",
  country: "ES",
  status: "active",
};

const companyA = company({
  id: "company-a",
  country: "ES",
  cities: ["Barcelona"],
  locations: [{ name: "Olympiada" }, { name: "Kriopigi" }, { name: "Madrid" }],
  offices: [officeA],
});
const companyB = company({
  id: "company-b",
  country: "ES",
  cities: ["Madrid"],
  offices: [officeB],
});
const companyC = company({
  id: "company-c",
  country: "GR",
  cities: ["Olympiada", "Kriopigi"],
  offices: [
    {
      _id: "office-c",
      name: "Halkidiki Desk",
      country: "GR",
      status: "active",
    },
  ],
});

describe("impliedLocationCountry", () => {
  test("compound labels inherit market from embedded city name", () => {
    expect(impliedLocationCountry("Thessaloniki Airport")).toBe("GR");
    expect(impliedLocationCountry("Palma Airport")).toBe("ES");
    expect(impliedLocationCountry("Custom Rovaro Hub")).toBe("");
  });
});

describe("company booking coverage isolation", () => {
  test("Barcelona company shows Barcelona only", () => {
    const coverage = resolveCompanyBookingCoverage({
      company: companyA,
      car: { ownerId: "company-a" },
    });
    expect(coverage.deliveryAreas.map((area) => area.name)).toEqual(["Barcelona"]);
    expect(coverage.deliveryAreas[0].countryCode).toBe("ES");
    expect(coverage.offices.map((office) => office.id)).toEqual([String(officeAId)]);
  });

  test("Barcelona company does not show Madrid or Greek cities", () => {
    const names = resolveCompanyBookingCoverage({
      company: companyA,
      car: { ownerId: "company-a" },
    }).deliveryAreas.map((area) => area.name);
    expect(names).not.toContain("Madrid");
    expect(names).not.toContain("Olympiada");
    expect(names).not.toContain("Kriopigi");
  });

  test("Madrid company shows Madrid only", () => {
    const names = resolveCompanyBookingCoverage({
      company: companyB,
      car: { ownerId: "company-b" },
    }).deliveryAreas.map((area) => area.name);
    expect(names).toEqual(["Madrid"]);
  });

  test("Greek company shows only its Greek coverage", () => {
    const names = resolveCompanyBookingCoverage({
      company: companyC,
      car: { ownerId: "company-c" },
    }).deliveryAreas.map((area) => area.name);
    expect(names).toEqual(["Kriopigi", "Olympiada"]);
    expect(names).not.toContain("Barcelona");
    expect(names).not.toContain("Madrid");
  });

  test("switching from Greek car to Barcelona car clears Olympiada", () => {
    const greek = resolveCompanyBookingCoverage({
      company: companyC,
      car: { ownerId: "company-c" },
    });
    const spanish = resolveCompanyBookingCoverage({
      company: companyA,
      car: { ownerId: "company-a" },
    });
    const stale = reconcileBookingSelection(
      { method: "delivery", areaName: "Olympiada" },
      spanish
    );
    expect(stale.areaName).toBe("Barcelona");
    expect(stale.areaName).not.toBe("Olympiada");
    expect(findName(greek, "Olympiada")).toBe(true);
  });

  test("forged Madrid or Greek location is rejected for the Barcelona car", () => {
    const coverage = resolveCompanyBookingCoverage({
      company: companyA,
      car: { ownerId: "company-a" },
    });
    expect(
      assertDeliveryInCompanyCoverage(coverage, {
        name: "Madrid",
        countryCode: "ES",
      }).code
    ).toBe(COVERAGE_ERROR.LOCATION_OUTSIDE_COMPANY_COVERAGE);
    expect(
      assertDeliveryInCompanyCoverage(coverage, {
        name: "Olympiada",
        countryCode: "GR",
      }).code
    ).toBe(COVERAGE_ERROR.LOCATION_COUNTRY_MISMATCH);
  });

  test("cross-company office ids are rejected", () => {
    const coverage = resolveCompanyBookingCoverage({
      company: companyA,
      car: { ownerId: "company-a" },
    });
    expect(assertOfficeInCompanyCoverage(coverage, String(officeBId)).code).toBe(
      COVERAGE_ERROR.OFFICE_NOT_OWNED_BY_COMPANY
    );
    expect(assertOfficeInCompanyCoverage(coverage, String(officeAId)).ok).toBe(true);
  });

  test("company with no delivery coverage is office-only", () => {
    const coverage = resolveCompanyBookingCoverage({
      company: company({
        id: "company-empty",
        country: "ES",
        cities: [],
        offices: [officeA],
      }),
      car: { ownerId: "company-empty" },
    });
    expect(coverage.deliveryAvailable).toBe(false);
    expect(coverage.deliveryAreas).toEqual([]);
    expect(coverage.offices).toHaveLength(1);
    expect(
      assertDeliveryInCompanyCoverage(coverage, {
        name: "Barcelona",
        countryCode: "ES",
      }).code
    ).toBe(COVERAGE_ERROR.DELIVERY_NOT_AVAILABLE);
    expect(assertOfficeInCompanyCoverage(coverage, String(officeAId)).ok).toBe(true);
  });

  test("address suggestions outside coverage cannot be selected", () => {
    const coverage = resolveCompanyBookingCoverage({
      company: companyA,
      car: { ownerId: "company-a" },
    });
    expect(
      predictionInsideCoverage(
        { description: "Gran Via, Madrid, Spain" },
        coverage,
        "Barcelona"
      )
    ).toBe(false);
    expect(
      predictionInsideCoverage(
        { description: "Carrer de Mallorca, Barcelona, Spain" },
        coverage,
        "Barcelona"
      )
    ).toBe(true);
    const rejected = assertDeliveryInCompanyCoverage(coverage, {
      name: "Barcelona",
      countryCode: "ES",
      locality: "Madrid",
      address: "Gran Via, Madrid",
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.message).toBe(
      addressOutsideCoverageMessage(["Barcelona"])
    );
  });

  test("delivery pricing comes only from the owning company", () => {
    expect(deliveryPricingOfCompany(companyA).inside.amount).toBe(12);
    expect(deliveryPricingOfCompany(companyB).inside.amount).toBe(40);
    expect(deliveryPricingOfCompany(companyA)).not.toBe(
      deliveryPricingOfCompany(companyB)
    );
  });

  test("cache keys do not leak between companies", () => {
    const a = resolveCompanyBookingCoverage({ company: companyA, car: { ownerId: "company-a" } });
    const b = resolveCompanyBookingCoverage({ company: companyB, car: { ownerId: "company-b" } });
    expect(a.queryKey).toEqual(bookingCoverageQueryKey("company-a", "3"));
    expect(b.queryKey).toEqual(bookingCoverageQueryKey("company-b", "3"));
    expect(a.queryKey).not.toEqual(b.queryKey);
    expect(a.queryKey[0]).toBe("booking-coverage");
    a.deliveryAreas.push({ name: "Madrid" });
    const fresh = resolveCompanyBookingCoverage({
      company: companyA,
      car: { ownerId: "company-a" },
    });
    expect(fresh.deliveryAreas.map((area) => area.name)).toEqual(["Barcelona"]);
  });

  test("same-return uses the validated pickup", () => {
    const coverage = resolveCompanyBookingCoverage({
      company: companyA,
      car: { ownerId: "company-a" },
    });
    const pickup = reconcileBookingSelection(
      { method: "delivery", areaName: "Olympiada" },
      coverage
    );
    expect(sameReturnFromPickup(pickup)).toEqual(pickup);
    expect(sameReturnFromPickup(pickup).areaName).toBe("Barcelona");
  });

  test("office pickup stays valid without a delivery city", () => {
    const coverage = resolveCompanyBookingCoverage({
      company: company({
        id: "company-office",
        country: "ES",
        cities: [],
        offices: [officeA],
      }),
      car: { ownerId: "company-office" },
    });
    const pickup = reconcileBookingSelection(
      { method: "office", officeId: String(officeAId) },
      coverage
    );
    expect(pickup.valid).toBe(true);
    expect(pickup.areaId).toBe("");
    expect(pickup.areaName).toBe("Barcelona Desk");
  });

  test("production Barcelona shape ignores legacy Greek locations and radius catalog", () => {
    const coverage = resolveCompanyBookingCoverage({
      company: {
        _id: "barcelona-prod",
        country: "ES",
        orderRadiusKm: 500,
        locations: [
          { name: "Olympiada" },
          { name: "Kriopigi" },
          { name: "Nikiti" },
          { name: "Sarti" },
          { name: "Kassandra" },
        ],
        serviceAreas: { communityCodes: [], provinceCodes: [] },
        cityIds: [],
        deliveryPricing: {
          strategy: "cities",
          version: 4,
          operatingCities: ["Barcelona"],
        },
        offices: [officeA],
      },
      car: { ownerId: "barcelona-prod" },
      catalogCities: [
        { _id: "mad", name: "Madrid", country: "ES" },
        { _id: "oly", name: "Olympiada", country: "GR" },
      ],
    });
    expect(coverage.deliveryAreas.map((area) => area.name)).toEqual(["Barcelona"]);
    expect(coverage.countryCode).toBe("ES");
  });
});

function findName(coverage, name) {
  return coverage.deliveryAreas.some((area) => area.name === name);
}
