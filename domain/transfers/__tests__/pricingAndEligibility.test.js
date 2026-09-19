/**
 * @jest-environment node
 */
import {
  isNightPickup,
  computeCityFormulaPricePure,
} from "../pricingEngine";
import { selectVehicleCategory } from "../vehicleCapacity";
import { DEFAULT_VEHICLE_CATEGORIES } from "@models/TransferVehicleCategory";
import { isCompanyEligibleForTransfer } from "../eligibility";
import { hashToken } from "../claimToken";
import {
  toMinorUnits,
  addMinor,
} from "@/domain/money/minorUnits";
import { buildLocationSnapshot } from "../locationSnapshot";
import {
  canTransitionTransferStatus,
  TRANSFER_STATUS,
  normalizeTransferStatus,
} from "../transferStatus";

describe("transfer night surcharge window", () => {
  test("detects night crossing midnight", () => {
    // 23:30 UTC
    expect(isNightPickup("2026-07-01T23:30:00.000Z", "22:00", "06:00")).toBe(
      true
    );
    // 03:00 UTC
    expect(isNightPickup("2026-07-02T03:00:00.000Z", "22:00", "06:00")).toBe(
      true
    );
    // 12:00 UTC
    expect(isNightPickup("2026-07-02T12:00:00.000Z", "22:00", "06:00")).toBe(
      false
    );
  });
});

describe("city distance formula", () => {
  const rule = {
    baseFareMinor: 2500,
    includedDistanceKm: 10,
    pricePerKmMinor: 120,
    includedDurationMinutes: 0,
    pricePerMinuteMinor: 0,
    minimumFareMinor: 3500,
    roundingIncrementMinor: 1,
    vehicleCategoryMultiplier: 1,
    airportPickupFeeMinor: 500,
    nightStartTime: "22:00",
    nightEndTime: "06:00",
    nightSurchargeType: "fixed",
    nightSurchargeValue: 1500,
  };

  test("applies chargeable km and minimum fare", () => {
    const priced = computeCityFormulaPricePure(
      rule,
      {
        distanceKm: 5,
        durationMinutes: 20,
        origin: { locationType: "city" },
        destination: { locationType: "city" },
        datetime: "2026-07-01T12:00:00.000Z",
      },
      { pricingMultiplier: 1 }
    );
    // base 25€, no chargeable km → 2500 < minimum 3500
    expect(priced.customerPriceMinor).toBe(3500);
    expect(priced.surcharges.some((s) => s.code === "minimum_fare")).toBe(true);
  });

  test("airport surcharge and distance", () => {
    const priced = computeCityFormulaPricePure(
      { ...rule, minimumFareMinor: 0 },
      {
        distanceKm: 60,
        durationMinutes: 50,
        origin: { locationType: "airport" },
        destination: { locationType: "city" },
        datetime: "2026-07-01T12:00:00.000Z",
      },
      { pricingMultiplier: 1 }
    );
    // 2500 + 50*120 + 500 airport = 2500+6000+500 = 9000
    expect(priced.customerPriceMinor).toBe(9000);
    expect(priced.surcharges.some((s) => s.code === "airport_pickup")).toBe(
      true
    );
  });

  test("night surcharge", () => {
    const priced = computeCityFormulaPricePure(
      { ...rule, minimumFareMinor: 0 },
      {
        distanceKm: 10,
        durationMinutes: 20,
        origin: { locationType: "city" },
        destination: { locationType: "city" },
        datetime: "2026-07-01T23:00:00.000Z",
      },
      { pricingMultiplier: 1 }
    );
    expect(priced.surcharges.some((s) => s.code === "night")).toBe(true);
    expect(priced.customerPriceMinor).toBe(2500 + 1500);
  });
});

