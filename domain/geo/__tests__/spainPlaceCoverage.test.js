/**
 * @jest-environment node
 */
import {
  inferProvinceCodeFromLocation,
  locationInServiceAreas,
} from "../spainPlaceCoverage";
import {
  SPAIN_COMMUNITIES,
  SPAIN_PROVINCES,
  compactServiceAreas,
} from "../spainAdminDivisions";

describe("spainPlaceCoverage", () => {
  test("persisted community/province selections stay official INE codes", () => {
    const areas = compactServiceAreas({
      communityCodes: ["09"],
      provinceCodes: ["29"],
    });
    expect(areas.communityCodes).toEqual(["09"]);
    expect(areas.provinceCodes).toEqual(["29"]);
    expect(SPAIN_COMMUNITIES.some((c) => c.name === "Costa Brava")).toBe(false);
    expect(SPAIN_PROVINCES.some((p) => p.name === "Costa Brava")).toBe(false);
    expect(SPAIN_COMMUNITIES.some((c) => c.code === "18")).toBe(true);
    expect(SPAIN_COMMUNITIES.some((c) => c.code === "19")).toBe(true);
  });

  test("location matching uses province codes aligned with GeoJSON", () => {
    expect(inferProvinceCodeFromLocation({ city: "Barcelona" })).toBe("08");
    expect(
      locationInServiceAreas(
        { city: "Sitges" },
        { communityCodes: ["09"], provinceCodes: [] }
      )
    ).toBe(true);
  });
});
