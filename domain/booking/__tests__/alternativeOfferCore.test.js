/**
 * @jest-environment node
 */
import { BOOKING_STATUS } from "../bookingStatus";
import { BOOKING_MODES } from "../bookingMode";
import {
  ALTERNATIVE_OFFER_CODE,
  applyReplacementPriceCap,
  assertProposedCarCompany,
  buildCappedAuthoritativePrice,
  compareMaterialRentalTerms,
  evaluateAutomaticAlternativeEligibility,
} from "../alternativeOfferCore";
import { validateAlternativeNotWorse } from "../alternativeVehicle";

describe("automatic alternative eligibility (Spain P0)", () => {
  const spain = {
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    countryCode: "ES",
    ownerId: "company-a",
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    payment: { status: "unpaid" },
  };

  test("ADMIN creates only for own unpaid marketplace order", () => {
    const result = evaluateAutomaticAlternativeEligibility(spain, {
      actor: { role: 1, ownerId: "company-a" },
    });
    expect(result.ok).toBe(true);
  });

  test("SUPERADMIN is permitted", () => {
    const result = evaluateAutomaticAlternativeEligibility(spain, {
      actor: { role: 2, ownerId: "company-b", isSuperadmin: true },
    });
    expect(result.ok).toBe(true);
  });

  test("other-company ADMIN is rejected", () => {
    const result = evaluateAutomaticAlternativeEligibility(spain, {
      actor: { role: 1, ownerId: "company-b" },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(ALTERNATIVE_OFFER_CODE.WRONG_COMPANY_ORDER);
  });

  test("Greece OPS_CALENDAR is rejected", () => {
    const result = evaluateAutomaticAlternativeEligibility(
      {
        ...spain,
        bookingMode: BOOKING_MODES.OPS_CALENDAR,
        countryCode: "GR",
      },
      { actor: { role: 1, ownerId: "company-a" } }
    );
    expect(result.code).toBe(ALTERNATIVE_OFFER_CODE.NOT_MARKETPLACE);
  });

  test("transfer-like orders without marketplace mode are rejected", () => {
    const result = evaluateAutomaticAlternativeEligibility(
      {
        ownerId: "company-a",
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
        payment: { status: "unpaid" },
        countryCode: "ES",
        isTransfer: true,
      },
      { actor: { role: 1, ownerId: "company-a" } }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe(ALTERNATIVE_OFFER_CODE.NOT_MARKETPLACE);
  });

  test("paid order cannot use the automatic flow", () => {
    const result = evaluateAutomaticAlternativeEligibility(
      {
        ...spain,
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
        payment: { status: "paid" },
      },
      { actor: { role: 1, ownerId: "company-a" } }
    );
    expect(result.code).toBe(ALTERNATIVE_OFFER_CODE.PAID_REQUIRES_MANUAL);
  });

  test("SUPERADMIN still cannot run the automatic flow on a paid order", () => {
    const result = evaluateAutomaticAlternativeEligibility(
      {
        ...spain,
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
        payment: { status: "paid" },
      },
      { actor: { role: 2, ownerId: "company-b", isSuperadmin: true } }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe(ALTERNATIVE_OFFER_CODE.PAID_REQUIRES_MANUAL);
  });

  test("cancelled/rejected/completed orders are rejected", () => {
    for (const bookingStatus of [
      BOOKING_STATUS.CUSTOMER_CANCELLED,
      BOOKING_STATUS.SUPPLIER_DECLINED,
      BOOKING_STATUS.COMPLETED,
    ]) {
      expect(
        evaluateAutomaticAlternativeEligibility(
          { ...spain, bookingStatus },
          { actor: { role: 1, ownerId: "company-a" } }
        ).ok
      ).toBe(false);
    }
  });
});

describe("proposed stored car", () => {
  const order = { ownerId: "company-a", car: "car-a" };

  test("ad-hoc vehicle without stored car ID is rejected", () => {
    expect(
      assertProposedCarCompany({ car: null, order, proposedCarId: "" }).code
    ).toBe(ALTERNATIVE_OFFER_CODE.CAR_REQUIRED);
  });

  test("other-company car is rejected", () => {
    expect(
      assertProposedCarCompany({
        car: { _id: "car-b", ownerId: "company-b" },
        order,
        proposedCarId: "car-b",
      }).code
    ).toBe(ALTERNATIVE_OFFER_CODE.WRONG_COMPANY_CAR);
  });

  test("original car cannot be its own alternative", () => {
    expect(
      assertProposedCarCompany({
        car: { _id: "car-a", ownerId: "company-a" },
        order,
        proposedCarId: "car-a",
      }).code
    ).toBe(ALTERNATIVE_OFFER_CODE.SAME_CAR);
  });

  test("unpublished same-company car is allowed", () => {
    expect(
      assertProposedCarCompany({
        car: { _id: "car-b", ownerId: "company-a", isActive: false },
        order,
        proposedCarId: "car-b",
      }).ok
    ).toBe(true);
  });

  test("deleted/archived car is rejected", () => {
    expect(
      assertProposedCarCompany({
        car: { _id: "car-b", ownerId: "company-a", archived: true },
        order,
        proposedCarId: "car-b",
      }).code
    ).toBe(ALTERNATIVE_OFFER_CODE.CAR_DELETED);
  });
});

describe("replacement price cap", () => {
  test("cheaper alternative uses the lower calculated price", () => {
    const cap = applyReplacementPriceCap({
      calculatedGrossMinor: 80000,
      originalGrossMinor: 100000,
    });
    expect(cap.offeredGrossMinor).toBe(80000);
    expect(cap.replacementDiscountMinor).toBe(0);
    expect(cap.prepaymentMinor).toBe(8000);
    expect(cap.balanceMinor).toBe(72000);
  });

  test("more expensive alternative is capped with a replacement discount", () => {
    const cap = applyReplacementPriceCap({
      calculatedGrossMinor: 140000,
      originalGrossMinor: 100000,
    });
    expect(cap.offeredGrossMinor).toBe(100000);
    expect(cap.replacementDiscountMinor).toBe(40000);
    expect(cap.prepaymentMinor).toBe(10000);
    expect(cap.balanceMinor).toBe(90000);
  });

  test("10% is of offered gross (delivery already inside gross)", () => {
    const cap = applyReplacementPriceCap({
      calculatedGrossMinor: 110000,
      originalGrossMinor: 110000,
    });
    expect(cap.prepaymentMinor).toBe(11000);
    expect(cap.prepaymentMinor + cap.balanceMinor).toBe(110000);
  });

  test("delivery line items stay on the calculated quote while gross is capped", () => {
    const capped = buildCappedAuthoritativePrice(
      {
        pickupFeeMinor: 2500,
        returnFeeMinor: 2500,
        grossMinor: 140000,
        prepaymentMinor: 14000,
      },
      applyReplacementPriceCap({
        calculatedGrossMinor: 140000,
        originalGrossMinor: 100000,
      })
    );
    expect(capped.pickupFeeMinor).toBe(2500);
    expect(capped.returnFeeMinor).toBe(2500);
    expect(capped.grossMinor).toBe(100000);
    expect(capped.replacementDiscountMinor).toBe(40000);
  });

  test("validateAlternativeNotWorse still refuses an uncapped increase", () => {
    const result = validateAlternativeNotWorse({
      original: { priceMinor: 100000, category: "compact" },
      alternative: {
        priceMinor: 100001,
        category: "compact",
        photos: ["p"],
        reasonForReplacement: "damage",
      },
    });
    expect(result.code).toBe("price_increase");
  });

  test("worse category is rejected; same/better is accepted", () => {
    const worse = validateAlternativeNotWorse({
      original: { priceMinor: 1000, category: "suv" },
      alternative: {
        priceMinor: 1000,
        category: "economy",
        photos: ["p"],
        reasonForReplacement: "x",
      },
    });
    expect(worse.code).toBe("category_downgrade");
    const better = validateAlternativeNotWorse({
      original: { priceMinor: 1000, category: "compact" },
      alternative: {
        priceMinor: 1000,
        category: "premium",
        photos: ["p"],
        reasonForReplacement: "x",
      },
    });
    expect(better.ok).toBe(true);
  });
});

describe("material rental terms", () => {
  test("identical terms do not require renewed consent", () => {
    const slice = {
      companyId: "c1",
      insurance: "CDW",
      insuranceExcessMajor: 300,
      securityDepositMajor: 400,
      mileagePolicy: "unlimited",
      fuelPolicy: "full-full",
      minDriverAge: 21,
      requiredDrivingExperienceYears: 2,
      companyTermsHash: "abc",
      platformTermsChecksum: "def",
      hash: "h1",
    };
    const result = compareMaterialRentalTerms(slice, { ...slice });
    expect(result.termsChanged).toBe(false);
    expect(result.changedTerms).toEqual([]);
  });

  test("changed excess/deposit/terms require explicit consent", () => {
    const original = {
      companyId: "c1",
      insurance: "CDW",
      insuranceExcessMajor: 300,
      securityDepositMajor: 400,
      mileagePolicy: "unlimited",
      fuelPolicy: "full-full",
      minDriverAge: 21,
      requiredDrivingExperienceYears: 2,
      companyTermsHash: "abc",
      platformTermsChecksum: "def",
      hash: "h1",
    };
    const proposed = {
      ...original,
      insuranceExcessMajor: 800,
      companyTermsHash: "xyz",
      hash: "h2",
    };
    const result = compareMaterialRentalTerms(original, proposed);
    expect(result.termsChanged).toBe(true);
    expect(result.changedTerms.map((row) => row.key)).toEqual(
      expect.arrayContaining(["insurance_excess", "company_rental_terms"])
    );
  });
});

describe("offer capability ids", () => {
  test("new IDs are 128-bit ALT- hex and unique across a sample", () => {
    const {
      generateOfferId,
      CURRENT_OFFER_ID_HEX_LENGTH,
      OFFER_ID_PREFIX,
      isValidOfferCapabilityId,
    } = require("../alternativeOfferCore");
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      const id = generateOfferId();
      expect(id.startsWith(OFFER_ID_PREFIX)).toBe(true);
      expect(id.slice(OFFER_ID_PREFIX.length)).toHaveLength(CURRENT_OFFER_ID_HEX_LENGTH);
      expect(isValidOfferCapabilityId(id)).toBe(true);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  test("legacy 64-bit IDs remain valid; malformed IDs do not", () => {
    const {
      isValidOfferCapabilityId,
      normalizeOfferCapabilityId,
    } = require("../alternativeOfferCore");
    expect(normalizeOfferCapabilityId("alt-abcdef0123456789")).toBe(
      "ALT-ABCDEF0123456789"
    );
    expect(isValidOfferCapabilityId("ALT-ABCDEF0123456789")).toBe(true);
    expect(isValidOfferCapabilityId("ALT-1")).toBe(false);
    expect(isValidOfferCapabilityId("507f1f77bcf86cd799439011")).toBe(false);
    expect(normalizeOfferCapabilityId("not-an-id")).toBe("");
  });
});
