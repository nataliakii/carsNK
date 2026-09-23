const { INDEXES, COLLECTION } = require("../migrateAlternativeOfferIndexes");

describe("alternative offer index migration", () => {
  test("is dry-run by default and requires --apply", () => {
    expect(COLLECTION).toBe("alternative_vehicle_offers");
    expect(process.argv.includes("--apply")).toBe(false);
  });

  test("plans a partial unique index for one OFFERED row per order", () => {
    const active = INDEXES.find((idx) => idx.name === "orderId_1_status_offered_unique");
    expect(active.unique).toBe(true);
    expect(active.partialFilterExpression).toEqual({ status: "OFFERED" });
    expect(active.key).toEqual({ orderId: 1 });
  });

  test("index list is idempotent (createIndex, never drop)", () => {
    const names = INDEXES.map((idx) => idx.name);
    expect(new Set(names).size).toBe(names.length);
    expect(INDEXES.every((idx) => idx.name)).toBe(true);
  });
});
