/**
 * @jest-environment node
 */
import {
  estimateTransferDistanceFromCatalog,
  getCuratedDistanceKm,
} from "@/domain/transfers/transferLocations";

describe("transferLocations catalog estimate", () => {
  test("looks up curated hub distances", () => {
    expect(getCuratedDistanceKm("Thessaloniki Airport")).toBe(0);
    expect(getCuratedDistanceKm("Thessaloniki")).toBe(17);
    expect(getCuratedDistanceKm("Nikiti")).toBe(90);
  });

  test("estimates A→B from hub distances", () => {
    const result = estimateTransferDistanceFromCatalog(
      "Thessaloniki Airport",
      "Thessaloniki"
    );
    expect(result.ok).toBe(true);
    expect(result.distanceKm).toBe(17);
    expect(result.approximate).toBe(true);
    expect(result.durationMinutes).toBeGreaterThan(0);
  });

  test("same place is zero via getTransferDistance caller, catalog abs works", () => {
    const result = estimateTransferDistanceFromCatalog("Nikiti", "Sarti");
    expect(result.ok).toBe(true);
    expect(result.distanceKm).toBe(35);
  });
});
