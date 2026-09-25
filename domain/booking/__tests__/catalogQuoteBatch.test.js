import {
  MAX_CATALOG_QUOTE_CARS,
  buildCatalogQuoteRequestKey,
  catalogQuoteFromHttpBody,
  normalizeCatalogCarIds,
} from "../catalogQuoteBatch";

describe("SEARCH_FIRST catalog quote batch", () => {
  test("car ids are unique, stable and capped", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `car-${i}`);
    const normalized = normalizeCatalogCarIds([...ids, "car-0", "", null]);
    expect(normalized[0]).toBe("car-0");
    expect(normalized).toHaveLength(MAX_CATALOG_QUOTE_CARS);
    expect(new Set(normalized).size).toBe(MAX_CATALOG_QUOTE_CARS);
  });

  test("the catalog request key covers the whole result set once", () => {
    const key = buildCatalogQuoteRequestKey({
      carIds: ["car-b", "car-a", "car-a"],
      startDate: "2026-10-20",
      endDate: "2026-10-24",
      placeIn: "Barcelona",
      placeOut: "Girona",
    });
    expect(key.startsWith("catalog|2026-10-20|2026-10-24|Barcelona|Girona|")).toBe(
      true
    );
    expect(key).toContain("car-b");
    expect(key).toContain("car-a");
  });

  test("an incomplete range never produces a catalog request key", () => {
    expect(
      buildCatalogQuoteRequestKey({
        carIds: ["car-a"],
        startDate: "2026-10-20",
        endDate: null,
      })
    ).toBe("");
  });

  test("a successful body becomes the card quote without a second total", () => {
    const mapped = catalogQuoteFromHttpBody("car-a", {
      ok: true,
      totalPrice: 105,
      days: 4,
      available: true,
      rangeKey: "2026-10-20|2026-10-24",
      quoteId: "q-1",
    });
    expect(mapped.status).toBe("ready");
    expect(mapped.quote.totalPrice).toBe(105);
  });

  test("a failed body does not invent a price", () => {
    expect(catalogQuoteFromHttpBody("car-a", { ok: false }).status).toBe("error");
    expect(
      catalogQuoteFromHttpBody("car-a", { ok: true, totalPrice: 0, available: true })
        .status
    ).toBe("error");
  });
});
