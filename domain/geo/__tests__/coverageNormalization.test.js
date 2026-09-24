import { normalizeLegacyCoverage } from "../coverageNormalization";
import {
  COSTA_BRAVA_CITIES,
  COMUNITAT_VALENCIANA_CITIES,
} from "../spainCoverageRegions";

describe("coverageNormalization", () => {
  test("maps Costa Brava and Comunitat Valenciana labels to official codes", () => {
    const result = normalizeLegacyCoverage({
      operatingCities: [
        "Costa Brava",
        "Comunitat Valenciana",
        "Barcelona",
        "Lloret de Mar",
      ],
      orderRadiusKm: 25,
    });
    expect(result.provinceCodes).toContain("17");
    expect(result.communityCodes).toContain("10");
    expect(result.cities).toEqual(["Barcelona", "Lloret de Mar"]);
    expect(result.cities).not.toContain("Costa Brava");
    expect(result.cities).not.toContain("Comunitat Valenciana");
    expect(result.radiusKm).toBe(25);
    expect(result.unmatched).toEqual([]);
  });

  test("infers codes from complete legacy city packs without dropping cities", () => {
    const result = normalizeLegacyCoverage({
      operatingCities: ["Girona", ...COSTA_BRAVA_CITIES, ...COMUNITAT_VALENCIANA_CITIES],
    });
    expect(result.provinceCodes).toContain("17");
    expect(result.communityCodes).toContain("10");
    expect(result.cities).toEqual(
      expect.arrayContaining(["Girona", "Lloret de Mar", "Valencia", "Alicante"])
    );
  });

  test("keeps ordinary city lists and office radius as-is", () => {
    const result = normalizeLegacyCoverage({
      operatingCities: ["Barcelona", "Madrid"],
      orderRadiusKm: 25,
    });
    expect(result.communityCodes).toEqual([]);
    expect(result.provinceCodes).toEqual([]);
    expect(result.cities).toEqual(["Barcelona", "Madrid"]);
    expect(result.radiusKm).toBe(25);
    expect(result.unmatched).toEqual([]);
  });

  test("preserves unmatched region-like values for review", () => {
    const result = normalizeLegacyCoverage({
      operatingCities: ["Barcelona", "Costa Inventada", "Provincia Lunar"],
    });
    expect(result.cities).toEqual(
      expect.arrayContaining(["Barcelona", "Costa Inventada", "Provincia Lunar"])
    );
    expect(result.unmatched.sort()).toEqual([
      "Costa Inventada",
      "Provincia Lunar",
    ]);
  });

  test("keeps already-saved official codes and does not delete cities", () => {
    const result = normalizeLegacyCoverage({
      operatingCities: ["Sitges"],
      serviceAreas: { communityCodes: ["09"], provinceCodes: ["29"] },
    });
    expect(result.communityCodes).toEqual(["09"]);
    expect(result.provinceCodes).toEqual(["29"]);
    expect(result.cities).toEqual(["Sitges"]);
  });
});