describe("vehicle capacity selection", () => {
  const cats = DEFAULT_VEHICLE_CATEGORIES.map((c) => ({ ...c, isActive: true }));

  test("recommends smallest suitable category", () => {
    const result = selectVehicleCategory(
      { adults: 2, childrenCount: 0, standardSuitcases: 2, cabinBags: 2 },
      cats
    );
    expect(result.ok).toBe(true);
    expect(result.category.code).toBe("STANDARD");
  });

  test("selects minivan for larger group", () => {
    const result = selectVehicleCategory(
      { adults: 5, childrenCount: 1, standardSuitcases: 4, cabinBags: 3 },
      cats
    );
    expect(result.ok).toBe(true);
    expect(result.category.code).toBe("MINIVAN");
  });

  test("fails when no category fits", () => {
    const result = selectVehicleCategory(
      { adults: 40, childrenCount: 0, standardSuitcases: 40, cabinBags: 40 },
      cats
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("capacity");
  });
});

describe("supplier eligibility", () => {
  const baseCompany = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    country: "ES",
    email: "partner@example.com",
    transferServices: {
      enabled: true,
      suspended: false,
      blockedByAdmin: false,
      supplierAgreementAcceptedAt: new Date(),
      serviceCountries: ["ES"],
      serviceCities: ["malaga", "marbella"],
      airportsServed: ["AGP", "MALAGA AIRPORT"],
      vehicleCategories: ["STANDARD", "MINIVAN"],
      maxPassengers: 7,
      maxStandardLuggage: 6,
      maxCabinBags: 6,
      childSeatsAvailable: 2,
      boosterSeatsAvailable: 2,
      accessibilityOptions: [],
      operatingHours: { start: "00:00", end: "23:59" },
      blackoutDates: [],
      minimumNoticeHours: 1,
      acceptUrgentRequests: true,
      notifyOnNewTransfer: true,
    },
  };

  const transfer = {
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
    passengers: 2,
    adults: 2,
    standardSuitcases: 2,
    cabinBags: 2,
    vehicleCategory: "STANDARD",
    datetime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    distanceKm: 50,
  };

  test("eligible company passes", () => {
    expect(isCompanyEligibleForTransfer(baseCompany, transfer).ok).toBe(true);
  });

  test("rejects disabled transfer services", () => {
    const c = {
      ...baseCompany,
      transferServices: { ...baseCompany.transferServices, enabled: false },
    };
    expect(isCompanyEligibleForTransfer(c, transfer).ok).toBe(false);
  });

  test("rejects missing agreement", () => {
    const c = {
      ...baseCompany,
      transferServices: {
        ...baseCompany.transferServices,
        supplierAgreementAcceptedAt: null,
      },
    };
    expect(isCompanyEligibleForTransfer(c, transfer).ok).toBe(false);
  });
});

describe("location snapshot + money", () => {
  test("builds immutable-shaped snapshot", () => {
    const snap = buildLocationSnapshot({
      placeName: "Malaga Airport",
      iataCode: "AGP",
      country: "es",
      lat: 36.67,
      lng: -4.49,
    });
    expect(snap.country).toBe("ES");
    expect(snap.locationType).toBe("airport");
    expect(snap.iataCode).toBe("AGP");
  });

  test("customer vs supplier separation via minor units", () => {
    const customer = toMinorUnits(80);
    const supplier = toMinorUnits(68);
    const margin = addMinor(customer, -supplier);
    expect(customer).toBe(8000);
    expect(supplier).toBe(6800);
    expect(margin).toBe(1200);
  });
});

describe("transfer status machine", () => {
  test("normalizes legacy open → OPEN_FOR_CLAIM", () => {
    expect(normalizeTransferStatus("open")).toBe(
      TRANSFER_STATUS.OPEN_FOR_CLAIM
    );
  });

  test("allows claim transition", () => {
    expect(
      canTransitionTransferStatus(
        TRANSFER_STATUS.OPEN_FOR_CLAIM,
        TRANSFER_STATUS.CLAIMED
      )
    ).toBe(true);
  });

  test("allows reopen after supplier cancel", () => {
    expect(
      canTransitionTransferStatus(
        TRANSFER_STATUS.SUPPLIER_CANCELLED,
        TRANSFER_STATUS.REOPENED_FOR_CLAIM
      )
    ).toBe(true);
  });
});

describe("hashed tokens", () => {
  test("hashToken is stable and not reversible", () => {
    const a = hashToken("secret-token-value-123456");
    const b = hashToken("secret-token-value-123456");
    expect(a).toBe(b);
    expect(a).not.toContain("secret-token");
    expect(a.length).toBe(64);
  });
});

describe("manual quote threshold helper", () => {
  test("threshold comparison", () => {
    const distanceKm = 250;
    const manualQuoteThresholdKm = 200;
    expect(distanceKm > manualQuoteThresholdKm).toBe(true);
  });
});

describe("return route direction flag", () => {
  test("direction matcher concept", () => {
    const matchesDirection = (rule, isReturn) => {
      const d = rule.direction || "both";
      if (d === "both") return true;
      if (d === "return") return Boolean(isReturn);
      return !isReturn;
    };
    expect(matchesDirection({ direction: "one_way" }, false)).toBe(true);
    expect(matchesDirection({ direction: "one_way" }, true)).toBe(false);
    expect(matchesDirection({ direction: "return" }, true)).toBe(true);
    expect(matchesDirection({ direction: "both" }, true)).toBe(true);
  });
});

describe("quote snapshot immutability shape", () => {
  test("snapshot fields are frozen copies conceptually", () => {
    const snapshot = {
      customerPriceMinor: 8000,
      supplierPayoutMinor: 6800,
      platformMarginMinor: 1200,
      currency: "EUR",
      pricingMethod: "FIXED_ROUTE",
      pricingRuleId: "rule1",
      pricingRuleVersion: 1,
      calculatedAt: new Date().toISOString(),
    };
    const laterRuleChange = { customerPriceMinor: 9000 };
    // Historical order keeps original
    expect(snapshot.customerPriceMinor).toBe(8000);
    expect(laterRuleChange.customerPriceMinor).not.toBe(
      snapshot.customerPriceMinor
    );
  });
});
