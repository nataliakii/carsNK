import { validateAlternativeNotWorse } from "@/domain/booking/alternativeVehicle";

function original(overrides = {}) {
  return {
    priceMinor: 30000,
    category: "compact",
    transmission: "automatic",
    seats: 5,
    luggage: 2,
    ...overrides,
  };
}

function alternative(overrides = {}) {
  return {
    priceMinor: 30000,
    category: "compact",
    transmission: "automatic",
    seats: 5,
    luggage: 2,
    photos: ["https://example.test/a.jpg"],
    reasonForReplacement: "The booked vehicle was damaged in a previous rental.",
    ...overrides,
  };
}

describe("an alternative may never leave the customer worse off", () => {
  it("accepts a like-for-like replacement", () => {
    expect(
      validateAlternativeNotWorse({
        original: original(),
        alternative: alternative(),
      }).ok
    ).toBe(true);
  });

  it("accepts a free upgrade", () => {
    const result = validateAlternativeNotWorse({
      original: original(),
      alternative: alternative({ category: "suv", seats: 7, priceMinor: 30000 }),
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a cheaper replacement", () => {
    expect(
      validateAlternativeNotWorse({
        original: original(),
        alternative: alternative({ priceMinor: 25000 }),
      }).ok
    ).toBe(true);
  });

  it("refuses any price increase", () => {
    const result = validateAlternativeNotWorse({
      original: original(),
      alternative: alternative({ priceMinor: 30001 }),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("price_increase");
  });

  it("refuses a lower vehicle class", () => {
    const result = validateAlternativeNotWorse({
      original: original({ category: "suv" }),
      alternative: alternative({ category: "economy" }),
    });
    expect(result.code).toBe("category_downgrade");
  });

  it("refuses a manual replacement for an automatic booking", () => {
    const result = validateAlternativeNotWorse({
      original: original(),
      alternative: alternative({ transmission: "manual" }),
    });
    expect(result.code).toBe("transmission_downgrade");
  });

  it("refuses fewer seats", () => {
    const result = validateAlternativeNotWorse({
      original: original({ seats: 7 }),
      alternative: alternative({ seats: 5 }),
    });
    expect(result.code).toBe("seats_downgrade");
  });

  it("refuses less luggage capacity", () => {
    const result = validateAlternativeNotWorse({
      original: original({ luggage: 3 }),
      alternative: alternative({ luggage: 1 }),
    });
    expect(result.code).toBe("luggage_downgrade");
  });

  it("requires photographs so the customer can judge the substitution", () => {
    const result = validateAlternativeNotWorse({
      original: original(),
      alternative: alternative({ photos: [] }),
    });
    expect(result.code).toBe("photos_required");
  });

  it("requires a stated reason", () => {
    const result = validateAlternativeNotWorse({
      original: original(),
      alternative: alternative({ reasonForReplacement: "   " }),
    });
    expect(result.code).toBe("reason_required");
  });

  it("does not block when a class is unknown to the ranking", () => {
    const result = validateAlternativeNotWorse({
      original: original({ category: "cabrio" }),
      alternative: alternative({ category: "estate" }),
    });
    expect(result.ok).toBe(true);
  });
});
